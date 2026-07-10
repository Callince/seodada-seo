"""Daily plan-limit enforcement (seodada usage_per_day model)."""
from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.api.v1 import auth as auth_api
from app.core import config
from app.db.models import Plan, Subscription
from app.services import usage


@pytest.mark.asyncio
async def test_free_tier_daily_limit_enforced(db, monkeypatch):
    monkeypatch.setattr(config.settings, "quota_enabled", True)
    monkeypatch.setattr(config.settings, "free_daily_analyses", 3)
    user = await auth_api._upsert_google_user(db, "q@test.com", "Q")

    # First 3 analyses are allowed; each records a usage row.
    for _ in range(3):
        await usage.assert_within_quota(db, user)
        await usage.record(db, user, "onpage.analyze", 0, from_cache=False)

    # The 4th is blocked with 402.
    with pytest.raises(HTTPException) as exc:
        await usage.assert_within_quota(db, user)
    assert exc.value.status_code == 402


@pytest.mark.asyncio
async def test_cached_calls_dont_count(db, monkeypatch):
    monkeypatch.setattr(config.settings, "quota_enabled", True)
    monkeypatch.setattr(config.settings, "free_daily_analyses", 2)
    user = await auth_api._upsert_google_user(db, "c@test.com", "C")

    # Cached reads are recorded but must not consume the daily allowance.
    for _ in range(5):
        await usage.record(db, user, "serp", 0, from_cache=True)
    await usage.assert_within_quota(db, user)  # still fine — nothing counted


@pytest.mark.asyncio
async def test_admin_is_exempt_from_daily_limit(db, monkeypatch):
    monkeypatch.setattr(config.settings, "quota_enabled", True)
    monkeypatch.setattr(config.settings, "free_daily_analyses", 1)
    user = await auth_api._upsert_google_user(db, "boss@test.com", "Boss")
    user.is_staff = True  # platform admin
    await db.commit()

    # Well past the free limit of 1 — an admin is never blocked.
    for _ in range(5):
        await usage.assert_within_quota(db, user)
        await usage.record(db, user, "onpage.analyze", 0, from_cache=False)

    # The dashboard reports no cap (0 -> ∞ in the UI).
    stats = await usage.dashboard_stats(db, user.org_id, unlimited=True)
    assert stats["daily_limit"] == 0


@pytest.mark.asyncio
async def test_subscription_raises_the_limit(db, monkeypatch):
    monkeypatch.setattr(config.settings, "quota_enabled", True)
    monkeypatch.setattr(config.settings, "free_daily_analyses", 1)
    user = await auth_api._upsert_google_user(db, "s@test.com", "S")

    plan = Plan(name="Pro", slug="pro", price_cents=499900, usage_per_day=50, tier=2, period_days=30)
    db.add(plan)
    await db.flush()
    db.add(Subscription(org_id=user.org_id, plan_id=plan.id, status="active"))
    await db.commit()

    assert await usage.daily_limit(db, user.org_id) == 50  # plan limit, not the free 1
    await usage.record(db, user, "onpage.analyze", 0, from_cache=False)
    await usage.assert_within_quota(db, user)  # well within 50
