"""add device column to rank_snapshots

Revision ID: 8f3c2a91d4e7
Revises: 6d95e7b906a4
Create Date: 2026-06-12
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "8f3c2a91d4e7"
down_revision = "6d95e7b906a4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "rank_snapshots",
        sa.Column("device", sa.String(length=10), nullable=False, server_default="desktop"),
    )


def downgrade() -> None:
    op.drop_column("rank_snapshots", "device")
