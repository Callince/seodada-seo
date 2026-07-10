"""add website_settings table

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-07-07
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "e6f7a8b9c0d1"
down_revision = "d5e6f7a8b9c0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "website_settings",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("company_name", sa.String(length=255), nullable=False, server_default="seodada"),
        sa.Column("support_email", sa.String(length=255), nullable=False, server_default="support@seodada.com"),
        sa.Column("tagline", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("logo_url", sa.String(length=1000), nullable=False, server_default=""),
        sa.Column("favicon_url", sa.String(length=1000), nullable=False, server_default=""),
        sa.Column("facebook_url", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("linkedin_url", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("instagram_url", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("youtube_url", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("website_settings")
