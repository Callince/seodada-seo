"""Extended admin functions ported from seodada: user lifecycle, subscription &
payment actions, blog authoring, contact inbox, email logs, usage history.

Endpoint functions are called directly (the require_admin gate is a FastAPI
dependency, exercised in integration; here we test the logic).
"""
from __future__ import annotations

import types

import pytest
from fastapi import HTTPException

from app.api import deps
from app.api.v1 import admin
from app.api.v1 import auth as auth_api
from app.db.models import ContactSubmission, EmailLog, Organization, Payment, UsageLog, User
from app.schemas.admin import AdminRoleCreate, AdminRoleUpdate
from app.schemas.admin import (
    AdminUserCreate,
    BlogCategoryCreate,
    BlogCreate,
    BlogUpdate,
    ContactUpdate,
    PlanCreate,
    RefundRequest,
    SubscriptionAssign,
    SubscriptionExtend,
    SubscriptionStatusUpdate,
    WebStoryCreate,
    WebStorySlide,
    WebStoryUpdate,
)


# --------------------------------------------------------------------- users

@pytest.mark.asyncio
async def test_user_create_detail_reset_delete(db):
    admin_user = await auth_api._upsert_google_user(db, "root@admin.com", "Root")

    created = await admin.create_user(
        AdminUserCreate(email="new@user.com", password="Password123", full_name="New User"),
        db, admin_user,
    )
    assert created.email == "new@user.com" and created.is_admin is False

    # duplicate rejected
    with pytest.raises(HTTPException) as exc:
        await admin.create_user(AdminUserCreate(email="new@user.com", password="Password123"), db, admin_user)
    assert exc.value.status_code == 409

    detail = await admin.user_detail(created.id, db, admin_user)
    assert detail.email == "new@user.com" and detail.subscriptions == []

    reset = await admin.reset_user_password(created.id, db, admin_user)
    assert len(reset.password) == 14

    # can't delete yourself
    with pytest.raises(HTTPException) as exc2:
        await admin.delete_user(admin_user.id, db, admin_user)
    assert exc2.value.status_code == 400

    await admin.delete_user(created.id, db, admin_user)
    assert await db.get(User, created.id) is None


# ------------------------------------------------------------- subscriptions

@pytest.mark.asyncio
async def test_subscription_assign_extend_cancel(db):
    user = await auth_api._upsert_google_user(db, "sub@admin.com", "Sub")
    org = await db.get(Organization, user.org_id)
    plan = await admin.create_plan(PlanCreate(name="Pro", price_cents=499900), db, user)

    sub = await admin.assign_subscription(
        SubscriptionAssign(org_name=org.name, plan_id=plan.id, days=10), db, user
    )
    assert sub.plan_name == "Pro" and sub.status == "active"

    extended = await admin.extend_subscription(sub.id, SubscriptionExtend(days=5), db, user)
    assert extended.current_period_end is not None

    cancelled = await admin.set_subscription_status(sub.id, SubscriptionStatusUpdate(status="cancelled"), db, user)
    assert cancelled.status == "cancelled"


# ------------------------------------------------------------------ payments

@pytest.mark.asyncio
async def test_payment_invoice_and_refund_guard(db):
    user = await auth_api._upsert_google_user(db, "pay@admin.com", "Pay")
    payment = Payment(
        org_id=user.org_id, amount_cents=79900, tax_cents=12188, currency="INR",
        status="paid", invoice_number="INV-TEST-1", razorpay_order_id="order_test", razorpay_payment_id="",
    )
    db.add(payment)
    await db.commit()

    pdf = await admin.payment_invoice(payment.id, db, user)
    assert pdf.body[:4] == b"%PDF"

    # refund with no razorpay id on record -> 400
    with pytest.raises(HTTPException) as exc:
        await admin.refund_payment(payment.id, RefundRequest(), db, user)
    assert exc.value.status_code == 400


# ---------------------------------------------------------------------- blog

@pytest.mark.asyncio
async def test_blog_category_and_post_crud(db):
    user = await auth_api._upsert_google_user(db, "blog@admin.com", "Blog")

    cat = await admin.create_blog_category(BlogCategoryCreate(name="SEO Tips"), db, user)
    assert cat.slug == "seo-tips"

    post = await admin.create_blog(
        BlogCreate(title="Hello World", body_html="<p>hi</p>", status="published", category_id=cat.id),
        db, user,
    )
    assert post.slug == "hello-world" and post.status == "published" and post.published_at is not None

    # second post with the same title gets a unique slug
    post2 = await admin.create_blog(BlogCreate(title="Hello World"), db, user)
    assert post2.slug != post.slug

    updated = await admin.update_blog(
        post.id,
        BlogUpdate(title="Hello Edited", faqs=[{"question": "Q?", "answer": "A."}]),
        db, user,
    )
    assert updated.title == "Hello Edited" and updated.faqs[0]["question"] == "Q?"

    # category delete blocked while it has posts
    with pytest.raises(HTTPException) as exc:
        await admin.delete_blog_category(cat.id, db, user)
    assert exc.value.status_code == 409


# ------------------------------------------------------------ contact inbox

@pytest.mark.asyncio
async def test_contact_inbox_flow(db):
    user = await auth_api._upsert_google_user(db, "contact@admin.com", "C")
    sub = ContactSubmission(name="Jane", email="jane@x.com", message="Hello there, I need help.")
    db.add(sub)
    await db.commit()

    listing = await admin.list_contact_submissions(None, None, db, user)
    assert listing.total == 1 and listing.new_count == 1

    # opening a "new" submission marks it read
    opened = await admin.get_contact_submission(sub.id, db, user)
    assert opened.status == "read"

    updated = await admin.update_contact_submission(
        sub.id, ContactUpdate(status="responded", admin_notes="handled"), db, user
    )
    assert updated.status == "responded" and updated.responded_at is not None

    await admin.delete_contact_submission(sub.id, db, user)
    empty = await admin.list_contact_submissions(None, None, db, user)
    assert empty.total == 0


@pytest.mark.asyncio
async def test_contact_reply_requires_transport(db):
    """With no email transport configured (conftest pins it off) a reply 502s."""
    user = await auth_api._upsert_google_user(db, "reply@admin.com", "R")
    sub = ContactSubmission(name="Bob", email="bob@x.com", message="A question about pricing.")
    db.add(sub)
    await db.commit()
    from app.schemas.admin import ContactReply

    with pytest.raises(HTTPException) as exc:
        await admin.reply_contact_submission(sub.id, ContactReply(subject="Hi", message="Reply"), db, user)
    assert exc.value.status_code == 502


# --------------------------------------------------------------- email logs

@pytest.mark.asyncio
async def test_email_logs_list_and_retry_guard(db):
    user = await auth_api._upsert_google_user(db, "mail@admin.com", "M")
    db.add(EmailLog(to_email="a@x.com", email_type="welcome", subject="Hi", status="sent"))
    failed = EmailLog(to_email="b@x.com", email_type="welcome", subject="Oops", status="failed", meta={"html": "<p>x</p>"})
    db.add(failed)
    await db.commit()

    logs = await admin.list_email_logs(None, None, None, 90, db, user)
    assert logs.total == 2 and logs.sent_count == 1 and logs.failed_count == 1
    assert "welcome" in logs.types

    # retry a sent email -> 400; retry a failed one with no transport -> 502
    sent_id = next(i.id for i in logs.items if i.status == "sent")
    with pytest.raises(HTTPException) as exc:
        await admin.retry_email(sent_id, db, user)
    assert exc.value.status_code == 400

    with pytest.raises(HTTPException) as exc2:
        await admin.retry_email(failed.id, db, user)
    assert exc2.value.status_code == 502


# ------------------------------------------------------------ usage history

@pytest.mark.asyncio
async def test_usage_history(db):
    user = await auth_api._upsert_google_user(db, "usage@admin.com", "U")
    db.add(UsageLog(user_id=user.id, org_id=user.org_id, endpoint="serp.live", cost_cents=30, from_cache=False))
    db.add(UsageLog(user_id=user.id, org_id=user.org_id, endpoint="serp.live", cost_cents=0, from_cache=True))
    await db.commit()

    hist = await admin.usage_history(None, None, 30, db, user)
    assert hist.total == 2 and hist.billed_count == 1 and hist.cached_count == 1
    assert hist.total_cost_cents == 30 and "serp.live" in hist.tools


# ----------------------------------------------------------------- web stories

@pytest.mark.asyncio
async def test_webstory_crud_with_slides(db):
    user = await auth_api._upsert_google_user(db, "story@admin.com", "S")

    story = await admin.create_story(
        WebStoryCreate(
            title="Top SEO Tips",
            status="published",
            slides=[
                WebStorySlide(image="/x/a.jpg", heading="Tip 1", text="Do this."),
                WebStorySlide(image="/x/b.jpg", heading="Tip 2", text="Then that."),
            ],
        ),
        db, user,
    )
    # create_story returns the ORM row, so slides are stored as plain dicts.
    assert story.slug == "top-seo-tips" and story.published_at is not None
    assert len(story.slides) == 2 and story.slides[0]["heading"] == "Tip 1"

    fetched = await admin.get_story_admin(story.id, db, user)
    assert len(fetched.slides) == 2

    updated = await admin.update_story(
        story.id,
        WebStoryUpdate(title="Top SEO Tips 2025", slides=[WebStorySlide(image="/x/c.jpg", heading="Only")]),
        db, user,
    )
    assert updated.title == "Top SEO Tips 2025" and len(updated.slides) == 1 and updated.slides[0]["heading"] == "Only"


# ------------------------------------------------------------ RBAC / roles

def _fake_request(path: str):
    return types.SimpleNamespace(url=types.SimpleNamespace(path=path))


@pytest.mark.asyncio
async def test_permission_helpers_and_path_gate(monkeypatch):
    monkeypatch.setattr(deps.settings, "admin_emails", "boss@admin.com")
    boss = User(email="boss@admin.com", hashed_password="x", org_id="o")
    staff = User(email="staff@x.com", hashed_password="x", org_id="o", is_staff=True, admin_permissions=["payments"])
    outsider = User(email="joe@x.com", hashed_password="x", org_id="o")

    assert deps.is_super_admin(boss) and not deps.is_super_admin(staff)
    assert deps.is_platform_admin(staff) and not deps.is_platform_admin(outsider)
    assert deps.has_permission(boss, "manage_roles")           # super = all
    assert deps.has_permission(staff, "payments")
    assert not deps.has_permission(staff, "manage_roles")

    # router gate: staff with only "payments" is blocked from /admin/roles, allowed on /admin/payments
    await deps.enforce_admin_permission(_fake_request("/api/v1/admin/payments"), staff)
    with pytest.raises(HTTPException) as exc:
        await deps.enforce_admin_permission(_fake_request("/api/v1/admin/roles"), staff)
    assert exc.value.status_code == 403
    # super passes everywhere
    await deps.enforce_admin_permission(_fake_request("/api/v1/admin/roles"), boss)
    # non-admin blocked outright
    with pytest.raises(HTTPException):
        await deps.enforce_admin_permission(_fake_request("/api/v1/admin/stats"), outsider)


@pytest.mark.asyncio
async def test_role_create_promote_update_revoke(db):
    admin_user = await auth_api._upsert_google_user(db, "rootadmin@x.com", "Root")

    # promote an existing user
    target = await auth_api._upsert_google_user(db, "member@x.com", "Member")
    role = await admin.create_role(
        AdminRoleCreate(email="member@x.com", permissions=["payments", "bogus"]), db, admin_user
    )
    assert role.is_super is False and role.permissions == ["payments"]  # bogus filtered out

    # create a brand-new admin account
    created = await admin.create_role(
        AdminRoleCreate(email="new@admin.com", password="Password123", full_name="New", permissions=["user_management"]),
        db, admin_user,
    )
    assert created.email == "new@admin.com" and created.permissions == ["user_management"]

    updated = await admin.update_role(target.id, AdminRoleUpdate(permissions=["payments", "email_logs"]), db, admin_user)
    assert set(updated.permissions) == {"payments", "email_logs"}

    # can't revoke yourself
    with pytest.raises(HTTPException) as exc:
        await admin.revoke_role(admin_user.id, db, admin_user)
    assert exc.value.status_code == 400

    await admin.revoke_role(target.id, db, admin_user)
    refreshed = await db.get(User, target.id)
    assert refreshed.is_staff is False and refreshed.admin_permissions == []


@pytest.mark.asyncio
async def test_admin_me_and_stats_series(db, monkeypatch):
    monkeypatch.setattr(deps.settings, "admin_emails", "")
    user = await auth_api._upsert_google_user(db, "dash@x.com", "Dash")
    user.is_staff = True
    user.admin_permissions = ["dashboard", "payments"]
    await db.commit()

    me = await admin.admin_me(user)
    assert me.is_super is False and "payments" in me.permissions and "manage_roles" in me.all_permissions

    stats = await admin.stats(db, user)
    assert stats.revenue_series == [] and isinstance(stats.payment_status, list)
