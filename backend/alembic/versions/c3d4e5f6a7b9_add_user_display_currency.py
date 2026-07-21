"""Add users.display_currency (display-only preference).

Revision ID: c3d4e5f6a7b9
Revises: b2c3d4e5f6a8
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "c3d4e5f6a7b9"
down_revision = "b2c3d4e5f6a8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Empty string, not "INR", is the default on purpose: it means "not chosen"
    # and lets the UI fall back to the billing currency without pretending the
    # user made a decision. Money itself is NOT stored in this currency —
    # amounts stay in INR minor units to match what Razorpay actually charges.
    op.add_column(
        "users",
        sa.Column("display_currency", sa.String(3), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("users", "display_currency")
