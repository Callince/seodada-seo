from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class PlanOut(BaseModel):
    id: str
    name: str
    slug: str
    price_cents: int
    currency: str
    period_days: int
    usage_per_day: int
    tier: int
    features: list[str] = []


class SubscriptionOut(BaseModel):
    id: str
    plan_slug: str
    plan_name: str
    status: str
    current_period_end: datetime | None = None


class CheckoutRequest(BaseModel):
    plan_slug: str


class CheckoutResponse(BaseModel):
    order_id: str
    amount: int
    currency: str
    key_id: str
    plan_name: str
    plan_slug: str


class VerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class PaymentOut(BaseModel):
    id: str
    razorpay_order_id: str
    amount_cents: int
    tax_cents: int
    currency: str
    status: str
    invoice_number: str
    created_at: datetime
