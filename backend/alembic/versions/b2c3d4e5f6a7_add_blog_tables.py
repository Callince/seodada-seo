"""add blog + blog_categories tables (AI content factory)

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-07
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None

_JSON = sa.JSON().with_variant(sa.dialects.postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "blog_categories",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_blogcat_org_slug", "blog_categories", ["org_id", "slug"])
    op.create_index("ix_blog_categories_org_id", "blog_categories", ["org_id"])

    op.create_table(
        "blogs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("category_id", sa.String(length=36), sa.ForeignKey("blog_categories.id"), nullable=True),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("meta_title", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("meta_description", sa.Text(), nullable=False, server_default=""),
        sa.Column("excerpt", sa.Text(), nullable=False, server_default=""),
        sa.Column("body_html", sa.Text(), nullable=False, server_default=""),
        sa.Column("faqs", _JSON, nullable=True),
        sa.Column("tags", _JSON, nullable=True),
        sa.Column("author", sa.String(length=255), nullable=False, server_default="seodada"),
        sa.Column("cover_image_url", sa.String(length=1000), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("reading_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source", sa.String(length=20), nullable=False, server_default="ai"),
        sa.Column("model", sa.String(length=100), nullable=False, server_default=""),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_blog_org_slug", "blogs", ["org_id", "slug"])
    op.create_index("ix_blog_org_status", "blogs", ["org_id", "status"])
    op.create_index("ix_blogs_org_id", "blogs", ["org_id"])
    op.create_index("ix_blogs_category_id", "blogs", ["category_id"])


def downgrade() -> None:
    op.drop_table("blogs")
    op.drop_table("blog_categories")
