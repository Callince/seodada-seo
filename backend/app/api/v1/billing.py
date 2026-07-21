"""Billing API — plans, checkout, payment verification, subscription + history.

Public: `/public/plans` (drives the pricing page). Authed: checkout + verify +
current subscription + payment history, all org-scoped.
"""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, get_db_session
from app.db.models import InvoiceAddress, Organization, Payment, Plan, User
from app.services import invoices
from app.integrations.razorpay.client import RazorpayError, RazorpayNotConfigured, is_configured
from app.schemas.billing import (
    CheckoutRequest,
    CheckoutResponse,
    PaymentOut,
    PlanOut,
    SubscriptionOut,
    VerifyRequest,
)
from app.services import billing

router = APIRouter()
public_router = APIRouter()


def _sub_out(sub, plan: Plan) -> SubscriptionOut:
    return SubscriptionOut(
        id=sub.id, plan_slug=plan.slug if plan else "", plan_name=plan.name if plan else "",
        status=sub.status, current_period_end=sub.current_period_end,
    )


@public_router.get("/plans", response_model=list[PlanOut])
async def public_plans(db: AsyncSession = Depends(get_db_session)):
    return await billing.list_plans(db)


@router.get("/plans", response_model=list[PlanOut])
async def plans(db: AsyncSession = Depends(get_db_session), _: User = Depends(current_user)):
    return await billing.list_plans(db)


@router.get("/subscription", response_model=SubscriptionOut | None)
async def subscription(
    db: AsyncSession = Depends(get_db_session), user: User = Depends(current_user)
):
    sub = await billing.get_current_subscription(db, user.org_id)
    if not sub:
        return None
    plan = await db.get(Plan, sub.plan_id)
    return _sub_out(sub, plan)


@router.post("/checkout", response_model=CheckoutResponse)
async def checkout(
    body: CheckoutRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
):
    if not is_configured():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Billing is not configured.")
    try:
        return await billing.create_checkout(db, user, body.plan_slug)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except (RazorpayError, RazorpayNotConfigured) as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc


@router.post("/verify", response_model=SubscriptionOut)
async def verify(
    body: VerifyRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
):
    try:
        sub = await billing.confirm_payment(
            db, user, body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature
        )
    except PermissionError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    plan = await db.get(Plan, sub.plan_id)
    return _sub_out(sub, plan)


@router.get("/payments", response_model=list[PaymentOut])
async def payment_history(
    db: AsyncSession = Depends(get_db_session), user: User = Depends(current_user)
):
    rows = await db.scalars(
        select(Payment).where(Payment.org_id == user.org_id).order_by(Payment.created_at.desc())
    )
    return list(rows)


@router.get("/payments/{payment_id}/invoice")
async def payment_invoice(
    payment_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
):
    """Download the GST tax invoice for a paid payment (PDF)."""
    payment = await db.scalar(
        select(Payment).where(Payment.id == payment_id, Payment.org_id == user.org_id)
    )
    if not payment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment not found")
    if payment.status != "paid":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No invoice for an unpaid order")

    org = await db.get(Organization, user.org_id)
    buyer = await db.scalar(select(InvoiceAddress).where(InvoiceAddress.org_id == user.org_id))
    plan = await db.get(Plan, payment.plan_id) if payment.plan_id else None
    # reportlab is CPU-bound — keep it off the event loop.
    pdf = await asyncio.to_thread(
        invoices.generate_invoice_pdf,
        payment, buyer_name=(org.name if org else user.email), buyer=buyer,
        plan_name=plan.name if plan else "Subscription",
    )
    filename = f"{payment.invoice_number or payment.id[:8]}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
