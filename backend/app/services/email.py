"""Optional email delivery via stdlib SMTP (run off the event loop).

No third-party dependency: `smtplib` is synchronous, so the blocking send runs
in a worker thread. When `smtp_host` is unset, `send_email` is a graceful no-op
that returns False — the scheduler still saves the report, it just isn't emailed.
"""
from __future__ import annotations

import asyncio
import base64
import smtplib
from email.mime.text import MIMEText

import httpx

from app.core.config import settings
from app.core.logging import log

_GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"
_GMAIL_SEND = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"


def build_report_email(domain: str, keyword: str | None, result: dict) -> tuple[str, str]:
    """Compose (subject, html) for a Site Report email. Pure + testable."""
    health = result.get("health_score")
    subject = f"SEO report — {domain}" + (f" · “{keyword}”" if keyword else "")
    findings = result.get("findings") or []
    recs = result.get("recommendations") or []

    def _ul(items: list[str]) -> str:
        return "<ul>" + "".join(f"<li>{i}</li>" for i in items) + "</ul>"

    html = (
        f"<h2>SEO report for {domain}</h2>"
        f"<p>Site health score: <strong>{health if health is not None else '—'}/100</strong></p>"
    )
    if findings:
        html += "<h3>Key findings</h3>" + _ul(findings)
    if recs:
        html += "<h3>Top recommendations</h3>" + _ul(recs)

    # AI SEO Advisor section (present when the scheduler ran with AI enabled).
    ai_block = result.get("ai") or {}
    if ai_block.get("summary") or ai_block.get("suggestions"):
        html += "<h3>AI SEO Advisor</h3>"
        if ai_block.get("summary"):
            html += f"<p>{ai_block['summary']}</p>"
        items = [
            f"<strong>[{(s.get('priority') or 'medium').upper()}]</strong> {s.get('title', '')}"
            + (f" — {s['detail']}" if s.get("detail") else "")
            for s in (ai_block.get("suggestions") or [])
        ]
        if items:
            html += _ul(items)

    html += "<p>Open your SEO Intelligence dashboard for the full report.</p>"
    return subject, html


def _send_sync(to: str, subject: str, html: str) -> None:
    msg = MIMEText(html, "html", "utf-8")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
        if settings.smtp_use_tls:
            server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.smtp_from, [to], msg.as_string())


def _raw_message(to: str, subject: str, html: str) -> str:
    msg = MIMEText(html, "html", "utf-8")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to
    return base64.urlsafe_b64encode(msg.as_bytes()).decode()


async def _send_gmail_api(to: str, subject: str, html: str) -> bool:
    """Send via the Gmail API over HTTPS (works where SMTP ports are blocked)."""
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            tok = await client.post(_GOOGLE_TOKEN, data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "refresh_token": settings.google_gmail_refresh_token,
                "grant_type": "refresh_token",
            })
            tok.raise_for_status()
            access = tok.json()["access_token"]
            resp = await client.post(
                _GMAIL_SEND,
                headers={"Authorization": f"Bearer {access}"},
                json={"raw": _raw_message(to, subject, html)},
            )
            resp.raise_for_status()
        log.info("email_sent", to=to, via="gmail_api")
        return True
    except Exception as exc:
        log.error("email_send_failed", to=to, via="gmail_api", error=str(exc))
        return False


async def _record_email(
    to: str, subject: str, html: str, *, status: str, error: str,
    email_type: str, to_name: str, user_id: str | None,
) -> None:
    """Best-effort audit trail — write one EmailLog row. Never raises. The body is
    kept in `meta.html` so a failed email can be retried from the admin viewer."""
    try:
        from app.db.models import EmailLog
        from app.db.session import SessionLocal

        async with SessionLocal() as db:
            db.add(EmailLog(
                to_email=to, to_name=to_name, email_type=email_type, subject=subject,
                status=status, error=error, user_id=user_id, meta={"html": html},
            ))
            await db.commit()
    except Exception as exc:  # logging must never break the send path
        log.error("email_log_failed", to=to, error=str(exc))


async def send_email(
    to: str,
    subject: str,
    html: str,
    *,
    email_type: str = "generic",
    to_name: str = "",
    user_id: str | None = None,
    log_send: bool = True,
) -> bool:
    """Send an email; no-op (False) when no transport is configured.

    Prefers the Gmail API (HTTPS) since DigitalOcean blocks SMTP ports; falls
    back to SMTP if only that is configured. Every send attempt with a transport
    is recorded to EmailLog (sent/failed) for the admin email-logs viewer.
    """
    if not (to or "").strip():
        return False

    transport_ready = bool(settings.google_gmail_refresh_token.strip() or settings.smtp_host.strip())
    if not transport_ready:
        return False  # no transport → not an attempt, don't log

    if settings.google_gmail_refresh_token.strip():
        ok = await _send_gmail_api(to, subject, html)
        err = "" if ok else "Gmail API send failed (see server logs)."
    else:
        try:
            await asyncio.to_thread(_send_sync, to, subject, html)
            log.info("email_sent", to=to, via="smtp")
            ok, err = True, ""
        except Exception as exc:  # never break the scheduler over a mail failure
            log.error("email_send_failed", to=to, via="smtp", error=str(exc))
            ok, err = False, str(exc)

    if log_send:
        await _record_email(
            to, subject, html, status="sent" if ok else "failed", error=err,
            email_type=email_type, to_name=to_name, user_id=user_id,
        )
    return ok
