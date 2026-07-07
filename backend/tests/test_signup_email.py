from __future__ import annotations

import base64

import pytest

from app.api.v1 import auth as auth_api
from app.schemas.auth import RegisterRequest
from app.services import email as email_svc


def test_raw_message_roundtrip():
    raw = email_svc._raw_message("to@x.com", "Hi there", "<p>hey</p>")
    decoded = base64.urlsafe_b64decode(raw).decode()
    assert "to@x.com" in decoded and "Hi there" in decoded


@pytest.mark.asyncio
async def test_register_instant_when_email_disabled(db):
    # Tests run with no SMTP/Gmail configured -> signup creates the account now.
    out = await auth_api.register(
        RegisterRequest(email="a@fourdm.com", password="goodpass12", full_name="A"), db
    )
    assert out["verification"] is False
    assert out["user"]["email"] == "a@fourdm.com"
