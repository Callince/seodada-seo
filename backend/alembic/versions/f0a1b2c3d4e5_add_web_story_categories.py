"""add web_story_categories + web_stories.category_id

Revision ID: f0a1b2c3d4e5
Revises: e9f0a1b2c3d4
Create Date: 2026-07-16
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "f0a1b2c3d4e5"
down_revision = "e9f0a1b2c3d4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "web_story_categories",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_web_story_categories_slug", "web_story_categories", ["slug"])
    # Nullable: existing stories stay uncategorised until an admin assigns one.
    # batch_alter_table so SQLite (dev) can add the FK too — it has no
    # ALTER TABLE ... ADD CONSTRAINT and needs a table rebuild.
    with op.batch_alter_table("web_stories") as batch:
        batch.add_column(sa.Column("category_id", sa.String(36), nullable=True))
        batch.create_foreign_key(
            "fk_web_stories_category_id", "web_story_categories", ["category_id"], ["id"]
        )
    op.create_index("ix_web_stories_category_id", "web_stories", ["category_id"])


def downgrade() -> None:
    op.drop_index("ix_web_stories_category_id", table_name="web_stories")
    with op.batch_alter_table("web_stories") as batch:
        batch.drop_constraint("fk_web_stories_category_id", type_="foreignkey")
        batch.drop_column("category_id")
    op.drop_index("ix_web_story_categories_slug", table_name="web_story_categories")
    op.drop_table("web_story_categories")
