from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.auth import AllowedEmail, StrongPassword


class AdminUserOut(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    role: str
    org_id: str
    org_name: str
    is_active: bool
    is_admin: bool
    created_at: datetime
    # Spend aggregated from the usage log (billed calls only; cached reads cost 0).
    month_cents: int
    total_cents: int
    calls: int
    last_active: datetime | None = None


class AdminUsersResponse(BaseModel):
    users: list[AdminUserOut]
    total_month_cents: int
    total_cents: int


class AdminUserCreate(BaseModel):
    email: AllowedEmail
    password: StrongPassword
    full_name: str = ""
    role: str = Field(default="member", pattern="^(member|owner)$")
    # Blank -> the new user joins the admin's organization. Set to create the
    # user under a new (or existing, matched by name) organization instead.
    org_name: str = ""


class AdminUserUpdate(BaseModel):
    """Partial update — only the fields provided are changed."""

    full_name: str | None = None
    role: str | None = Field(default=None, pattern="^(member|owner)$")
    # Setting a password resets the user's credentials.
    password: StrongPassword | None = None
    is_active: bool | None = None
    # Move the user to another organization (created if it doesn't exist).
    org_name: str | None = None
