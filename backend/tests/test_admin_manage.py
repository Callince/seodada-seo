"""Admin management — plan CRUD, website settings, dashboard stats.

The endpoint functions are called directly (the require_admin gate is a FastAPI
dependency, exercised in integration; here we test the logic).
"""
from __future__ import annotations

import pytest

from app.api.v1 import admin
from app.api.v1 import auth as auth_api
from app.schemas.admin import PlanCreate, PlanUpdate, WebsiteSettingsUpdate


@pytest.mark.asyncio
async def test_plan_crud(db):
    user = await auth_api._upsert_google_user(db, "a@admin.com", "A")

    created = await admin.create_plan(
        PlanCreate(name="Team Plan", price_cents=299900, usage_per_day=70, tier=2, features=["x", "y"]),
        db, user,
    )
    assert created.slug == "team-plan" and created.price_cents == 299900 and created.is_active

    updated = await admin.update_plan(created.id, PlanUpdate(price_cents=349900, usage_per_day=80), db, user)
    assert updated.price_cents == 349900 and updated.usage_per_day == 80

    archived = await admin.archive_plan(created.id, db, user)
    assert archived.is_active is False

    plans = await admin.admin_plans(db, user)
    assert any(p.id == created.id for p in plans)  # still listed (soft-deleted)


@pytest.mark.asyncio
async def test_website_settings_get_and_update(db):
    user = await auth_api._upsert_google_user(db, "b@admin.com", "B")

    s = await admin.get_settings(db, user)  # lazily created with defaults
    assert s.company_name == "seodada"

    updated = await admin.update_settings(
        WebsiteSettingsUpdate(company_name="SEO Dada", support_email="help@seodada.com"), db, user
    )
    assert updated.company_name == "SEO Dada" and updated.support_email == "help@seodada.com"

    # A second read returns the same single row (no duplicate created).
    again = await admin.get_settings(db, user)
    assert again.company_name == "SEO Dada"


@pytest.mark.asyncio
async def test_stats_counts_users(db):
    await auth_api._upsert_google_user(db, "c@admin.com", "C")
    await auth_api._upsert_google_user(db, "d@admin.com", "D")
    user = await auth_api._upsert_google_user(db, "e@admin.com", "E")

    stats = await admin.stats(db, user)
    assert stats.total_users == 3
    assert stats.active_users == 3
    assert stats.active_subscriptions == 0
    assert len(stats.recent_signups) == 3
