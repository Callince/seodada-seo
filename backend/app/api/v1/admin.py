"""Platform administration — user roster with per-user spend, user creation.

Gated by `require_admin` (emails in ADMIN_EMAILS). Spend figures are aggregated
from the usage log: cached reads are recorded at 0 cents, so these numbers are
real billed cost.
"""
from __future__ import annotations

import csv
import io
import re
import secrets
import string
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    ADMIN_PERMISSIONS,
    effective_permissions,
    get_db_session,
    is_platform_admin,
    is_super_admin,
    require_admin,
)
from app.core.config import settings
from app.core.security import hash_password
from app.db.models import (
    Blog,
    BlogCategory,
    ContactSubmission,
    EmailLog,
    InvoiceAddress,
    Organization,
    Payment,
    Plan,
    Schedule,
    Subscription,
    UsageLog,
    User,
    WebsiteSettings,
    WebStory,
)
from app.integrations.razorpay import client as rzp
from app.schemas.admin import (
    AdminBlogDetail,
    AdminBlogOut,
    AdminMeOut,
    AdminPaymentOut,
    AdminRoleCreate,
    AdminRoleOut,
    AdminRoleUpdate,
    AdminStats,
    AdminSubscriptionOut,
    AdminUserCreate,
    AdminUserDetail,
    AdminUserOut,
    AdminUsersResponse,
    AdminUserUpdate,
    AdminWebStoryDetail,
    AdminWebStoryOut,
    BlogCategoryCreate,
    BlogCategoryOut,
    BlogCategoryUpdate,
    BlogCreate,
    BlogUpdate,
    ContactListResponse,
    ContactReply,
    ContactSubmissionOut,
    ContactUpdate,
    EmailLogListResponse,
    EmailLogOut,
    PaymentStatusUpdate,
    ScheduledEmailListResponse,
    ScheduledEmailOut,
    PlanAdminOut,
    PlanCreate,
    PlanUpdate,
    RefundRequest,
    ResetPasswordOut,
    SubscriptionAssign,
    SubscriptionExtend,
    SubscriptionStatusUpdate,
    UploadOut,
    UsageHistoryResponse,
    UsageHistoryRow,
    WebsiteSettingsOut,
    WebsiteSettingsUpdate,
    WebStoryCreate,
    WebStoryUpdate,
)
from app.services.email import send_email
from app.services.invoices import generate_invoice_pdf
from app.services.usage import _day_start, _month_start

router = APIRouter()


def _slugify(s: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower())).strip("-") or "item"


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


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


# --------------------------------------------------------------------- plans

def _plan_out(p: Plan) -> PlanAdminOut:
    return PlanAdminOut(
        id=p.id, name=p.name, slug=p.slug, price_cents=p.price_cents, currency=p.currency,
        period_days=p.period_days, usage_per_day=p.usage_per_day, tier=p.tier,
        features=p.features or [], is_active=p.is_active, sort_order=p.sort_order,
    )


@router.get("/plans", response_model=list[PlanAdminOut])
async def admin_plans(db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)):
    rows = await db.scalars(select(Plan).order_by(Plan.sort_order, Plan.price_cents))
    return [_plan_out(p) for p in rows]


@router.post("/plans", response_model=PlanAdminOut, status_code=status.HTTP_201_CREATED)
async def create_plan(
    body: PlanCreate, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    slug = _slugify(body.name)
    if await db.scalar(select(Plan.id).where(Plan.slug == slug)):
        slug = f"{slug}-{int(datetime.now(timezone.utc).timestamp())}"
    plan = Plan(
        name=body.name, slug=slug, price_cents=body.price_cents, currency=body.currency,
        period_days=body.period_days, usage_per_day=body.usage_per_day, tier=body.tier,
        features=body.features, is_active=body.is_active, sort_order=body.sort_order,
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return _plan_out(plan)


@router.patch("/plans/{plan_id}", response_model=PlanAdminOut)
async def update_plan(
    plan_id: str,
    body: PlanUpdate,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_admin),
):
    plan = await db.get(Plan, plan_id)
    if not plan:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plan not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(plan, k, v)
    await db.commit()
    await db.refresh(plan)
    return _plan_out(plan)


@router.delete("/plans/{plan_id}", response_model=PlanAdminOut)
async def archive_plan(
    plan_id: str, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    """Soft-delete — archive so existing subscriptions keep resolving their plan."""
    plan = await db.get(Plan, plan_id)
    if not plan:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plan not found")
    plan.is_active = False
    await db.commit()
    await db.refresh(plan)
    return _plan_out(plan)


# ----------------------------------------------------- subscriptions/payments

@router.get("/subscriptions", response_model=list[AdminSubscriptionOut])
async def admin_subscriptions(
    db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    rows = (
        await db.execute(
            select(Subscription, Organization.name, Plan.name)
            .join(Organization, Organization.id == Subscription.org_id)
            .join(Plan, Plan.id == Subscription.plan_id)
            .order_by(Subscription.created_at.desc())
        )
    ).all()
    return [
        AdminSubscriptionOut(
            id=s.id, org_name=org, plan_name=plan, status=s.status,
            current_period_end=s.current_period_end,
        )
        for s, org, plan in rows
    ]


@router.get("/payments", response_model=list[AdminPaymentOut])
async def admin_payments(
    db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    rows = (
        await db.execute(
            select(Payment, Organization.name)
            .join(Organization, Organization.id == Payment.org_id)
            .order_by(Payment.created_at.desc())
            .limit(200)
        )
    ).all()
    return [
        AdminPaymentOut(
            id=p.id, org_name=org, amount_cents=p.amount_cents, tax_cents=p.tax_cents,
            currency=p.currency, status=p.status, invoice_number=p.invoice_number,
            created_at=p.created_at,
        )
        for p, org in rows
    ]


def _sub_out(s: Subscription, org_name: str, plan_name: str) -> AdminSubscriptionOut:
    return AdminSubscriptionOut(
        id=s.id, org_name=org_name, plan_name=plan_name, status=s.status,
        current_period_end=s.current_period_end,
    )


async def _sub_row(db: AsyncSession, sub: Subscription) -> AdminSubscriptionOut:
    org = await db.get(Organization, sub.org_id)
    plan = await db.get(Plan, sub.plan_id)
    return _sub_out(sub, org.name if org else "", plan.name if plan else "?")


@router.post("/subscriptions", response_model=AdminSubscriptionOut, status_code=status.HTTP_201_CREATED)
async def assign_subscription(
    body: SubscriptionAssign,
    db: AsyncSession = Depends(get_db_session),
    _admin: User = Depends(require_admin),
):
    """Manually grant an org an active subscription to a plan (comp / support)."""
    org = await db.scalar(select(Organization).where(Organization.name == body.org_name.strip()))
    if not org:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
    plan = await db.get(Plan, body.plan_id)
    if not plan:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plan not found")

    now = datetime.now(timezone.utc)
    period_end = now + timedelta(days=body.days or plan.period_days)
    sub = await db.scalar(
        select(Subscription).where(Subscription.org_id == org.id, Subscription.status == "active")
    )
    if sub:
        sub.plan_id = plan.id
        sub.status = "active"
        sub.current_period_end = period_end
    else:
        sub = Subscription(
            org_id=org.id, plan_id=plan.id, status="active",
            started_at=now, current_period_end=period_end,
        )
        db.add(sub)
    org.plan = plan.slug
    await db.commit()
    await db.refresh(sub)
    return await _sub_row(db, sub)


@router.post("/subscriptions/{sub_id}/extend", response_model=AdminSubscriptionOut)
async def extend_subscription(
    sub_id: str,
    body: SubscriptionExtend,
    db: AsyncSession = Depends(get_db_session),
    _admin: User = Depends(require_admin),
):
    sub = await db.get(Subscription, sub_id)
    if not sub:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subscription not found")
    now = datetime.now(timezone.utc)
    base = _aware(sub.current_period_end) or now
    if base < now:
        base = now
    sub.current_period_end = base + timedelta(days=body.days)
    if sub.status in ("expired", "cancelled"):
        sub.status = "active"
    await db.commit()
    await db.refresh(sub)
    return await _sub_row(db, sub)


@router.patch("/subscriptions/{sub_id}", response_model=AdminSubscriptionOut)
async def set_subscription_status(
    sub_id: str,
    body: SubscriptionStatusUpdate,
    db: AsyncSession = Depends(get_db_session),
    _admin: User = Depends(require_admin),
):
    sub = await db.get(Subscription, sub_id)
    if not sub:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subscription not found")
    sub.status = body.status
    await db.commit()
    await db.refresh(sub)
    return await _sub_row(db, sub)


@router.patch("/payments/{payment_id}", response_model=AdminPaymentOut)
async def set_payment_status(
    payment_id: str,
    body: PaymentStatusUpdate,
    db: AsyncSession = Depends(get_db_session),
    _admin: User = Depends(require_admin),
):
    payment = await db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment not found")
    payment.status = body.status
    if body.status == "paid" and not payment.invoice_number:
        payment.invoice_number = f"INV-{datetime.now(timezone.utc):%Y%m%d}-{uuid.uuid4().hex[:6].upper()}"
    await db.commit()
    org = await db.get(Organization, payment.org_id)
    return AdminPaymentOut(
        id=payment.id, org_name=org.name if org else "", amount_cents=payment.amount_cents,
        tax_cents=payment.tax_cents, currency=payment.currency, status=payment.status,
        invoice_number=payment.invoice_number, created_at=payment.created_at,
    )


@router.post("/payments/{payment_id}/refund", response_model=AdminPaymentOut)
async def refund_payment(
    payment_id: str,
    body: RefundRequest,
    db: AsyncSession = Depends(get_db_session),
    _admin: User = Depends(require_admin),
):
    payment = await db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment not found")
    if payment.status != "paid":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only paid payments can be refunded")
    if not payment.razorpay_payment_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No Razorpay payment id on record to refund")
    try:
        await rzp.refund_payment(payment.razorpay_payment_id, body.amount_cents)
    except rzp.RazorpayError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    # Full refund flips the payment; partial stays paid (Razorpay tracks the split).
    if body.amount_cents is None or body.amount_cents >= payment.amount_cents:
        payment.status = "refunded"
        sub = await db.scalar(
            select(Subscription).where(Subscription.org_id == payment.org_id, Subscription.status == "active")
        )
        if sub:
            sub.status = "cancelled"
    await db.commit()
    org = await db.get(Organization, payment.org_id)
    return AdminPaymentOut(
        id=payment.id, org_name=org.name if org else "", amount_cents=payment.amount_cents,
        tax_cents=payment.tax_cents, currency=payment.currency, status=payment.status,
        invoice_number=payment.invoice_number, created_at=payment.created_at,
    )


@router.get("/payments/{payment_id}/invoice")
async def payment_invoice(
    payment_id: str,
    db: AsyncSession = Depends(get_db_session),
    _admin: User = Depends(require_admin),
):
    """Download the GST tax-invoice PDF for a payment."""
    payment = await db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment not found")
    org = await db.get(Organization, payment.org_id)
    buyer = await db.scalar(select(InvoiceAddress).where(InvoiceAddress.org_id == payment.org_id))
    plan = await db.get(Plan, payment.plan_id) if payment.plan_id else None
    buyer_name = (buyer.name if buyer and buyer.name else "") or (org.name if org else "Customer")
    pdf = generate_invoice_pdf(payment, buyer_name, buyer, plan.name if plan else "Subscription")
    fname = f"{payment.invoice_number or payment.id[:8]}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# ---------------------------------------------------------------- site config

async def _get_or_create_settings(db: AsyncSession) -> WebsiteSettings:
    row = await db.scalar(select(WebsiteSettings).limit(1))
    if not row:
        row = WebsiteSettings()
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


@router.get("/settings", response_model=WebsiteSettingsOut)
async def get_settings(db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)):
    return await _get_or_create_settings(db)


@router.put("/settings", response_model=WebsiteSettingsOut)
async def update_settings(
    body: WebsiteSettingsUpdate,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_admin),
):
    row = await _get_or_create_settings(db)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return row


# ------------------------------------------------------------ content mod

# -------- blog categories

@router.get("/blog-categories", response_model=list[BlogCategoryOut])
async def admin_blog_categories(db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)):
    rows = await db.scalars(select(BlogCategory).order_by(BlogCategory.sort_order, BlogCategory.name))
    return list(rows)


@router.post("/blog-categories", response_model=BlogCategoryOut, status_code=status.HTTP_201_CREATED)
async def create_blog_category(
    body: BlogCategoryCreate, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    cat = BlogCategory(name=body.name.strip(), slug=_slugify(body.name), sort_order=body.sort_order)
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


@router.patch("/blog-categories/{cat_id}", response_model=BlogCategoryOut)
async def update_blog_category(
    cat_id: str, body: BlogCategoryUpdate, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    cat = await db.get(BlogCategory, cat_id)
    if not cat:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    if body.name is not None:
        cat.name = body.name.strip()
        cat.slug = _slugify(body.name)
    if body.sort_order is not None:
        cat.sort_order = body.sort_order
    await db.commit()
    await db.refresh(cat)
    return cat


@router.delete("/blog-categories/{cat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_blog_category(
    cat_id: str, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    if await db.scalar(select(func.count(Blog.id)).where(Blog.category_id == cat_id)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Category still has posts — reassign them first")
    cat = await db.get(BlogCategory, cat_id)
    if cat:
        await db.delete(cat)
        await db.commit()


# -------- blog posts

async def _unique_blog_slug(db: AsyncSession, base: str, exclude_id: str | None = None) -> str:
    slug = _slugify(base)
    q = select(Blog.id).where(Blog.slug == slug)
    if exclude_id:
        q = q.where(Blog.id != exclude_id)
    if await db.scalar(q):
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"
    return slug


@router.get("/blogs", response_model=list[AdminBlogOut])
async def admin_blogs(db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)):
    rows = await db.scalars(select(Blog).order_by(Blog.updated_at.desc()))
    return list(rows)


@router.post("/blogs", response_model=AdminBlogDetail, status_code=status.HTTP_201_CREATED)
async def create_blog(
    body: BlogCreate, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    slug = await _unique_blog_slug(db, body.slug or body.title)
    blog = Blog(
        title=body.title.strip(), slug=slug, body_html=body.body_html, excerpt=body.excerpt,
        meta_title=body.meta_title, meta_description=body.meta_description, meta_keywords=body.meta_keywords,
        cover_image_url=body.cover_image_url, image_alt=body.image_alt, author=body.author,
        category_id=body.category_id or None, faqs=[f.model_dump() for f in body.faqs],
        tldr=body.tldr, key_takeaways=list(body.key_takeaways),
        reading_time_minutes=body.reading_time_minutes, is_pillar=body.is_pillar, status=body.status,
        published_at=datetime.now(timezone.utc) if body.status == "published" else None,
    )
    db.add(blog)
    await db.commit()
    await db.refresh(blog)
    return blog


@router.post("/blogs/upload-image", response_model=UploadOut)
async def upload_blog_image(
    file: UploadFile = File(...), _: User = Depends(require_admin)
):
    """Store an uploaded image and return its public /content-assets/ URL."""
    ext = Path(file.filename or "").suffix.lower()
    if ext not in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unsupported image type")
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Image too large (max 8 MB)")
    dest_dir = Path(settings.content_upload_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    (dest_dir / name).write_bytes(data)
    return UploadOut(url=f"/content-assets/uploads/{name}")


@router.get("/blogs/{blog_id}", response_model=AdminBlogDetail)
async def get_blog_admin(
    blog_id: str, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    blog = await db.get(Blog, blog_id)
    if not blog:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    return blog


@router.patch("/blogs/{blog_id}", response_model=AdminBlogDetail)
async def update_blog(
    blog_id: str,
    body: BlogUpdate,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_admin),
):
    blog = await db.get(Blog, blog_id)
    if not blog:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    patch = body.model_dump(exclude_unset=True)
    if "slug" in patch and patch["slug"]:
        blog.slug = await _unique_blog_slug(db, patch.pop("slug"), exclude_id=blog.id)
    else:
        patch.pop("slug", None)
    if "faqs" in patch and patch["faqs"] is not None:
        blog.faqs = [f if isinstance(f, dict) else f.model_dump() for f in patch.pop("faqs")]
    if "status" in patch and patch["status"] == "published" and not blog.published_at:
        blog.published_at = datetime.now(timezone.utc)
    for k, v in patch.items():
        setattr(blog, k, v)
    await db.commit()
    await db.refresh(blog)
    return blog


@router.delete("/blogs/{blog_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_blog(
    blog_id: str, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    blog = await db.get(Blog, blog_id)
    if blog:
        await db.delete(blog)
        await db.commit()


async def _unique_story_slug(db: AsyncSession, base: str, exclude_id: str | None = None) -> str:
    slug = _slugify(base)
    q = select(WebStory.id).where(WebStory.slug == slug)
    if exclude_id:
        q = q.where(WebStory.id != exclude_id)
    if await db.scalar(q):
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"
    return slug


@router.get("/webstories", response_model=list[AdminWebStoryOut])
async def admin_webstories(db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)):
    rows = await db.scalars(select(WebStory).order_by(WebStory.created_at.desc()))
    return list(rows)


@router.post("/webstories", response_model=AdminWebStoryDetail, status_code=status.HTTP_201_CREATED)
async def create_story(
    body: WebStoryCreate, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    slug = await _unique_story_slug(db, body.slug or body.title)
    story = WebStory(
        title=body.title.strip(), slug=slug, meta_description=body.meta_description,
        cover_image_url=body.cover_image_url, slides=[s.model_dump() for s in body.slides],
        status=body.status,
        published_at=datetime.now(timezone.utc) if body.status == "published" else None,
    )
    db.add(story)
    await db.commit()
    await db.refresh(story)
    return story


@router.get("/webstories/{story_id}", response_model=AdminWebStoryDetail)
async def get_story_admin(
    story_id: str, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    story = await db.get(WebStory, story_id)
    if not story:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Story not found")
    return story


@router.patch("/webstories/{story_id}", response_model=AdminWebStoryDetail)
async def update_story(
    story_id: str,
    body: WebStoryUpdate,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_admin),
):
    story = await db.get(WebStory, story_id)
    if not story:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Story not found")
    patch = body.model_dump(exclude_unset=True)
    if "slug" in patch and patch["slug"]:
        story.slug = await _unique_story_slug(db, patch.pop("slug"), exclude_id=story.id)
    else:
        patch.pop("slug", None)
    if "slides" in patch and patch["slides"] is not None:
        story.slides = patch.pop("slides")  # already plain dicts from model_dump
    if "status" in patch and patch["status"] == "published" and not story.published_at:
        story.published_at = datetime.now(timezone.utc)
    for k, v in patch.items():
        setattr(story, k, v)
    await db.commit()
    await db.refresh(story)
    return story


@router.delete("/webstories/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_story(
    story_id: str, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    story = await db.get(WebStory, story_id)
    if story:
        await db.delete(story)
        await db.commit()


# ------------------------------------------------------------ contact inbox

def _csv_response(header: list[str], rows: list[list], filename: str) -> StreamingResponse:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    writer.writerows(rows)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/contact-submissions", response_model=ContactListResponse)
async def list_contact_submissions(
    status_filter: str | None = None,
    q: str | None = None,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_admin),
):
    stmt = select(ContactSubmission).order_by(ContactSubmission.created_at.desc())
    if status_filter in ("new", "read", "responded", "spam"):
        stmt = stmt.where(ContactSubmission.status == status_filter)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(ContactSubmission.name.ilike(like), ContactSubmission.email.ilike(like)))
    items = list(await db.scalars(stmt.limit(500)))

    total = await db.scalar(select(func.count(ContactSubmission.id))) or 0
    new_count = await db.scalar(
        select(func.count(ContactSubmission.id)).where(ContactSubmission.status == "new")
    ) or 0
    responded = await db.scalar(
        select(func.count(ContactSubmission.id)).where(ContactSubmission.status == "responded")
    ) or 0
    today = await db.scalar(
        select(func.count(ContactSubmission.id)).where(ContactSubmission.created_at >= _day_start())
    ) or 0
    return ContactListResponse(
        items=items, total=int(total), new_count=int(new_count),
        responded_count=int(responded), today_count=int(today),
    )


@router.get("/contact-submissions/export")
async def export_contact_submissions(
    status_filter: str | None = None,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_admin),
):
    stmt = select(ContactSubmission).order_by(ContactSubmission.created_at.desc())
    if status_filter in ("new", "read", "responded", "spam"):
        stmt = stmt.where(ContactSubmission.status == status_filter)
    rows = list(await db.scalars(stmt))
    return _csv_response(
        ["ID", "Name", "Email", "Message", "Status", "IP", "Created", "Admin notes"],
        [[r.id, r.name, r.email, r.message, r.status, r.ip, r.created_at.isoformat(), r.admin_notes] for r in rows],
        "contact-submissions.csv",
    )


@router.get("/contact-submissions/{sid}", response_model=ContactSubmissionOut)
async def get_contact_submission(
    sid: str, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    sub = await db.get(ContactSubmission, sid)
    if not sub:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    if sub.status == "new":  # opening it marks it read
        sub.status = "read"
        await db.commit()
        await db.refresh(sub)
    return sub


@router.patch("/contact-submissions/{sid}", response_model=ContactSubmissionOut)
async def update_contact_submission(
    sid: str, body: ContactUpdate, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    sub = await db.get(ContactSubmission, sid)
    if not sub:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    if body.status is not None:
        sub.status = body.status
        if body.status == "responded" and not sub.responded_at:
            sub.responded_at = datetime.now(timezone.utc)
    if body.admin_notes is not None:
        sub.admin_notes = body.admin_notes
    await db.commit()
    await db.refresh(sub)
    return sub


@router.post("/contact-submissions/{sid}/reply", response_model=ContactSubmissionOut)
async def reply_contact_submission(
    sid: str, body: ContactReply, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    sub = await db.get(ContactSubmission, sid)
    if not sub:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    html = body.message.replace("\n", "<br/>")
    sent = await send_email(sub.email, body.subject, html, email_type="contact_reply", to_name=sub.name)
    if not sent:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Email transport is not configured or the send failed.")
    sub.status = "responded"
    sub.responded_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(sub)
    return sub


@router.delete("/contact-submissions/{sid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact_submission(
    sid: str, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    sub = await db.get(ContactSubmission, sid)
    if sub:
        await db.delete(sub)
        await db.commit()


# --------------------------------------------------------------- email logs

def _email_filtered(stmt, type_filter, status_filter, q, days):
    if type_filter:
        stmt = stmt.where(EmailLog.email_type == type_filter)
    if status_filter in ("sent", "failed"):
        stmt = stmt.where(EmailLog.status == status_filter)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(EmailLog.to_email.ilike(like), EmailLog.subject.ilike(like)))
    if days:
        stmt = stmt.where(EmailLog.created_at >= datetime.now(timezone.utc) - timedelta(days=days))
    return stmt


@router.get("/email-logs", response_model=EmailLogListResponse)
async def list_email_logs(
    type_filter: str | None = None,
    status_filter: str | None = None,
    q: str | None = None,
    days: int = 90,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_admin),
):
    stmt = _email_filtered(select(EmailLog), type_filter, status_filter, q, days).order_by(
        EmailLog.created_at.desc()
    )
    items = list(await db.scalars(stmt.limit(500)))
    total = await db.scalar(select(func.count(EmailLog.id))) or 0
    sent = await db.scalar(select(func.count(EmailLog.id)).where(EmailLog.status == "sent")) or 0
    failed = await db.scalar(select(func.count(EmailLog.id)).where(EmailLog.status == "failed")) or 0
    today = await db.scalar(
        select(func.count(EmailLog.id)).where(EmailLog.created_at >= _day_start())
    ) or 0
    types = [t for (t,) in await db.execute(select(EmailLog.email_type).distinct())]
    return EmailLogListResponse(
        items=items, total=int(total), sent_count=int(sent), failed_count=int(failed),
        today_count=int(today), types=sorted(types),
    )


@router.get("/email-logs/export")
async def export_email_logs(
    type_filter: str | None = None,
    status_filter: str | None = None,
    q: str | None = None,
    days: int = 90,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_admin),
):
    stmt = _email_filtered(select(EmailLog), type_filter, status_filter, q, days).order_by(
        EmailLog.created_at.desc()
    )
    rows = list(await db.scalars(stmt))
    return _csv_response(
        ["ID", "To", "Name", "Type", "Subject", "Status", "Error", "Created"],
        [[r.id, r.to_email, r.to_name, r.email_type, r.subject, r.status, r.error, r.created_at.isoformat()] for r in rows],
        "email-logs.csv",
    )


@router.get("/email-logs/{log_id}", response_model=EmailLogOut)
async def get_email_log(
    log_id: str, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    row = await db.get(EmailLog, log_id)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Log not found")
    return row


@router.post("/email-logs/{log_id}/retry", response_model=EmailLogOut)
async def retry_email(
    log_id: str, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    row = await db.get(EmailLog, log_id)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Log not found")
    if row.status != "failed":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only failed emails can be retried")
    html = (row.meta or {}).get("html", "")
    ok = await send_email(
        row.to_email, f"[RETRY] {row.subject}", html,
        email_type=row.email_type, to_name=row.to_name, user_id=row.user_id,
    )
    if not ok:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Retry send failed (transport not configured?).")
    await db.refresh(row)
    return row


# ------------------------------------------------- scheduled (recurring) emails


def _scheduled_email_out(s: Schedule, owner_email: str) -> ScheduledEmailOut:
    p = s.params or {}
    return ScheduledEmailOut(
        id=s.id,
        recipient=(p.get("email") or owner_email or "").strip(),
        owner_email=owner_email,
        domain=(p.get("domain") or "").strip() or "site",
        keyword=(p.get("keyword") or None),
        frequency=s.frequency,
        next_run_at=s.next_run_at,
        last_run_at=s.last_run_at,
        last_status=s.last_status,
    )


@router.get("/scheduled-emails", response_model=ScheduledEmailListResponse)
async def list_scheduled_emails(
    db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    """Active recurring report schedules platform-wide — each emails its result on run."""
    rows = list(
        await db.scalars(
            select(Schedule).where(Schedule.active.is_(True)).order_by(Schedule.next_run_at.asc())
        )
    )
    user_ids = {s.user_id for s in rows}
    owners: dict[str, str] = {}
    if user_ids:
        owners = {u.id: u.email for u in await db.scalars(select(User).where(User.id.in_(user_ids)))}
    items = [_scheduled_email_out(s, owners.get(s.user_id, "")) for s in rows]
    return ScheduledEmailListResponse(items=items, total=len(items))


@router.post("/scheduled-emails/{schedule_id}/cancel", response_model=ScheduledEmailOut)
async def cancel_scheduled_email(
    schedule_id: str, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    """Cancel a scheduled email — deactivate the schedule so it stops sending."""
    s = await db.get(Schedule, schedule_id)
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scheduled email not found")
    s.active = False
    owner = await db.get(User, s.user_id)
    await db.commit()
    await db.refresh(s)
    return _scheduled_email_out(s, owner.email if owner else "")


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


# ---------------------------------------------------- roles & permissions (RBAC)

def _role_out(u: User) -> AdminRoleOut:
    return AdminRoleOut(
        id=u.id, email=u.email, full_name=u.full_name, is_super=is_super_admin(u),
        is_active=u.is_active, permissions=effective_permissions(u), created_at=u.created_at,
    )


@router.get("/me", response_model=AdminMeOut)
async def admin_me(admin: User = Depends(require_admin)) -> AdminMeOut:
    """The signed-in admin's effective permissions — the frontend gates tabs on this."""
    return AdminMeOut(
        email=admin.email,
        is_super=is_super_admin(admin),
        permissions=effective_permissions(admin),
        all_permissions=list(ADMIN_PERMISSIONS),
    )


@router.get("/roles", response_model=list[AdminRoleOut])
async def list_roles(db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)):
    supers = settings.admin_email_list
    rows = await db.scalars(
        select(User).where(or_(User.is_staff.is_(True), User.email.in_(supers))).order_by(User.created_at)
    )
    return [_role_out(u) for u in rows]


@router.post("/roles", response_model=AdminRoleOut, status_code=status.HTTP_201_CREATED)
async def create_role(
    body: AdminRoleCreate, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    """Grant admin access: promotes an existing user, or creates a new admin account."""
    perms = [p for p in body.permissions if p in ADMIN_PERMISSIONS]
    existing = await db.scalar(select(User).where(User.email == body.email.lower()))
    if existing:
        if is_super_admin(existing):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This is a super-admin (ADMIN_EMAILS) — permissions are all-access by config.")
        existing.is_staff = True
        existing.admin_permissions = perms
        user = existing
    else:
        if not body.password or len(body.password) < 8:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "A password (min 8 chars) is required to create a new admin.")
        org = Organization(name=body.full_name.strip() or body.email, monthly_quota_cents=settings.default_org_quota_cents)
        db.add(org)
        await db.flush()
        user = User(
            email=body.email.lower(), hashed_password=hash_password(body.password),
            full_name=body.full_name.strip(), org_id=org.id, role="owner",
            is_verified=True, is_staff=True, admin_permissions=perms,
        )
        db.add(user)
    await db.commit()
    await db.refresh(user)
    return _role_out(user)


@router.patch("/roles/{user_id}", response_model=AdminRoleOut)
async def update_role(
    user_id: str, body: AdminRoleUpdate, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    user = await db.get(User, user_id)
    if not user or not (user.is_staff or is_super_admin(user)):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not an admin")
    if is_super_admin(user):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Super-admins are managed via ADMIN_EMAILS, not here.")
    if body.permissions is not None:
        user.admin_permissions = [p for p in body.permissions if p in ADMIN_PERMISSIONS]
        user.is_staff = True
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.full_name is not None:
        user.full_name = body.full_name.strip()
    await db.commit()
    await db.refresh(user)
    return _role_out(user)


@router.delete("/roles/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_role(
    user_id: str, db: AsyncSession = Depends(get_db_session), admin: User = Depends(require_admin)
):
    """Revoke a staff admin's access (the user account itself is kept)."""
    if user_id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot revoke your own admin access")
    user = await db.get(User, user_id)
    if not user:
        return
    if is_super_admin(user):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Super-admins are defined in ADMIN_EMAILS and can't be revoked here.")
    user.is_staff = False
    user.admin_permissions = []
    await db.commit()
