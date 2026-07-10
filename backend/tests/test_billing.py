"""Billing — GST split, Razorpay signature verification, and activation.

The signature checks are the security boundary; a tampered order/payment/body
must fail. Activation is exercised directly (no live Razorpay calls).
"""
from __future__ import annotations

import hashlib
import hmac
from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.api.v1 import auth as auth_api
from app.core import config
from app.db.models import Organization, Payment, Plan, Subscription
from app.integrations.razorpay import client as rzp
from app.services import billing


def _sig(message: str, secret: str) -> str:
    return hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()


# ------------------------------------------------------------------------ GST

def test_gst_breakdown_is_inclusive_and_balances():
    for total in (79900, 499900, 899900, 12345):
        g = billing.gst_breakdown(total)
        assert g["base_cents"] + g["tax_cents"] == total          # inclusive
        assert g["cgst_cents"] + g["sgst_cents"] == g["tax_cents"]  # 9% + 9%
        # ~18% tax on the base (allow ±1 for rounding).
        assert abs(g["tax_cents"] - round(g["base_cents"] * 0.18)) <= 1


# ---------------------------------------------------------------- signatures

def test_payment_signature_valid_and_tampered(monkeypatch):
    monkeypatch.setattr(config.settings, "razorpay_key_secret", "keysecret")
    sig = _sig("order_1|pay_1", "keysecret")
    assert rzp.verify_payment_signature("order_1", "pay_1", sig) is True
    assert rzp.verify_payment_signature("order_1", "pay_EVIL", sig) is False
    assert rzp.verify_payment_signature("order_1", "pay_1", "deadbeef") is False


def test_webhook_signature_valid_and_tampered(monkeypatch):
    monkeypatch.setattr(config.settings, "razorpay_webhook_secret", "whsecret")
    body = b'{"event":"payment.captured"}'
    sig = _sig(body.decode(), "whsecret")
    assert rzp.verify_webhook_signature(body, sig) is True
    assert rzp.verify_webhook_signature(b'{"event":"tampered"}', sig) is False


# --------------------------------------------------------------- activation

async def _seed(db):
    user = await auth_api._upsert_google_user(db, "buyer@test.com", "Buyer")
    plan = Plan(name="Pro", slug="pro", price_cents=499900, usage_per_day=50, tier=2, period_days=30)
    db.add(plan)
    await db.flush()
    pay = Payment(
        org_id=user.org_id, plan_id=plan.id, razorpay_order_id="order_1",
        amount_cents=plan.price_cents, status="created",
    )
    db.add(pay)
    await db.commit()
    return user, plan


@pytest.mark.asyncio
async def test_confirm_payment_activates_subscription(db, monkeypatch):
    monkeypatch.setattr(config.settings, "razorpay_key_secret", "keysecret")
    user, plan = await _seed(db)
    sig = _sig("order_1|pay_1", "keysecret")

    sub = await billing.confirm_payment(db, user, "order_1", "pay_1", sig)

    assert sub.status == "active"
    assert sub.current_period_end and billing._aware(sub.current_period_end) > datetime.now(timezone.utc)
    pay = await db.scalar(select(Payment).where(Payment.razorpay_order_id == "order_1"))
    assert pay.status == "paid"
    org = await db.get(Organization, user.org_id)
    assert org.plan == "pro"


@pytest.mark.asyncio
async def test_confirm_payment_rejects_bad_signature(db, monkeypatch):
    monkeypatch.setattr(config.settings, "razorpay_key_secret", "keysecret")
    user, _ = await _seed(db)
    with pytest.raises(PermissionError):
        await billing.confirm_payment(db, user, "order_1", "pay_1", "forged")


def test_invoice_pdf_renders():
    from datetime import datetime, timezone
    from types import SimpleNamespace

    from app.services import invoices

    pay = SimpleNamespace(
        id="abcdef12", amount_cents=79900, tax_cents=12188,
        invoice_number="INV-20260707-A1B2C3", status="paid",
        created_at=datetime.now(timezone.utc), plan_id="p",
    )
    pdf = invoices.generate_invoice_pdf(pay, "Acme Corp", None, "Basic")
    assert pdf[:5] == b"%PDF-" and len(pdf) > 1000


@pytest.mark.asyncio
async def test_webhook_activates_and_is_idempotent(db, monkeypatch):
    monkeypatch.setattr(config.settings, "razorpay_key_secret", "keysecret")
    user, _ = await _seed(db)
    event = {
        "event": "payment.captured",
        "payload": {"payment": {"entity": {"order_id": "order_1", "id": "pay_1"}}},
    }
    await billing.handle_webhook(db, event)
    subs = list(await db.scalars(select(Subscription).where(Subscription.org_id == user.org_id)))
    assert len(subs) == 1 and subs[0].status == "active"

    # Second delivery must not create a second subscription.
    await billing.handle_webhook(db, event)
    subs = list(await db.scalars(select(Subscription).where(Subscription.org_id == user.org_id)))
    assert len(subs) == 1
