"""add billing tables (plans, subscriptions, payments, invoice_addresses) + seed plans

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-07
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op

revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None

_JSON = sa.JSON().with_variant(sa.dialects.postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    plans = op.create_table(
        "plans",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False, unique=True),
        sa.Column("price_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="INR"),
        sa.Column("period_days", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("usage_per_day", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tier", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("features", _JSON, nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "subscriptions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("plan_id", sa.String(length=36), sa.ForeignKey("plans.id"), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("razorpay_subscription_id", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_subscriptions_org_id", "subscriptions", ["org_id"])

    op.create_table(
        "payments",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("plan_id", sa.String(length=36), sa.ForeignKey("plans.id"), nullable=True),
        sa.Column("razorpay_order_id", sa.String(length=64), nullable=False),
        sa.Column("razorpay_payment_id", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("tax_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="INR"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="created"),
        sa.Column("invoice_number", sa.String(length=40), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_payments_org_id", "payments", ["org_id"])
    op.create_index("ix_payments_razorpay_order_id", "payments", ["razorpay_order_id"])

    op.create_table(
        "invoice_addresses",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.id"), nullable=False, unique=True),
        sa.Column("name", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("company", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("gstin", sa.String(length=20), nullable=False, server_default=""),
        sa.Column("address", sa.Text(), nullable=False, server_default=""),
        sa.Column("city", sa.String(length=100), nullable=False, server_default=""),
        sa.Column("state", sa.String(length=100), nullable=False, server_default=""),
        sa.Column("state_code", sa.String(length=3), nullable=False, server_default=""),
        sa.Column("pincode", sa.String(length=12), nullable=False, server_default=""),
        sa.Column("country", sa.String(length=100), nullable=False, server_default="India"),
    )

    # Seed the real seodada plans (prices in paise; ₹799/₹4999/₹8999).
    now = datetime.now(timezone.utc)
    op.bulk_insert(
        plans,
        [
            {"id": str(uuid.uuid4()), "name": "Basic", "slug": "basic", "price_cents": 79900,
             "currency": "INR", "period_days": 30, "usage_per_day": 30, "tier": 1, "sort_order": 1,
             "features": ["Full SEO analytics suite", "30 analyses/day", "Site audit", "AI advisor"],
             "is_active": True, "created_at": now},
            {"id": str(uuid.uuid4()), "name": "Pro", "slug": "pro", "price_cents": 499900,
             "currency": "INR", "period_days": 30, "usage_per_day": 50, "tier": 2, "sort_order": 2,
             "features": ["Everything in Basic", "50 analyses/day", "Rank tracking", "AI content factory"],
             "is_active": True, "created_at": now},
            {"id": str(uuid.uuid4()), "name": "Premium", "slug": "premium", "price_cents": 899900,
             "currency": "INR", "period_days": 30, "usage_per_day": 100, "tier": 3, "sort_order": 3,
             "features": ["Everything in Pro", "100 analyses/day", "Priority support", "GST invoices"],
             "is_active": True, "created_at": now},
        ],
    )


def downgrade() -> None:
    op.drop_table("invoice_addresses")
    op.drop_table("payments")
    op.drop_table("subscriptions")
    op.drop_table("plans")
