"""Admin: plans, subscriptions, payments, refunds, invoice PDFs."""
from __future__ import annotations


import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_db_session,
    require_admin,
)
from app.db.models import (
    InvoiceAddress,
    Organization,
    Payment,
    Plan,
    Subscription,
    User,
)
from app.integrations.razorpay import client as rzp
from app.schemas.admin import (
    AdminPaymentOut,
    AdminSubscriptionOut,
    PaymentStatusUpdate,
    PlanAdminOut,
    PlanCreate,
    PlanUpdate,
    RefundRequest,
    SubscriptionAssign,
    SubscriptionExtend,
    SubscriptionStatusUpdate,
)
from app.services.invoices import generate_invoice_pdf
from app.api.v1.admin._shared import _aware, _slugify

router = APIRouter()


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
    # reportlab is CPU-bound — keep it off the event loop.
    pdf = await asyncio.to_thread(
        generate_invoice_pdf, payment, buyer_name, buyer, plan.name if plan else "Subscription"
    )
    fname = f"{payment.invoice_number or payment.id[:8]}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


