from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.api.v1 import auth as auth_api
from app.core.security import create_reset_token, verify_password
from app.schemas.auth import ResetPasswordRequest


@pytest.mark.asyncio
async def test_password_reset_sets_new_password_and_signs_in(db):
    user = await auth_api._upsert_google_user(db, "reset@me.com", "R")
    old_hash = user.hashed_password
    token = create_reset_token(user.id)

    out = await auth_api.reset_password(
        ResetPasswordRequest(token=token, password="newpass123"), db
    )
    assert out["access_token"] and out["user"]["email"] == "reset@me.com"

    await db.refresh(user)
    assert user.hashed_password != old_hash
    assert verify_password("newpass123", user.hashed_password)


@pytest.mark.asyncio
async def test_password_reset_rejects_invalid_token(db):
    with pytest.raises(HTTPException):
        await auth_api.reset_password(
            ResetPasswordRequest(token="not-a-real-token", password="newpass123"), db
        )


@pytest.mark.asyncio
async def test_reset_token_type_isolation(db):
    """An access token must not be usable as a reset token."""
    from app.core.security import create_access_token

    user = await auth_api._upsert_google_user(db, "iso@me.com", "I")
    with pytest.raises(HTTPException):
        await auth_api.reset_password(
            ResetPasswordRequest(token=create_access_token(user.id), password="newpass123"), db
        )
