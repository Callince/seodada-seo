from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.auth import StrongPassword


class AdminUserOut(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    role: str
    org_id: str
    org_name: str
    is_active: bool
    is_admin: bool
    created_at: datetime
    # Spend aggregated from the usage log (billed calls only; cached reads cost 0).
    month_cents: int
    total_cents: int
    calls: int
    last_active: datetime | None = None


class AdminUsersResponse(BaseModel):
    users: list[AdminUserOut]
    total_month_cents: int
    total_cents: int


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: StrongPassword
    full_name: str = ""
    role: str = Field(default="member", pattern="^(member|owner)$")
    # Blank -> the new user joins the admin's organization. Set to create the
    # user under a new (or existing, matched by name) organization instead.
    org_name: str = ""


class AdminUserUpdate(BaseModel):
    """Partial update — only the fields provided are changed."""

    full_name: str | None = None
    role: str | None = Field(default=None, pattern="^(member|owner)$")
    # Setting a password resets the user's credentials.
    password: StrongPassword | None = None
    is_active: bool | None = None
    # Move the user to another organization (created if it doesn't exist).
    org_name: str | None = None


# ------------------------------------------------------------------ dashboard

class AdminStats(BaseModel):
    total_users: int
    active_users: int
    total_orgs: int
    active_subscriptions: int
    revenue_cents: int   # all-time paid
    mrr_cents: int       # sum of active plans' monthly price
    plan_distribution: list[dict]  # [{plan, count}]
    recent_signups: list[dict]     # [{email, created_at}]
    revenue_series: list[dict] = []   # [{date, cents}] last 30 days
    signups_series: list[dict] = []   # [{date, count}] last 30 days
    payment_status: list[dict] = []   # [{status, count}]


# ------------------------------------------------------------- admin RBAC

class AdminMeOut(BaseModel):
    email: str
    is_super: bool
    permissions: list[str]
    all_permissions: list[str]


class AdminRoleOut(BaseModel):
    id: str
    email: str
    full_name: str
    is_super: bool
    is_active: bool
    permissions: list[str]
    created_at: datetime


class AdminRoleCreate(BaseModel):
    email: EmailStr
    # Required only when the email isn't an existing user (creates the account).
    password: str | None = None
    full_name: str = ""
    permissions: list[str] = []


class AdminRoleUpdate(BaseModel):
    permissions: list[str] | None = None
    is_active: bool | None = None
    full_name: str | None = None


# --------------------------------------------------------------------- plans

class PlanAdminOut(BaseModel):
    id: str
    name: str
    slug: str
    price_cents: int
    currency: str
    period_days: int
    usage_per_day: int
    tier: int
    features: list[str] = []
    is_active: bool
    sort_order: int


class PlanCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    price_cents: int = Field(ge=0)
    currency: str = "INR"
    period_days: int = Field(default=30, ge=1)
    usage_per_day: int = Field(default=0, ge=0)
    tier: int = 1
    features: list[str] = []
    is_active: bool = True
    sort_order: int = 0


class PlanUpdate(BaseModel):
    name: str | None = None
    price_cents: int | None = Field(default=None, ge=0)
    period_days: int | None = Field(default=None, ge=1)
    usage_per_day: int | None = Field(default=None, ge=0)
    tier: int | None = None
    features: list[str] | None = None
    is_active: bool | None = None
    sort_order: int | None = None


# ----------------------------------------------------- subscriptions/payments

class AdminSubscriptionOut(BaseModel):
    id: str
    org_name: str
    plan_name: str
    status: str
    current_period_end: datetime | None = None


class AdminPaymentOut(BaseModel):
    id: str
    org_name: str
    amount_cents: int
    tax_cents: int
    currency: str
    status: str
    invoice_number: str
    created_at: datetime


# ---------------------------------------------------------------- site config

class WebsiteSettingsOut(BaseModel):
    company_name: str
    support_email: str
    tagline: str
    logo_url: str
    favicon_url: str
    facebook_url: str
    linkedin_url: str
    instagram_url: str
    youtube_url: str


class WebsiteSettingsUpdate(BaseModel):
    company_name: str | None = None
    support_email: str | None = None
    tagline: str | None = None
    logo_url: str | None = None
    favicon_url: str | None = None
    facebook_url: str | None = None
    linkedin_url: str | None = None
    instagram_url: str | None = None
    youtube_url: str | None = None


# --------------------------------------------------------------- content mod

class AdminBlogOut(BaseModel):
    id: str
    title: str
    slug: str
    status: str
    author: str
    category_id: str | None = None
    is_pillar: bool = False
    published_at: datetime | None = None
    updated_at: datetime


class AdminWebStoryOut(BaseModel):
    id: str
    title: str
    slug: str
    status: str
    published_at: datetime | None = None


class WebStorySlide(BaseModel):
    image: str = ""
    image_alt: str = ""
    heading: str = ""
    text: str = ""
    learn_more_url: str = ""


class AdminWebStoryDetail(BaseModel):
    id: str
    title: str
    slug: str
    meta_description: str
    cover_image_url: str
    slides: list[WebStorySlide] = []
    status: str
    published_at: datetime | None = None


class WebStoryCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    slug: str = Field(default="", max_length=255)
    meta_description: str = ""
    cover_image_url: str = ""
    slides: list[WebStorySlide] = []
    status: str = Field(default="draft", pattern="^(published|draft)$")


class WebStoryUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    slug: str | None = Field(default=None, max_length=255)
    meta_description: str | None = None
    cover_image_url: str | None = None
    slides: list[WebStorySlide] | None = None
    status: str | None = Field(default=None, pattern="^(published|draft)$")


class ContentStatusUpdate(BaseModel):
    status: str = Field(pattern="^(published|draft)$")


# --------------------------------------------------------- user detail/create

class ResetPasswordOut(BaseModel):
    password: str


class UserSubscriptionRow(BaseModel):
    id: str
    plan_name: str
    status: str
    started_at: datetime
    current_period_end: datetime | None = None


class UserPaymentRow(BaseModel):
    id: str
    amount_cents: int
    tax_cents: int
    currency: str
    status: str
    invoice_number: str
    created_at: datetime


class UserUsageRow(BaseModel):
    endpoint: str
    cost_cents: int
    from_cache: bool
    created_at: datetime


class AdminUserDetail(AdminUserOut):
    subscriptions: list[UserSubscriptionRow] = []
    payments: list[UserPaymentRow] = []
    recent_usage: list[UserUsageRow] = []


# ------------------------------------------------ subscription admin actions

class SubscriptionAssign(BaseModel):
    org_name: str = Field(min_length=1)
    plan_id: str
    days: int | None = Field(default=None, ge=1)  # override the plan's period


class SubscriptionExtend(BaseModel):
    days: int = Field(ge=1, le=3650)


class SubscriptionStatusUpdate(BaseModel):
    status: str = Field(pattern="^(active|paused|cancelled|expired)$")


# ------------------------------------------------------- payment admin actions

class PaymentStatusUpdate(BaseModel):
    status: str = Field(pattern="^(created|paid|failed|refunded)$")


class RefundRequest(BaseModel):
    amount_cents: int | None = Field(default=None, ge=1)  # None = full refund
    reason: str = ""


# --------------------------------------------------------- blog categories

class BlogCategoryOut(BaseModel):
    id: str
    name: str
    slug: str
    sort_order: int


class BlogCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    sort_order: int = 0


class BlogCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    sort_order: int | None = None


# ---------------------------------------------------------------- blog CRUD

class FaqItem(BaseModel):
    question: str
    answer: str


class AdminBlogDetail(BaseModel):
    id: str
    title: str
    slug: str
    body_html: str
    excerpt: str
    meta_title: str
    meta_description: str
    meta_keywords: str
    cover_image_url: str
    image_alt: str = ""
    author: str
    category_id: str | None = None
    faqs: list[FaqItem] = []
    tldr: str = ""
    key_takeaways: list[str] = []
    reading_time_minutes: int = 0
    is_pillar: bool = False
    status: str
    published_at: datetime | None = None
    updated_at: datetime


class BlogCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    slug: str = Field(default="", max_length=255)
    body_html: str = ""
    excerpt: str = ""
    meta_title: str = ""
    meta_description: str = ""
    meta_keywords: str = ""
    cover_image_url: str = ""
    image_alt: str = ""
    author: str = "seodada"
    category_id: str | None = None
    faqs: list[FaqItem] = []
    tldr: str = ""
    key_takeaways: list[str] = []
    reading_time_minutes: int = 0
    is_pillar: bool = False
    status: str = Field(default="draft", pattern="^(published|draft)$")


class BlogUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    slug: str | None = Field(default=None, max_length=255)
    body_html: str | None = None
    excerpt: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    meta_keywords: str | None = None
    cover_image_url: str | None = None
    image_alt: str | None = None
    author: str | None = None
    category_id: str | None = None
    faqs: list[FaqItem] | None = None
    tldr: str | None = None
    key_takeaways: list[str] | None = None
    reading_time_minutes: int | None = None
    is_pillar: bool | None = None
    status: str | None = Field(default=None, pattern="^(published|draft)$")


class UploadOut(BaseModel):
    url: str


# ------------------------------------------------------- contact submissions

class ContactSubmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: str
    message: str
    status: str
    admin_notes: str
    ip: str
    created_at: datetime
    responded_at: datetime | None = None


class ContactListResponse(BaseModel):
    items: list[ContactSubmissionOut]
    total: int
    new_count: int
    responded_count: int
    today_count: int


class ContactUpdate(BaseModel):
    status: str | None = Field(default=None, pattern="^(new|read|responded|spam)$")
    admin_notes: str | None = None


class ContactReply(BaseModel):
    subject: str = Field(min_length=1, max_length=500)
    message: str = Field(min_length=1)


# --------------------------------------------------------------- email logs

class EmailLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    to_email: str
    to_name: str
    email_type: str
    subject: str
    status: str
    error: str
    user_id: str | None = None
    created_at: datetime


class EmailLogListResponse(BaseModel):
    items: list[EmailLogOut]
    total: int
    sent_count: int
    failed_count: int
    today_count: int
    types: list[str]


# ------------------------------------------------- scheduled (recurring) emails

class ScheduledEmailOut(BaseModel):
    """An active recurring report schedule — it emails its result on each run."""
    id: str
    recipient: str
    owner_email: str
    domain: str
    keyword: str | None = None
    frequency: str
    next_run_at: datetime
    last_run_at: datetime | None = None
    last_status: str | None = None


class ScheduledEmailListResponse(BaseModel):
    items: list[ScheduledEmailOut]
    total: int


# ------------------------------------------------------------ usage history

class UsageHistoryRow(BaseModel):
    id: str
    user_email: str
    org_name: str
    endpoint: str
    cost_cents: int
    from_cache: bool
    created_at: datetime


class UsageHistoryResponse(BaseModel):
    items: list[UsageHistoryRow]
    total: int
    billed_count: int
    cached_count: int
    total_cost_cents: int
    tools: list[str]
