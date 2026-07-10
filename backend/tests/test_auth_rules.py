from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.auth import RegisterRequest


def test_public_signup_allows_any_valid_email():
    # Public SaaS — any valid email domain is accepted.
    for email in ["a@fourdm.com", "b@gmail.com", "c@some-startup.io"]:
        RegisterRequest(email=email, password="goodpass1", org_name="X")
    # Still requires a syntactically valid email.
    with pytest.raises(ValidationError):
        RegisterRequest(email="not-an-email", password="goodpass1")


def test_password_rules_min_eight_letter_and_digit():
    RegisterRequest(email="a@b.com", password="abcd1234")  # ok: 8 chars, letter + digit
    for pw in ["short1", "nodigitshere", "12345678"]:  # too short / no digit / no letter
        with pytest.raises(ValidationError):
            RegisterRequest(email="a@b.com", password=pw)
