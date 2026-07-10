"""add admin RBAC columns to users

Revision ID: b0c1d2e3f4a5
Revises: a9b0c1d2e3f4
Create Date: 2026-07-08

"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "b0c1d2e3f4a5"
down_revision = "a9b0c1d2e3f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_staff", sa.Boolean(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("admin_permissions", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "admin_permissions")
    op.drop_column("users", "is_staff")
