from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

# JSONB on Postgres, plain JSON on SQLite (dev).
JsonType = JSON().with_variant(JSONB(), "postgresql")


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255))
    plan: Mapped[str] = mapped_column(String(50), default="free")
    monthly_quota_cents: Mapped[int] = mapped_column(Integer, default=5000)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    users: Mapped[list[User]] = relationship(back_populates="org")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255), default="")
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    role: Mapped[str] = mapped_column(String(20), default="owner")  # owner | member
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Email verification: OTP-verified signups and Google sign-ins are verified;
    # accounts created with email delivery disabled are treated as verified too.
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    # Platform-admin RBAC. Super-admins (emails in ADMIN_EMAILS) implicitly have
    # every permission incl. manage_roles; staff admins are granted a subset via
    # admin_permissions (a list of permission slugs).
    is_staff: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    admin_permissions: Mapped[list] = mapped_column(JsonType, default=list)
    # Admin-granted unlimited usage — exempt from the daily analysis quota
    # (like a comped subscription). Only matters while QUOTA_ENABLED=true.
    unlimited_usage: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    # DISPLAY currency only (ISO 4217), "" = not chosen. Billing is unaffected:
    # Razorpay charges INR and every stored amount stays in INR minor units, so
    # this converts figures for reading and never for charging. Anywhere money
    # is actually committed must still show the INR amount.
    display_currency: Mapped[str] = mapped_column(String(3), default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    org: Mapped[Organization] = relationship(back_populates="users")


class ApiCache(Base):
    __tablename__ = "api_cache"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    endpoint: Mapped[str] = mapped_column(String(255))
    params_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    response: Mapped[dict] = mapped_column(JsonType)
    # Float: DataForSEO bills in fractions of a cent (an AI Overview call is
    # $0.002 = 0.2c). Integer cents rounded those to 0 — real spend went unseen.
    cost_cents: Mapped[float] = mapped_column(Float, default=0.0)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class UsageLog(Base):
    __tablename__ = "usage_log"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    endpoint: Mapped[str] = mapped_column(String(255))
    # Float — see ApiCache.cost_cents. Sub-cent calls used to record as free.
    cost_cents: Mapped[float] = mapped_column(Float, default=0.0)
    from_cache: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    __table_args__ = (Index("ix_usage_org_created", "org_id", "created_at"),)


class RankSnapshot(Base):
    """A single observation of a domain's organic position for a keyword."""

    __tablename__ = "rank_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    keyword: Mapped[str] = mapped_column(String(255))
    domain: Mapped[str] = mapped_column(String(255))
    location_code: Mapped[int] = mapped_column(Integer, default=2840)
    language_code: Mapped[str] = mapped_column(String(10), default="en")
    device: Mapped[str] = mapped_column(String(10), default="desktop", server_default="desktop")
    position: Mapped[int | None] = mapped_column(Integer, nullable=True)  # None = not in top results
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    __table_args__ = (
        Index("ix_rank_org_kw_domain", "org_id", "keyword", "domain", "created_at"),
    )


class Schedule(Base):
    """A recurring automated job (e.g. a weekly Site Report saved to a project)."""

    __tablename__ = "schedules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"))
    kind: Mapped[str] = mapped_column(String(50), default="site_report")
    params: Mapped[dict] = mapped_column(JsonType, default=dict)
    frequency: Mapped[str] = mapped_column(String(20))  # daily | weekly | monthly
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    next_run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_status: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    __table_args__ = (Index("ix_schedules_active_next", "active", "next_run_at"),)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    type: Mapped[str] = mapped_column(String(20))  # keyword | domain | serp
    config: Mapped[dict] = mapped_column(JsonType, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    runs: Mapped[list[ProjectRun]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class ProjectRun(Base):
    __tablename__ = "project_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    module: Mapped[str] = mapped_column(String(50))
    params: Mapped[dict] = mapped_column(JsonType, default=dict)
    result_ref: Mapped[str | None] = mapped_column(Text, nullable=True)  # params_hash in api_cache
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    project: Mapped[Project] = relationship(back_populates="runs")


# ---------------------------------------------------------------------------
# Billing (Phase 4) — Razorpay + GST. Money is stored in the currency's minor
# unit (paise for INR), matching Razorpay's `amount` field, so no conversion at
# the API boundary.
# ---------------------------------------------------------------------------


class Plan(Base):
    """A purchasable subscription plan (the catalog). Seeded from seodada's real
    plans: Basic ₹799 / Pro ₹4999 / Premium ₹8999."""

    __tablename__ = "plans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(100))
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    price_cents: Mapped[int] = mapped_column(Integer)  # minor units (paise)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    period_days: Mapped[int] = mapped_column(Integer, default=30)
    usage_per_day: Mapped[int] = mapped_column(Integer, default=0)
    tier: Mapped[int] = mapped_column(Integer, default=1)
    features: Mapped[list] = mapped_column(JsonType, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Subscription(Base):
    """An org's current subscription to a Plan."""

    __tablename__ = "subscriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    plan_id: Mapped[str] = mapped_column(ForeignKey("plans.id"))
    status: Mapped[str] = mapped_column(String(20), default="active")  # active|paused|cancelled|expired
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    razorpay_subscription_id: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    plan: Mapped[Plan] = relationship()


class Payment(Base):
    """One Razorpay order/payment attempt, with the GST breakdown at capture."""

    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    plan_id: Mapped[str | None] = mapped_column(ForeignKey("plans.id"), nullable=True)
    razorpay_order_id: Mapped[str] = mapped_column(String(64), index=True)
    razorpay_payment_id: Mapped[str] = mapped_column(String(64), default="")
    amount_cents: Mapped[int] = mapped_column(Integer)     # total charged (incl. GST)
    tax_cents: Mapped[int] = mapped_column(Integer, default=0)  # GST portion
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    status: Mapped[str] = mapped_column(String(20), default="created")  # created|paid|failed
    invoice_number: Mapped[str] = mapped_column(String(40), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class InvoiceAddress(Base):
    """Buyer billing details for the GST invoice (one per org)."""

    __tablename__ = "invoice_addresses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), default="")
    company: Mapped[str] = mapped_column(String(255), default="")
    gstin: Mapped[str] = mapped_column(String(20), default="")
    address: Mapped[str] = mapped_column(Text, default="")
    city: Mapped[str] = mapped_column(String(100), default="")
    state: Mapped[str] = mapped_column(String(100), default="")
    state_code: Mapped[str] = mapped_column(String(3), default="")
    pincode: Mapped[str] = mapped_column(String(12), default="")
    country: Mapped[str] = mapped_column(String(100), default="India")


class WebsiteSettings(Base):
    """Single-row site config (company name, support email, logo, socials),
    ported from seodada's WebsiteSettings. Admin-editable."""

    __tablename__ = "website_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    company_name: Mapped[str] = mapped_column(String(255), default="seodada")
    support_email: Mapped[str] = mapped_column(String(255), default="support@seodada.com")
    tagline: Mapped[str] = mapped_column(String(500), default="")
    logo_url: Mapped[str] = mapped_column(String(1000), default="")
    favicon_url: Mapped[str] = mapped_column(String(1000), default="")
    facebook_url: Mapped[str] = mapped_column(String(500), default="")
    linkedin_url: Mapped[str] = mapped_column(String(500), default="")
    instagram_url: Mapped[str] = mapped_column(String(500), default="")
    youtube_url: Mapped[str] = mapped_column(String(500), default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


# ---------------------------------------------------------------------------
# Public content (migrated from seodada). Global, not org-scoped — this is the
# platform's public blog + web stories, read-only content (no AI generation).
# ---------------------------------------------------------------------------


class BlogCategory(Base):
    __tablename__ = "blog_categories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Blog(Base):
    __tablename__ = "blogs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    category_id: Mapped[str | None] = mapped_column(ForeignKey("blog_categories.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(500))
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    body_html: Mapped[str] = mapped_column(Text, default="")
    meta_title: Mapped[str] = mapped_column(String(500), default="")
    meta_description: Mapped[str] = mapped_column(Text, default="")
    meta_keywords: Mapped[str] = mapped_column(String(500), default="")
    excerpt: Mapped[str] = mapped_column(Text, default="")
    cover_image_url: Mapped[str] = mapped_column(String(1000), default="")
    author: Mapped[str] = mapped_column(String(255), default="seodada")
    image_alt: Mapped[str] = mapped_column(String(500), default="", server_default="")
    faqs: Mapped[list] = mapped_column(JsonType, default=list)
    tldr: Mapped[str] = mapped_column(Text, default="", server_default="")
    key_takeaways: Mapped[list] = mapped_column(JsonType, default=list)
    reading_time_minutes: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    is_pillar: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft | published
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    category: Mapped[BlogCategory | None] = relationship()


class WebStoryCategory(Base):
    __tablename__ = "web_story_categories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class WebStory(Base):
    __tablename__ = "web_stories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    category_id: Mapped[str | None] = mapped_column(
        ForeignKey("web_story_categories.id"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(500))
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    meta_description: Mapped[str] = mapped_column(Text, default="")
    cover_image_url: Mapped[str] = mapped_column(String(1000), default="")
    # [{"image": url, "heading": str, "text": str}, ...]
    slides: Mapped[list] = mapped_column(JsonType, default=list)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    category: Mapped[WebStoryCategory | None] = relationship()


# ---------------------------------------------------------------------------
# Contact + email operations (ported from seodada admin). Global, not
# org-scoped: the public contact form feeds an admin inbox, and every email the
# platform sends is logged so admins can audit and retry failures.
# ---------------------------------------------------------------------------


class ContactSubmission(Base):
    __tablename__ = "contact_submissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), index=True)
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="new")  # new|read|responded|spam
    admin_notes: Mapped[str] = mapped_column(Text, default="")
    ip: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class RefreshToken(Base):
    """Issued refresh tokens, keyed by the JWT's `jti` — makes sessions revocable
    (logout, password reset) and lets /refresh rotate tokens."""

    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)  # the JWT jti
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class EmailLog(Base):
    __tablename__ = "email_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    to_email: Mapped[str] = mapped_column(String(255), index=True)
    to_name: Mapped[str] = mapped_column(String(255), default="")
    email_type: Mapped[str] = mapped_column(String(50), default="generic", index=True)
    subject: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(String(20), default="sent")  # sent|failed
    error: Mapped[str] = mapped_column(Text, default="")
    meta: Mapped[dict] = mapped_column(JsonType, default=dict)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
