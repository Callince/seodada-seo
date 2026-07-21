"""Admin: contact inbox, email logs, scheduled (recurring) emails."""
from __future__ import annotations


from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_db_session,
    require_admin,
)
from app.db.models import (
    ContactSubmission,
    EmailLog,
    Schedule,
    User,
)
from app.schemas.admin import (
    ContactListResponse,
    ContactReply,
    ContactSubmissionOut,
    ContactUpdate,
    EmailLogListResponse,
    EmailLogOut,
    ScheduledEmailListResponse,
    ScheduledEmailOut,
)
from app.services.email import send_email
from app.services.usage import _day_start
from app.api.v1.admin._shared import _csv_response

router = APIRouter()


@router.get("/contact-submissions", response_model=ContactListResponse)
async def list_contact_submissions(
    status_filter: str | None = None,
    q: str | None = None,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_admin),
):
    stmt = select(ContactSubmission).order_by(ContactSubmission.created_at.desc())
    if status_filter in ("new", "read", "responded", "spam"):
        stmt = stmt.where(ContactSubmission.status == status_filter)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(ContactSubmission.name.ilike(like), ContactSubmission.email.ilike(like)))
    items = list(await db.scalars(stmt.limit(500)))

    total = await db.scalar(select(func.count(ContactSubmission.id))) or 0
    new_count = await db.scalar(
        select(func.count(ContactSubmission.id)).where(ContactSubmission.status == "new")
    ) or 0
    responded = await db.scalar(
        select(func.count(ContactSubmission.id)).where(ContactSubmission.status == "responded")
    ) or 0
    today = await db.scalar(
        select(func.count(ContactSubmission.id)).where(ContactSubmission.created_at >= _day_start())
    ) or 0
    return ContactListResponse(
        items=items, total=int(total), new_count=int(new_count),
        responded_count=int(responded), today_count=int(today),
    )


@router.get("/contact-submissions/export")
async def export_contact_submissions(
    status_filter: str | None = None,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_admin),
):
    stmt = select(ContactSubmission).order_by(ContactSubmission.created_at.desc())
    if status_filter in ("new", "read", "responded", "spam"):
        stmt = stmt.where(ContactSubmission.status == status_filter)
    rows = list(await db.scalars(stmt))
    return _csv_response(
        ["ID", "Name", "Email", "Message", "Status", "IP", "Created", "Admin notes"],
        [[r.id, r.name, r.email, r.message, r.status, r.ip, r.created_at.isoformat(), r.admin_notes] for r in rows],
        "contact-submissions.csv",
    )


@router.get("/contact-submissions/{sid}", response_model=ContactSubmissionOut)
async def get_contact_submission(
    sid: str, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    sub = await db.get(ContactSubmission, sid)
    if not sub:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    if sub.status == "new":  # opening it marks it read
        sub.status = "read"
        await db.commit()
        await db.refresh(sub)
    return sub


@router.patch("/contact-submissions/{sid}", response_model=ContactSubmissionOut)
async def update_contact_submission(
    sid: str, body: ContactUpdate, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    sub = await db.get(ContactSubmission, sid)
    if not sub:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    if body.status is not None:
        sub.status = body.status
        if body.status == "responded" and not sub.responded_at:
            sub.responded_at = datetime.now(timezone.utc)
    if body.admin_notes is not None:
        sub.admin_notes = body.admin_notes
    await db.commit()
    await db.refresh(sub)
    return sub


@router.post("/contact-submissions/{sid}/reply", response_model=ContactSubmissionOut)
async def reply_contact_submission(
    sid: str, body: ContactReply, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    sub = await db.get(ContactSubmission, sid)
    if not sub:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    html = body.message.replace("\n", "<br/>")
    sent = await send_email(sub.email, body.subject, html, email_type="contact_reply", to_name=sub.name)
    if not sent:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Email transport is not configured or the send failed.")
    sub.status = "responded"
    sub.responded_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(sub)
    return sub


@router.delete("/contact-submissions/{sid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact_submission(
    sid: str, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    sub = await db.get(ContactSubmission, sid)
    if sub:
        await db.delete(sub)
        await db.commit()


# --------------------------------------------------------------- email logs

def _email_filtered(stmt, type_filter, status_filter, q, days):
    if type_filter:
        stmt = stmt.where(EmailLog.email_type == type_filter)
    if status_filter in ("sent", "failed"):
        stmt = stmt.where(EmailLog.status == status_filter)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(EmailLog.to_email.ilike(like), EmailLog.subject.ilike(like)))
    if days:
        stmt = stmt.where(EmailLog.created_at >= datetime.now(timezone.utc) - timedelta(days=days))
    return stmt


@router.get("/email-logs", response_model=EmailLogListResponse)
async def list_email_logs(
    type_filter: str | None = None,
    status_filter: str | None = None,
    q: str | None = None,
    days: int = 90,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_admin),
):
    stmt = _email_filtered(select(EmailLog), type_filter, status_filter, q, days).order_by(
        EmailLog.created_at.desc()
    )
    items = list(await db.scalars(stmt.limit(500)))
    total = await db.scalar(select(func.count(EmailLog.id))) or 0
    sent = await db.scalar(select(func.count(EmailLog.id)).where(EmailLog.status == "sent")) or 0
    failed = await db.scalar(select(func.count(EmailLog.id)).where(EmailLog.status == "failed")) or 0
    today = await db.scalar(
        select(func.count(EmailLog.id)).where(EmailLog.created_at >= _day_start())
    ) or 0
    types = [t for (t,) in await db.execute(select(EmailLog.email_type).distinct())]
    return EmailLogListResponse(
        items=items, total=int(total), sent_count=int(sent), failed_count=int(failed),
        today_count=int(today), types=sorted(types),
    )


@router.get("/email-logs/export")
async def export_email_logs(
    type_filter: str | None = None,
    status_filter: str | None = None,
    q: str | None = None,
    days: int = 90,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_admin),
):
    stmt = _email_filtered(select(EmailLog), type_filter, status_filter, q, days).order_by(
        EmailLog.created_at.desc()
    )
    rows = list(await db.scalars(stmt))
    return _csv_response(
        ["ID", "To", "Name", "Type", "Subject", "Status", "Error", "Created"],
        [[r.id, r.to_email, r.to_name, r.email_type, r.subject, r.status, r.error, r.created_at.isoformat()] for r in rows],
        "email-logs.csv",
    )


@router.get("/email-logs/{log_id}", response_model=EmailLogOut)
async def get_email_log(
    log_id: str, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    row = await db.get(EmailLog, log_id)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Log not found")
    return row


@router.post("/email-logs/{log_id}/retry", response_model=EmailLogOut)
async def retry_email(
    log_id: str, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    row = await db.get(EmailLog, log_id)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Log not found")
    if row.status != "failed":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only failed emails can be retried")
    html = (row.meta or {}).get("html", "")
    ok = await send_email(
        row.to_email, f"[RETRY] {row.subject}", html,
        email_type=row.email_type, to_name=row.to_name, user_id=row.user_id,
    )
    if not ok:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Retry send failed (transport not configured?).")
    await db.refresh(row)
    return row


# ------------------------------------------------- scheduled (recurring) emails


def _scheduled_email_out(s: Schedule, owner_email: str) -> ScheduledEmailOut:
    p = s.params or {}
    return ScheduledEmailOut(
        id=s.id,
        recipient=(p.get("email") or owner_email or "").strip(),
        owner_email=owner_email,
        domain=(p.get("domain") or "").strip() or "site",
        keyword=(p.get("keyword") or None),
        frequency=s.frequency,
        next_run_at=s.next_run_at,
        last_run_at=s.last_run_at,
        last_status=s.last_status,
    )


@router.get("/scheduled-emails", response_model=ScheduledEmailListResponse)
async def list_scheduled_emails(
    db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    """Active recurring report schedules platform-wide — each emails its result on run."""
    rows = list(
        await db.scalars(
            select(Schedule).where(Schedule.active.is_(True)).order_by(Schedule.next_run_at.asc())
        )
    )
    user_ids = {s.user_id for s in rows}
    owners: dict[str, str] = {}
    if user_ids:
        owners = {u.id: u.email for u in await db.scalars(select(User).where(User.id.in_(user_ids)))}
    items = [_scheduled_email_out(s, owners.get(s.user_id, "")) for s in rows]
    return ScheduledEmailListResponse(items=items, total=len(items))


@router.post("/scheduled-emails/{schedule_id}/cancel", response_model=ScheduledEmailOut)
async def cancel_scheduled_email(
    schedule_id: str, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    """Cancel a scheduled email — deactivate the schedule so it stops sending."""
    s = await db.get(Schedule, schedule_id)
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scheduled email not found")
    s.active = False
    owner = await db.get(User, s.user_id)
    await db.commit()
    await db.refresh(s)
    return _scheduled_email_out(s, owner.email if owner else "")


