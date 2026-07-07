import re
from typing import Annotated

from pydantic import AfterValidator, BaseModel, EmailStr, Field

_ALLOWED_DOMAINS = ("fourdm.com", "fourdm.digital")


def _check_domain(v: str) -> str:
    if v.rsplit("@", 1)[-1].lower() not in _ALLOWED_DOMAINS:
        raise ValueError("Email must be a @fourdm.com or @fourdm.digital address")
    return v


def _check_password(v: str) -> str:
    if len(v) < 10 or len(v) > 128 or not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
        raise ValueError("Password must be 10-128 characters and include a letter and a number.")
    return v


# Signups/user-creation are restricted to the company's own email domains.
AllowedEmail = Annotated[EmailStr, AfterValidator(_check_domain)]
StrongPassword = Annotated[str, AfterValidator(_check_password)]


class RegisterRequest(BaseModel):
    email: AllowedEmail
    password: StrongPassword
    full_name: str = ""
    org_name: str = ""  # optional; defaults to the user's email


class SignupVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    role: str
    org_id: str
    is_admin: bool = False


class OrgOut(BaseModel):
    id: str
    name: str
    plan: str
    monthly_quota_cents: int


class MeOut(BaseModel):
    user: UserOut
    org: OrgOut


class AuthResponse(TokenPair):
    user: UserOut
