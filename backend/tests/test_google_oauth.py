from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.api.v1 import auth as auth_api
from app.db.models import User


@pytest.mark.asyncio
async def test_google_upsert_domain_gate_and_reuse(db):
    # Allowed domain → creates the user.
    u1 = await auth_api._upsert_google_user(db, "a@fourdm.com", "A")
    assert u1.email == "a@fourdm.com" and u1.role == "owner"

    # Same email again → returns the existing user, no duplicate.
    u2 = await auth_api._upsert_google_user(db, "a@fourdm.com", "A")
    assert u2.id == u1.id
    assert len(list(await db.scalars(auth_api.select(User)))) == 1

    # Outside domain → rejected.
    with pytest.raises(HTTPException):
        await auth_api._upsert_google_user(db, "x@gmail.com", "X")
