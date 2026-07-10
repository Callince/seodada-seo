"""Billing service — plans, Razorpay checkout, activation, and webhooks.

Prices are GST-inclusive: the plan's `price_cents` is what the customer pays and
already contains 18% GST (CGST 9% + SGST 9%, digital-services SAC 998314). The
tax is extracted for the invoice, never added on top — so customers pay exactly
the price shown on the pricing page.

Activation is idempotent and happens on either path: the checkout callback
(`confirm_payment`, signature-verified) or the Razorpay webhook (`handle_webhook`,
the reliable server-to-server path). Whichever lands first activates; the second
is a no-op.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import log
from app.db.models import Organization, Payment, Plan, Subscription, User
from app.integrations.razorpay import client as rzp

GST_RATE = Decimal("0.18")


def gst_breakdown(total_cents: int) -> dict:
    """Split a GST-inclusive total (minor units) into base + CGST + SGST."""
    total = Decimal(total_cents)
    base = (total / (1 + GST_RATE)).quantize(Decimal("1"), ROUND_HALF_UP)
    tax = total - base
    cgst = (tax / 2).quantize(Decimal("1"), ROUND_HALF_UP)
    return {
        "base_cents": int(base),
        "tax_cents": int(tax),
        "cgst_cents": int(cgst),
        "sgst_cents": int(tax - cgst),
    }


def _invoice_no() -> str:
    return f"INV-{datetime.now(timezone.utc):%Y%m%d}-{uuid.uuid4().hex[:6].upper()}"


async def list_plans(db: AsyncSession) -> list[Plan]:
    rows = await db.scalars(
        select(Plan).where(Plan.is_active).order_by(Plan.sort_order, Plan.price_cents)
    )
    return list(rows)


async def get_current_subscription(db: AsyncSession, org_id: str) -> Subscription | None:
    now = datetime.now(timezone.utc)
    sub = await db.scalar(
        select(Subscription)
        .where(Subscription.org_id == org_id, Subscription.status == "active")
        .order_by(Subscription.created_at.desc())
    )
    if sub and sub.current_period_end and _aware(sub.current_period_end) < now:
        return None  # lapsed
    return sub


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def create_checkout(db: AsyncSession, user: User, plan_slug: str) -> dict:
    """Create a Razorpay order for a plan and a pending Payment row."""
    plan = await db.scalar(select(Plan).where(Plan.slug == plan_slug, Plan.is_active))
    if not plan:
        raise ValueError("Unknown or inactive plan.")

    order = await rzp.create_order(
        amount_cents=plan.price_cents,
        currency=plan.currency,
        receipt=f"org_{user.org_id[:8]}_{plan.slug}",
        notes={"org_id": user.org_id, "plan_id": plan.id, "plan": plan.name},
    )
    gst = gst_breakdown(plan.price_cents)
    db.add(Payment(
        org_id=user.org_id, plan_id=plan.id, razorpay_order_id=order["id"],
        amount_cents=plan.price_cents, tax_cents=gst["tax_cents"], currency=plan.currency,
        status="created", invoice_number=_invoice_no(),
    ))
    await db.commit()
    return {
        "order_id": order["id"],
        "amount": plan.price_cents,
        "currency": plan.currency,
        "key_id": rzp.settings.razorpay_key_id,
        "plan_name": plan.name,
        "plan_slug": plan.slug,
    }


async def _mark_paid_and_activate(db: AsyncSession, payment: Payment, payment_id: str) -> Subscription:
    """Idempotently mark a Payment paid and (re)activate the org's subscription."""
    plan = await db.get(Plan, payment.plan_id)
    if payment.status != "paid":
        payment.status = "paid"
        payment.razorpay_payment_id = payment_id or payment.razorpay_payment_id

    now = datetime.now(timezone.utc)
    sub = await db.scalar(
        select(Subscription).where(
            Subscription.org_id == payment.org_id, Subscription.status == "active"
        )
    )
    # Extend from the later of now / current end so re-purchases stack cleanly.
    base = now
    if sub and sub.current_period_end and _aware(sub.current_period_end) > now:
        base = _aware(sub.current_period_end)
    period_end = base + timedelta(days=plan.period_days if plan else 30)

    if sub:
        sub.plan_id = payment.plan_id
        sub.current_period_end = period_end
        sub.status = "active"
    else:
        sub = Subscription(
            org_id=payment.org_id, plan_id=payment.plan_id, status="active",
            started_at=now, current_period_end=period_end,
        )
        db.add(sub)

    org = await db.get(Organization, payment.org_id)
    if org and plan:
        org.plan = plan.slug
    await db.commit()
    await db.refresh(sub)
    return sub


async def confirm_payment(
    db: AsyncSession, user: User, order_id: str, payment_id: str, signature: str
) -> Subscription:
    """Checkout callback — verify the signature, then activate."""
    if not rzp.verify_payment_signature(order_id, payment_id, signature):
        raise PermissionError("Payment signature verification failed.")
    payment = await db.scalar(
        select(Payment).where(
            Payment.razorpay_order_id == order_id, Payment.org_id == user.org_id
        )
    )
    if not payment:
        raise ValueError("No matching order for this account.")
    return await _mark_paid_and_activate(db, payment, payment_id)


async def handle_webhook(db: AsyncSession, event: dict) -> None:
    """Razorpay webhook (already signature-verified by the router). Idempotent."""
    kind = event.get("event", "")
    entity = (((event.get("payload") or {}).get("payment") or {}).get("entity")) or {}
    order_id = entity.get("order_id", "")
    payment_id = entity.get("id", "")
    if not order_id:
        return
    payment = await db.scalar(select(Payment).where(Payment.razorpay_order_id == order_id))
    if not payment:
        return

    if kind in ("payment.captured", "payment.authorized"):
        if payment.status != "paid":
            await _mark_paid_and_activate(db, payment, payment_id)
            log.info("billing_webhook_activated", order=order_id, org=payment.org_id)
    elif kind == "payment.failed":
        if payment.status == "created":
            payment.status = "failed"
            await db.commit()
