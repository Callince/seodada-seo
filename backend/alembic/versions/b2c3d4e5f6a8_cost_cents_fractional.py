"""cost_cents -> float (DataForSEO bills below a cent)

An AI Overview call costs $0.002 = 0.2 cents. Integer cents rounded that to 0,
so those calls recorded as free and their spend never reached the usage log or
the admin spend report. Widen the two DataForSEO cost columns to float.

Only api_cache.cost_cents and usage_log.cost_cents change: they hold DataForSEO
USD costs. Payment/Plan `*_cents` are INR money and stay integers.

Revision ID: b2c3d4e5f6a8
Revises: f0a1b2c3d4e5
Create Date: 2026-07-17
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "b2c3d4e5f6a8"
down_revision = "f0a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # batch_alter_table so SQLite (dev) rebuilds the table — it cannot ALTER a
    # column type in place. Postgres does a plain ALTER.
    with op.batch_alter_table("api_cache") as batch:
        batch.alter_column(
            "cost_cents", existing_type=sa.Integer(), type_=sa.Float(), existing_nullable=False,
        )
    with op.batch_alter_table("usage_log") as batch:
        batch.alter_column(
            "cost_cents", existing_type=sa.Integer(), type_=sa.Float(), existing_nullable=False,
        )


def downgrade() -> None:
    # Lossy by nature: sub-cent costs collapse back to 0, which is the bug this
    # migration exists to fix.
    with op.batch_alter_table("usage_log") as batch:
        batch.alter_column(
            "cost_cents", existing_type=sa.Float(), type_=sa.Integer(), existing_nullable=False,
        )
    with op.batch_alter_table("api_cache") as batch:
        batch.alter_column(
            "cost_cents", existing_type=sa.Float(), type_=sa.Integer(), existing_nullable=False,
        )
