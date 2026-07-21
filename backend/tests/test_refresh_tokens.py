"""Revocable, rotating refresh tokens."""
from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.api.v1 import auth as auth_api
from app.schemas.auth import RefreshRequest


async def _login_pair(db):
    user = await auth_api._upsert_google_user(db, "rt@test.com", "RT")
    return user, await auth_api._token_pair(db, user.id)


async def test_refresh_rotates_and_old_token_is_dead(db):
    user, pair = await _login_pair(db)

    fresh = await auth_api.refresh(RefreshRequest(refresh_token=pair["refresh_token"]), db)
    assert fresh["access_token"] and fresh["refresh_token"] != pair["refresh_token"]

    # The consumed token was rotated out — a replay is rejected.
    with pytest.raises(HTTPException) as exc:
        await auth_api.refresh(RefreshRequest(refresh_token=pair["refresh_token"]), db)
    assert exc.value.status_code == 401

    # The new one still works.
    again = await auth_api.refresh(RefreshRequest(refresh_token=fresh["refresh_token"]), db)
    assert again["access_token"]


async def test_logout_revokes_the_session(db):
    user, pair = await _login_pair(db)
    out = await auth_api.logout(RefreshRequest(refresh_token=pair["refresh_token"]), db)
    assert out == {"ok": True}

    with pytest.raises(HTTPException) as exc:
        await auth_api.refresh(RefreshRequest(refresh_token=pair["refresh_token"]), db)
    assert exc.value.status_code == 401


async def test_garbage_refresh_token_is_401(db):
    with pytest.raises(HTTPException) as exc:
        await auth_api.refresh(RefreshRequest(refresh_token="not-a-jwt"), db)
    assert exc.value.status_code == 401
