"""add users.unlimited_usage (admin-granted quota exemption)

Revision ID: e9f0a1b2c3d4
Revises: d8e9f0a1b2c3
Create Date: 2026-07-15
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "e9f0a1b2c3d4"
down_revision = "d8e9f0a1b2c3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("unlimited_usage", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    # Existing accounts predate per-user quotas and were using the app while the
    # global quota was off — grandfather them in as unlimited. New signups
    # default to the normal daily allowance.
    op.execute("UPDATE users SET unlimited_usage = true")


def downgrade() -> None:
    op.drop_column("users", "unlimited_usage")
