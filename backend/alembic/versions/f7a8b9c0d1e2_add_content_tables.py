"""add public content tables (blog_categories, blogs, web_stories)

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-07-07
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "f7a8b9c0d1e2"
down_revision = "e6f7a8b9c0d1"
branch_labels = None
depends_on = None

_JSON = sa.JSON().with_variant(sa.dialects.postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "blog_categories",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_blog_categories_slug", "blog_categories", ["slug"])

    op.create_table(
        "blogs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("category_id", sa.String(length=36), sa.ForeignKey("blog_categories.id"), nullable=True),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False, unique=True),
        sa.Column("body_html", sa.Text(), nullable=False, server_default=""),
        sa.Column("meta_title", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("meta_description", sa.Text(), nullable=False, server_default=""),
        sa.Column("meta_keywords", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("excerpt", sa.Text(), nullable=False, server_default=""),
        sa.Column("cover_image_url", sa.String(length=1000), nullable=False, server_default=""),
        sa.Column("author", sa.String(length=255), nullable=False, server_default="seodada"),
        sa.Column("faqs", _JSON, nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_blogs_slug", "blogs", ["slug"], unique=True)
    op.create_index("ix_blogs_category_id", "blogs", ["category_id"])

    op.create_table(
        "web_stories",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False, unique=True),
        sa.Column("meta_description", sa.Text(), nullable=False, server_default=""),
        sa.Column("cover_image_url", sa.String(length=1000), nullable=False, server_default=""),
        sa.Column("slides", _JSON, nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_web_stories_slug", "web_stories", ["slug"], unique=True)


def downgrade() -> None:
    op.drop_table("web_stories")
    op.drop_table("blogs")
    op.drop_table("blog_categories")
