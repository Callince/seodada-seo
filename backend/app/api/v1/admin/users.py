"""Admin: user roster, per-user spend, dashboard stats, usage history."""
from __future__ import annotations


import secrets
import string
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_db_session,
    is_platform_admin,
    require_admin,
)
from app.core.config import settings
from app.core.security import hash_password
from app.db.models import (
    EmailLog,
    Organization,
    Payment,
    Plan,
    Subscription,
    UsageLog,
    User,
)
from app.schemas.admin import (
    AdminStats,
    DfsAccountOut,
    AdminUserCreate,
    AdminUserDetail,
    AdminUserOut,
    AdminUsersResponse,
    AdminUserUpdate,
    ResetPasswordOut,
    UsageHistoryResponse,
    UsageHistoryRow,
)
from app.services import dfs_account
from app.services.usage import _month_start
from app.api.v1.admin._shared import _csv_response

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
        unlimited_usage=bool(user.unlimited_usage),
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
    if body.unlimited_usage is not None:
        user.unlimited_usage = body.unlimited_usage
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


@router.post("/users", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: AdminUserCreate,
    db: AsyncSession = Depends(get_db_session),
    admin: User = Depends(require_admin),
) -> AdminUserOut:
    if await db.scalar(select(User.id).where(User.email == body.email.lower())):
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with that email already exists")

    org_name = body.org_name.strip()
    if org_name:
        org = await db.scalar(select(Organization).where(Organization.name == org_name))
        if org is None:
            org = Organization(name=org_name, monthly_quota_cents=settings.default_org_quota_cents)
            db.add(org)
            await db.flush()
        org_id = org.id
    else:
        org_id = admin.org_id

    user = User(
        email=body.email.lower(), hashed_password=hash_password(body.password),
        full_name=body.full_name.strip(), role=body.role, org_id=org_id, is_verified=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    org = await db.get(Organization, user.org_id)
    return _row_out(user, org.name if org else "", 0, 0, 0, None)


@router.post("/users/{user_id}/reset-password", response_model=ResetPasswordOut)
async def reset_user_password(
    user_id: str,
    db: AsyncSession = Depends(get_db_session),
    _admin: User = Depends(require_admin),
) -> ResetPasswordOut:
    """Generate a strong temporary password and set it. Returned once to the admin."""
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    alphabet = string.ascii_letters + string.digits + "!@#$%*?"
    new_pw = "".join(secrets.choice(alphabet) for _ in range(14))
    user.hashed_password = hash_password(new_pw)
    await db.commit()
    return ResetPasswordOut(password=new_pw)


@router.get("/users/{user_id}", response_model=AdminUserDetail)
async def user_detail(
    user_id: str,
    db: AsyncSession = Depends(get_db_session),
    _admin: User = Depends(require_admin),
) -> AdminUserDetail:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    org = await db.get(Organization, user.org_id)
    month, total, calls, last = await _spend_for(db, user.id)
    base = _row_out(user, org.name if org else "", month, total, calls, last)

    subs = (
        await db.execute(
            select(Subscription, Plan.name)
            .join(Plan, Plan.id == Subscription.plan_id)
            .where(Subscription.org_id == user.org_id)
            .order_by(Subscription.created_at.desc())
        )
    ).all()
    pays = list(
        await db.scalars(
            select(Payment).where(Payment.org_id == user.org_id).order_by(Payment.created_at.desc()).limit(50)
        )
    )
    usage = list(
        await db.scalars(
            select(UsageLog).where(UsageLog.user_id == user.id).order_by(UsageLog.created_at.desc()).limit(20)
        )
    )
    return AdminUserDetail(
        **base.model_dump(),
        subscriptions=[
            {"id": s.id, "plan_name": name, "status": s.status,
             "started_at": s.started_at, "current_period_end": s.current_period_end}
            for s, name in subs
        ],
        payments=[
            {"id": p.id, "amount_cents": p.amount_cents, "tax_cents": p.tax_cents,
             "currency": p.currency, "status": p.status, "invoice_number": p.invoice_number,
             "created_at": p.created_at}
            for p in pays
        ],
        recent_usage=[
            {"endpoint": u.endpoint, "cost_cents": u.cost_cents, "from_cache": u.from_cache,
             "created_at": u.created_at}
            for u in usage
        ],
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db_session),
    admin: User = Depends(require_admin),
):
    if user_id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot delete your own account")
    user = await db.get(User, user_id)
    if user is None:
        return
    # Clear the usage log first so the FK doesn't block the delete.
    await db.execute(UsageLog.__table__.delete().where(UsageLog.user_id == user_id))
    await db.execute(EmailLog.__table__.update().where(EmailLog.user_id == user_id).values(user_id=None))
    await db.delete(user)
    await db.commit()


# ------------------------------------------------------------------ dashboard

@router.get("/dfs-account", response_model=DfsAccountOut)
async def dfs_account_balance(
    refresh: bool = False, _: User = Depends(require_admin)
) -> DfsAccountOut:
    """Live DataForSEO balance for the admin dashboard (free call, 5-min cache)."""
    return DfsAccountOut(**await dfs_account.balance(force=refresh))


@router.get("/stats", response_model=AdminStats)
async def stats(db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)):
    now = datetime.now(timezone.utc)
    total_users = await db.scalar(select(func.count(User.id))) or 0
    active_users = await db.scalar(select(func.count(User.id)).where(User.is_active)) or 0
    total_orgs = await db.scalar(select(func.count(Organization.id))) or 0

    active_subs = list(
        await db.scalars(select(Subscription).where(Subscription.status == "active"))
    )
    active_subs = [
        s for s in active_subs
        if not s.current_period_end
        or (s.current_period_end.replace(tzinfo=timezone.utc) if s.current_period_end.tzinfo is None else s.current_period_end) > now
    ]
    plans = {p.id: p for p in await db.scalars(select(Plan))}
    mrr = sum(
        round((plans[s.plan_id].price_cents * 30) / max(1, plans[s.plan_id].period_days))
        for s in active_subs if s.plan_id in plans
    )
    dist: dict[str, int] = {}
    for s in active_subs:
        name = plans[s.plan_id].name if s.plan_id in plans else "?"
        dist[name] = dist.get(name, 0) + 1

    revenue = await db.scalar(
        select(func.coalesce(func.sum(Payment.amount_cents), 0)).where(Payment.status == "paid")
    ) or 0
    recent = list(await db.scalars(select(User).order_by(User.created_at.desc()).limit(5)))

    # 30-day daily series for the dashboard charts.
    window = now - timedelta(days=30)
    rev_rows = (
        await db.execute(
            select(func.date(Payment.created_at), func.coalesce(func.sum(Payment.amount_cents), 0))
            .where(Payment.status == "paid", Payment.created_at >= window)
            .group_by(func.date(Payment.created_at))
            .order_by(func.date(Payment.created_at))
        )
    ).all()
    signup_rows = (
        await db.execute(
            select(func.date(User.created_at), func.count(User.id))
            .where(User.created_at >= window)
            .group_by(func.date(User.created_at))
            .order_by(func.date(User.created_at))
        )
    ).all()
    status_rows = (
        await db.execute(select(Payment.status, func.count(Payment.id)).group_by(Payment.status))
    ).all()

    return AdminStats(
        total_users=int(total_users),
        active_users=int(active_users),
        total_orgs=int(total_orgs),
        active_subscriptions=len(active_subs),
        revenue_cents=int(revenue),
        mrr_cents=int(mrr),
        plan_distribution=[{"plan": k, "count": v} for k, v in dist.items()],
        recent_signups=[{"email": u.email, "created_at": u.created_at.isoformat()} for u in recent],
        revenue_series=[{"date": str(d), "cents": int(c)} for d, c in rev_rows],
        signups_series=[{"date": str(d), "count": int(c)} for d, c in signup_rows],
        payment_status=[{"status": s, "count": int(c)} for s, c in status_rows],
    )



# ------------------------------------------------------------ usage history

@router.get("/usage-history", response_model=UsageHistoryResponse)
async def usage_history(
    user: str | None = None,
    tool: str | None = None,
    days: int = 30,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_admin),
):
    base = (
        select(UsageLog, User.email, Organization.name)
        .join(User, User.id == UsageLog.user_id)
        .join(Organization, Organization.id == UsageLog.org_id)
    )
    if days:
        base = base.where(UsageLog.created_at >= datetime.now(timezone.utc) - timedelta(days=days))
    if tool:
        base = base.where(UsageLog.endpoint == tool)
    if user:
        base = base.where(User.email.ilike(f"%{user.strip()}%"))

    rows = (await db.execute(base.order_by(UsageLog.created_at.desc()).limit(500))).all()
    items = [
        UsageHistoryRow(
            id=u.id, user_email=email, org_name=org, endpoint=u.endpoint,
            cost_cents=u.cost_cents, from_cache=u.from_cache, created_at=u.created_at,
        )
        for u, email, org in rows
    ]

    scoped = select(UsageLog)
    if days:
        scoped = scoped.where(UsageLog.created_at >= datetime.now(timezone.utc) - timedelta(days=days))
    total = await db.scalar(select(func.count()).select_from(scoped.subquery())) or 0
    billed = await db.scalar(
        select(func.count()).select_from(scoped.where(UsageLog.from_cache.is_(False)).subquery())
    ) or 0
    cost = await db.scalar(
        select(func.coalesce(func.sum(scoped.subquery().c.cost_cents), 0))
    ) or 0
    tools = [t for (t,) in await db.execute(select(UsageLog.endpoint).distinct())]
    return UsageHistoryResponse(
        items=items, total=int(total), billed_count=int(billed), cached_count=int(total) - int(billed),
        total_cost_cents=int(cost), tools=sorted(tools),
    )


@router.get("/usage-history/export")
async def export_usage_history(
    user: str | None = None,
    tool: str | None = None,
    days: int = 30,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_admin),
):
    base = (
        select(UsageLog, User.email, Organization.name)
        .join(User, User.id == UsageLog.user_id)
        .join(Organization, Organization.id == UsageLog.org_id)
    )
    if days:
        base = base.where(UsageLog.created_at >= datetime.now(timezone.utc) - timedelta(days=days))
    if tool:
        base = base.where(UsageLog.endpoint == tool)
    if user:
        base = base.where(User.email.ilike(f"%{user.strip()}%"))
    rows = (await db.execute(base.order_by(UsageLog.created_at.desc()))).all()
    return _csv_response(
        ["User", "Organization", "Tool", "Cost (cents)", "From cache", "Created"],
        [[email, org, u.endpoint, u.cost_cents, u.from_cache, u.created_at.isoformat()] for u, email, org in rows],
        "usage-history.csv",
    )

