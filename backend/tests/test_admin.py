from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.api.deps import require_admin
from app.api.v1 import admin as admin_api
from app.core.config import settings
from app.core.security import verify_password
from app.db.models import Organization, UsageLog, User
from app.schemas.admin import AdminUserUpdate


async def _seed(db, email: str, org_name: str = "Acme") -> User:
    org = Organization(name=org_name, monthly_quota_cents=5000)
    db.add(org)
    await db.flush()
    user = User(email=email, hashed_password="x", org_id=org.id, role="owner")
    db.add(user)
    await db.commit()
    return user


@pytest.mark.asyncio
async def test_require_admin_blocks_non_admin(db, monkeypatch):
    monkeypatch.setattr(settings, "admin_emails", "boss@example.com")
    user = await _seed(db, "pleb@example.com")
    with pytest.raises(HTTPException) as exc:
        await require_admin(user)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_require_admin_allows_listed_email(db, monkeypatch):
    monkeypatch.setattr(settings, "admin_emails", "Boss@Example.com, other@x.y")
    user = await _seed(db, "boss@example.com")
    assert await require_admin(user) is user


@pytest.mark.asyncio
async def test_list_users_sorted_by_spend(db, monkeypatch):
    monkeypatch.setattr(settings, "admin_emails", "boss@example.com")
    boss = await _seed(db, "boss@example.com", "HQ")
    big = await _seed(db, "big@example.org", "BigCo")
    now = datetime.now(timezone.utc)
    db.add_all(
        [
            UsageLog(user_id=big.id, org_id=big.org_id, endpoint="serp.organic",
                     cost_cents=300, from_cache=False, created_at=now),
            UsageLog(user_id=big.id, org_id=big.org_id, endpoint="serp.organic",
                     cost_cents=0, from_cache=True, created_at=now),
            UsageLog(user_id=boss.id, org_id=boss.org_id, endpoint="labs.ranked_keywords",
                     cost_cents=40, from_cache=False, created_at=now - timedelta(days=90)),
        ]
    )
    await db.commit()

    out = await admin_api.list_users(db, boss)
    assert [u.email for u in out.users[:2]] == ["big@example.org", "boss@example.com"]
    top = out.users[0]
    assert top.total_cents == 300 and top.month_cents == 300 and top.calls == 2
    older = out.users[1]
    assert older.total_cents == 40 and older.month_cents == 0  # spend was 3 months ago
    assert out.total_cents == 340
    assert out.users[1].is_admin is True  # boss flagged


@pytest.mark.asyncio
async def test_update_user_fields(db, monkeypatch):
    monkeypatch.setattr(settings, "admin_emails", "boss@example.com")
    boss = await _seed(db, "boss@example.com", "HQ")
    target = await _seed(db, "emp@fourdm.com", "EmpCo")

    out = await admin_api.update_user(
        target.id,
        AdminUserUpdate(full_name="Renamed", role="owner", password="NewPass123!",
                        is_active=False, org_name="MovedCo"),
        db, boss,
    )
    assert out.full_name == "Renamed" and out.role == "owner"
    assert out.is_active is False and out.org_name == "MovedCo"
    fresh = await db.get(User, target.id)
    assert verify_password("NewPass123!", fresh.hashed_password)
    assert not verify_password("Secret123!", fresh.hashed_password)

    # Partial update leaves other fields alone.
    out2 = await admin_api.update_user(target.id, AdminUserUpdate(is_active=True), db, boss)
    assert out2.is_active is True and out2.full_name == "Renamed" and out2.org_name == "MovedCo"


@pytest.mark.asyncio
async def test_update_guards(db, monkeypatch):
    monkeypatch.setattr(settings, "admin_emails", "boss@example.com")
    boss = await _seed(db, "boss@example.com", "HQ")

    with pytest.raises(HTTPException) as exc:
        await admin_api.update_user(boss.id, AdminUserUpdate(is_active=False), db, boss)
    assert exc.value.status_code == 400  # cannot lock yourself out

    with pytest.raises(HTTPException) as exc:
        await admin_api.update_user("nope-id", AdminUserUpdate(full_name="x"), db, boss)
    assert exc.value.status_code == 404
