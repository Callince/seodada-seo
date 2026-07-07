"""Recurring schedules — run automated jobs (e.g. a weekly Site Report) and
save each result as a reopenable ProjectRun.

A lightweight in-process loop ticks every `scheduler_interval_seconds` and runs
due schedules. Each schedule is *claimed* with a conditional update before it
runs, so multiple API/worker replicas won't double-execute the same job.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import log
from app.db.models import ApiCache, ProjectRun, Schedule, User
from app.db.session import SessionLocal
from app.services import ai, email, engine, report

_DELTAS = {
    "daily": timedelta(days=1),
    "weekly": timedelta(weeks=1),
    "monthly": timedelta(days=30),
}
_SNAPSHOT_TTL = timedelta(days=3650)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def compute_next_run(frequency: str, frm: datetime) -> datetime:
    return frm + _DELTAS.get(frequency, _DELTAS["weekly"])


async def _persist_run(db: AsyncSession, project_id: str, params: dict, result: dict) -> None:
    """Save a report result as a $0-reopenable ProjectRun (mirrors /projects/runs)."""
    run = ProjectRun(project_id=project_id, module="report", params=params)
    db.add(run)
    await db.flush()
    key = engine.params_hash("project_run", {"run_id": run.id})
    now = _now()
    db.add(
        ApiCache(
            endpoint="project_run", params_hash=key, response={"result": result},
            cost_cents=0, fetched_at=now, expires_at=now + _SNAPSHOT_TTL,
        )
    )
    run.result_ref = key


async def run_schedule(db: AsyncSession, sched: Schedule) -> str:
    """Execute one schedule's job and save the result. Returns a status string."""
    user = await db.get(User, sched.user_id)
    if user is None:
        return "error: owner user no longer exists"
    p = sched.params or {}
    result = await report.site_report(
        db, user,
        p.get("domain", ""),
        p.get("keyword") or None,
        int(p.get("location_code", 2840)),
        p.get("language_code", "en"),
        int(p.get("max_pages", 5)),
    )

    # Best-effort AI enrichment — suggestions go into the saved run and the
    # email, but an AI hiccup must never fail the scheduled report itself.
    if settings.ai_enabled:
        try:
            result["ai"] = await ai.seo_insights({
                "domain": result.get("domain"),
                "keyword": result.get("keyword"),
                "health_score": result.get("health_score"),
                "overview": result.get("overview"),
                "ranking": result.get("ranking"),
                "findings": result.get("findings"),
                "recommendations": result.get("recommendations"),
                "top_keywords": (result.get("top_keywords") or [])[:10],
                "competitors": (result.get("competitors") or [])[:5],
            })
        except Exception as exc:  # noqa: BLE001
            log.warning("schedule_ai_skipped", schedule_id=sched.id, error=str(exc))

    await _persist_run(
        db, sched.project_id,
        {"domain": p.get("domain"), "keyword": p.get("keyword"), "scheduled": True},
        result,
    )

    # Optional email delivery (no-op unless SMTP is configured).
    status = f"ok · health {result.get('health_score')}"
    recipient = (p.get("email") or user.email or "").strip()
    if recipient:
        subject, html = email.build_report_email(p.get("domain", ""), p.get("keyword") or None, result)
        if await email.send_email(recipient, subject, html):
            status += f" · emailed {recipient}"
    return status


async def claim_due(db: AsyncSession, now: datetime, limit: int = 10) -> list[Schedule]:
    """Select due active schedules and atomically claim each (advance next_run)."""
    rows = (
        await db.scalars(
            select(Schedule)
            .where(Schedule.active.is_(True), Schedule.next_run_at <= now)
            .limit(limit)
        )
    ).all()
    claimed: list[Schedule] = []
    for s in rows:
        nxt = compute_next_run(s.frequency, now)
        res = await db.execute(
            update(Schedule)
            .where(Schedule.id == s.id, Schedule.next_run_at == s.next_run_at)
            .values(next_run_at=nxt)
        )
        if res.rowcount == 1:
            s.next_run_at = nxt
            claimed.append(s)
    await db.commit()
    return claimed


async def run_due(db: AsyncSession, now: datetime | None = None) -> int:
    now = now or _now()
    due = await claim_due(db, now)
    for s in due:
        try:
            status = await run_schedule(db, s)
        except Exception as exc:  # one bad job must not block the rest
            status = f"error: {exc}"[:250]
            log.error("schedule_run_failed", schedule_id=s.id, error=str(exc))
        s.last_run_at = now
        s.last_status = status
        await db.commit()
    return len(due)


async def scheduler_loop(interval_seconds: int) -> None:
    """Background loop; ticks until cancelled on app shutdown."""
    from app.core.config import settings
    from app.services import rank_watch

    log.info("scheduler_started", interval=interval_seconds)
    while True:
        try:
            async with SessionLocal() as db:
                ran = await run_due(db)
                if settings.rank_autocheck_enabled:
                    await rank_watch.check_due(db)
            if ran:
                log.info("scheduler_tick", ran=ran)
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # never let the loop die
            log.error("scheduler_loop_error", error=str(exc))
        await asyncio.sleep(interval_seconds)
