"""Daily plan-limit enforcement (seodada usage_per_day model)."""
from __future__ import annotations

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.api.v1 import auth as auth_api
from app.core import config
from app.db.models import Plan, Subscription, UsageLog
from app.integrations.dataforseo.client import DfsResult
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
async def test_admin_granted_unlimited_usage_bypasses_limit(db, monkeypatch):
    monkeypatch.setattr(config.settings, "quota_enabled", True)
    monkeypatch.setattr(config.settings, "free_daily_analyses", 1)
    user = await auth_api._upsert_google_user(db, "vip@test.com", "VIP")
    user.unlimited_usage = True  # granted from Admin → Users
    await db.commit()

    # Well past the free limit of 1 — never blocked.
    for _ in range(5):
        await usage.assert_within_quota(db, user)
        await usage.record(db, user, "onpage.analyze", 0, from_cache=False)

    # Revoking the grant restores enforcement.
    user.unlimited_usage = False
    await db.commit()
    with pytest.raises(HTTPException) as exc:
        await usage.assert_within_quota(db, user)
    assert exc.value.status_code == 402


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


@pytest.mark.asyncio
async def test_metered_check_quota_false_records_but_skips_gate(db, monkeypatch):
    """Billed sub-lookups (e.g. brand volume inside a SERP call) skip the quota
    re-check but must still be recorded and metered."""
    monkeypatch.setattr(config.settings, "quota_enabled", True)
    monkeypatch.setattr(config.settings, "free_daily_analyses", 1)
    user = await auth_api._upsert_google_user(db, "m@test.com", "M")

    # Exhaust the daily allowance.
    await usage.record(db, user, "serp.organic", 5, from_cache=False)

    async def fetch():
        return DfsResult(result=[{"ok": True}], cost_cents=7)

    # With the gate on, metered() blocks.
    with pytest.raises(HTTPException) as exc:
        await usage.metered(db, user, "keywords.search_volume", {"k": 1}, 60, fetch)
    assert exc.value.status_code == 402

    # A sub-lookup with check_quota=False goes through and is recorded.
    resolved = await usage.metered(
        db, user, "keywords.search_volume", {"k": 2}, 60, fetch, check_quota=False
    )
    assert resolved.cost_cents == 7
    rows = (await db.execute(
        select(UsageLog).where(UsageLog.endpoint == "keywords.search_volume")
    )).scalars().all()
    assert len(rows) == 1 and rows[0].cost_cents == 7


@pytest.mark.asyncio
async def test_metered_parallel_overlaps_calls_and_records_each(db):
    """metered_parallel must actually run lookups concurrently (each on its own
    session) and record a usage row per call."""
    import asyncio
    import time

    user = await auth_api._upsert_google_user(db, "par@test.com", "P")

    async def slow_fetch():
        await asyncio.sleep(0.2)
        return DfsResult(result=[{"ok": True}], cost_cents=3)

    calls = [(f"labs.fake_{i}", {"i": i}, 60, slow_fetch) for i in range(3)]
    start = time.perf_counter()
    results = await usage.metered_parallel(db, user, calls)
    elapsed = time.perf_counter() - start

    assert [r.cost_cents for r in results] == [3, 3, 3]
    assert elapsed < 0.5, f"calls ran serially ({elapsed:.2f}s for 3x0.2s sleeps)"
    n = (await db.execute(
        select(UsageLog).where(UsageLog.endpoint.like("labs.fake_%"))
    )).scalars().all()
    assert len(n) == 3
