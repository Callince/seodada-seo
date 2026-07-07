"""Platform administration — user roster with per-user spend, user creation.

Gated by `require_admin` (emails in ADMIN_EMAILS). Spend figures are aggregated
from the usage log: cached reads are recorded at 0 cents, so these numbers are
real billed cost.
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, is_platform_admin, require_admin
from app.core.config import settings
from app.core.security import hash_password
from app.db.models import Organization, UsageLog, User
from app.schemas.admin import AdminUserOut, AdminUsersResponse, AdminUserUpdate
from app.services.usage import _month_start

router = APIRouter()


def _row_out(user: User, org_name: str, month: int, total: int, calls: int, last) -> AdminUserOut:
    return AdminUserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        org_id=user.org_id,
        org_name=org_name,
        is_active=user.is_active,
        is_admin=is_platform_admin(user),
        created_at=user.created_at,
        month_cents=month,
        total_cents=total,
        calls=calls,
        last_active=last,
    )


@router.get("/users", response_model=AdminUsersResponse)
async def list_users(
    db: AsyncSession = Depends(get_db_session),
    _admin: User = Depends(require_admin),
) -> AdminUsersResponse:
    """All users across all organizations, biggest spender first."""
    month_start = _month_start()
    rows = (
        await db.execute(
            select(
                User,
                Organization.name,
                func.coalesce(func.sum(UsageLog.cost_cents), 0),
                func.coalesce(
                    func.sum(case((UsageLog.created_at >= month_start, UsageLog.cost_cents), else_=0)),
                    0,
                ),
                func.count(UsageLog.id),
                func.max(UsageLog.created_at),
            )
            .join(Organization, Organization.id == User.org_id)
            .outerjoin(UsageLog, UsageLog.user_id == User.id)
            .group_by(User.id, Organization.name)
        )
    ).all()

    users = [
        _row_out(u, org_name, int(month), int(total), int(calls), last)
        for u, org_name, total, month, calls, last in rows
    ]
    users.sort(key=lambda x: (x.total_cents, x.month_cents), reverse=True)
    return AdminUsersResponse(
        users=users,
        total_month_cents=sum(u.month_cents for u in users),
        total_cents=sum(u.total_cents for u in users),
    )


async def _spend_for(db: AsyncSession, user_id: str) -> tuple[int, int, int, datetime | None]:
    month_start = _month_start()
    total, month, calls, last = (
        await db.execute(
            select(
                func.coalesce(func.sum(UsageLog.cost_cents), 0),
                func.coalesce(
                    func.sum(case((UsageLog.created_at >= month_start, UsageLog.cost_cents), else_=0)),
                    0,
                ),
                func.count(UsageLog.id),
                func.max(UsageLog.created_at),
            ).where(UsageLog.user_id == user_id)
        )
    ).one()
    return int(month), int(total), int(calls), last


@router.patch("/users/{user_id}", response_model=AdminUserOut)
async def update_user(
    user_id: str,
    body: AdminUserUpdate,
    db: AsyncSession = Depends(get_db_session),
    admin: User = Depends(require_admin),
) -> AdminUserOut:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if body.is_active is False and user.id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot deactivate your own account")

    if body.full_name is not None:
        user.full_name = body.full_name.strip()
    if body.role is not None:
        user.role = body.role
    if body.password is not None:
        user.hashed_password = hash_password(body.password)
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.org_name is not None and body.org_name.strip():
        org_name = body.org_name.strip()
        org = await db.scalar(select(Organization).where(Organization.name == org_name))
        if org is None:
            org = Organization(name=org_name, monthly_quota_cents=settings.default_org_quota_cents)
            db.add(org)
            await db.flush()
        user.org_id = org.id

    await db.commit()
    await db.refresh(user)
    org = await db.get(Organization, user.org_id)
    month, total, calls, last = await _spend_for(db, user.id)
    return _row_out(user, org.name if org else "", month, total, calls, last)
