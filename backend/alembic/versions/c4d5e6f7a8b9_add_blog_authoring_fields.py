"""add blog authoring fields (tldr, key takeaways, reading time, pillar, image alt)

Revision ID: c4d5e6f7a8b9
Revises: b0c1d2e3f4a5
Create Date: 2026-07-13

"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# JSONB on Postgres, plain JSON on SQLite (dev) — matches app.db.models.JsonType.
_JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")

revision = "c4d5e6f7a8b9"
down_revision = "b0c1d2e3f4a5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("blogs", sa.Column("image_alt", sa.String(length=500), nullable=False, server_default=""))
    op.add_column("blogs", sa.Column("tldr", sa.Text(), nullable=False, server_default=""))
    op.add_column("blogs", sa.Column("key_takeaways", _JSON, nullable=True))
    op.add_column("blogs", sa.Column("reading_time_minutes", sa.Integer(), nullable=False, server_default="0"))
    # Boolean default must be a real boolean literal on Postgres, not an integer.
    op.add_column("blogs", sa.Column("is_pillar", sa.Boolean(), nullable=False, server_default=sa.text("false")))


def downgrade() -> None:
    op.drop_column("blogs", "is_pillar")
    op.drop_column("blogs", "reading_time_minutes")
    op.drop_column("blogs", "key_takeaways")
    op.drop_column("blogs", "tldr")
    op.drop_column("blogs", "image_alt")
