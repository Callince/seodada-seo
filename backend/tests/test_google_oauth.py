from __future__ import annotations

import pytest

from app.api.v1 import auth as auth_api
from app.db.models import User


@pytest.mark.asyncio
async def test_google_upsert_open_to_any_email_and_reuse(db):
    # Any Google account creates a verified user (public SaaS — no domain gate).
    u1 = await auth_api._upsert_google_user(db, "a@gmail.com", "A")
    assert u1.email == "a@gmail.com" and u1.role == "owner"
    assert u1.is_verified is True  # Google sign-in is a verified email

    # Same email again → returns the existing user, no duplicate.
    u2 = await auth_api._upsert_google_user(db, "a@gmail.com", "A")
    assert u2.id == u1.id
    assert len(list(await db.scalars(auth_api.select(User)))) == 1

    # A different provider domain also works.
    u3 = await auth_api._upsert_google_user(db, "b@fourdm.com", "B")
    assert u3.id != u1.id
