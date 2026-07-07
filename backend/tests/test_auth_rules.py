from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.auth import RegisterRequest


def test_company_domain_and_password_rules():
    RegisterRequest(email="a@fourdm.com", password="goodpass12", org_name="X")  # ok
    RegisterRequest(email="b@fourdm.digital", password="goodpass12", org_name="X")  # ok
    for email in ["a@gmail.com", "a@notfourdm.com"]:  # non-company domains
        with pytest.raises(ValidationError):
            RegisterRequest(email=email, password="goodpass12", org_name="X")
    for pw in ["short1", "nodigitshere", "1234567890"]:  # too short / no digit / no letter
        with pytest.raises(ValidationError):
            RegisterRequest(email="a@fourdm.com", password=pw, org_name="X")
