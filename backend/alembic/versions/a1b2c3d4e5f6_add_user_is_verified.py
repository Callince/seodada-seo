"""add is_verified column to users

Revision ID: a1b2c3d4e5f6
Revises: 8f3c2a91d4e7
Create Date: 2026-07-07
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "a1b2c3d4e5f6"
down_revision = "8f3c2a91d4e7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Existing accounts predate email verification — treat them as verified so
    # nobody is locked out; new accounts set the flag explicitly in the app.
    op.add_column(
        "users",
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )


def downgrade() -> None:
    op.drop_column("users", "is_verified")
