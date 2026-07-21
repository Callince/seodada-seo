"""Move display currency from per-user to site-wide (admin-controlled).

Revision ID: d4e5f6a7b8c1
Revises: c3d4e5f6a7b9
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "d4e5f6a7b8c1"
down_revision = "c3d4e5f6a7b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Site-wide display currency. "" = show the billing currency (INR) as-is.
    op.add_column(
        "website_settings",
        sa.Column("display_currency", sa.String(3), nullable=False, server_default=""),
    )
    # The per-user preference is gone as a concept, so the column goes with it
    # rather than lingering as a field nothing reads. Dropping loses only
    # display preferences — no money, no history: amounts have always been
    # stored in INR minor units and are unaffected.
    op.drop_column("users", "display_currency")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("display_currency", sa.String(3), nullable=False, server_default=""),
    )
    op.drop_column("website_settings", "display_currency")
