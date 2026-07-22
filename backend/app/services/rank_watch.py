"""Automated rank tracking — daily re-checks + movement alerts.

The scheduler loop calls `check_due()` every tick. A tracked pair
(org, keyword, domain, location, language) is *due* when its newest snapshot
is older than 24h, so every tracked keyword gets exactly one fresh observation
per day — no extra tables, the snapshot history itself is the state.

When a position moves by `rank_alert_delta` or more (either direction) and
SMTP is configured, the organization's first user is emailed.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import log
from app.db.models import RankSnapshot, User
from app.integrations.dataforseo import serp as serp_api
from app.services import email, engine, ranking, usage

RECHECK_AFTER = timedelta(hours=24)
DEPTH = 100  # matches the manual /rank/track default so cache keys are shared
BATCH_PER_TICK = 10  # spread cost; the next tick picks up the rest


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


async def _fetch_position(
    db: AsyncSession, user: User, keyword: str, location_code: int, language_code: str,
    domain: str, device: str = "desktop",
) -> tuple[int | None, str | None]:
    """One SERP lookup through the cost engine; returns (position, url)."""
    fetch_fn = lambda: serp_api.organic(keyword, location_code, language_code, DEPTH, device)  # noqa: E731
    resolved = await usage.metered(
        db, user, "serp.organic",
        {"keyword": keyword, "location_code": location_code,
         "language_code": language_code, "depth": DEPTH,
         # Constant since Brave was removed; kept so existing cache entries
         # keep hashing the same rather than all re-billing.
         "device": device, "provider": "dataforseo"},
        engine.TTL["serp"],
        fetch_fn,
    )
    rows = serp_api.parse_organic(resolved.data)
    return ranking.find_position(rows, domain)


async def due_pairs(db: AsyncSession, now: datetime | None = None) -> list[dict]:
    """Tracked pairs whose newest snapshot is older than RECHECK_AFTER."""
    now = now or _now()
    grouped = (
        select(
            RankSnapshot.org_id,
            RankSnapshot.keyword,
            RankSnapshot.domain,
            RankSnapshot.location_code,
            RankSnapshot.language_code,
            RankSnapshot.device,
            func.max(RankSnapshot.created_at).label("last_checked"),
        )
        .group_by(
            RankSnapshot.org_id,
            RankSnapshot.keyword,
            RankSnapshot.domain,
            RankSnapshot.location_code,
            RankSnapshot.language_code,
            RankSnapshot.device,
        )
        .subquery()
    )
    rows = (await db.execute(select(grouped))).all()
    cutoff = now - RECHECK_AFTER
    due = [
        {
            "org_id": r.org_id,
            "keyword": r.keyword,
            "domain": r.domain,
            "location_code": r.location_code,
            "language_code": r.language_code,
            "device": r.device,
        }
        for r in rows
        if _as_aware(r.last_checked) < cutoff
    ]
    return due[:BATCH_PER_TICK]


def build_alert_email(domain: str, keyword: str, old: int | None, new: int | None) -> tuple[str, str]:
    def fmt(p: int | None) -> str:
        return f"#{p}" if p is not None else "not in top 100"

    direction = "📈 up" if (old is None or (new is not None and new < old)) else "📉 down"
    subject = f"Rank alert — {domain} moved {direction.split()[1]} for “{keyword}” ({fmt(old)} → {fmt(new)})"
    html = (
        f"<h2>Ranking change for {domain}</h2>"
        f"<p>Keyword: <strong>{keyword}</strong></p>"
        f"<p>Position: <strong>{fmt(old)}</strong> → <strong>{fmt(new)}</strong> {direction}</p>"
        f"<p>Checked automatically by your SEO Intelligence rank tracker.</p>"
    )
    return subject, html


def _should_alert(old: int | None, new: int | None, threshold: int) -> bool:
    if old is None and new is None:
        return False
    if old is None or new is None:
        return True  # entered or dropped out of the top 100
    return abs(old - new) >= threshold


async def check_due(db: AsyncSession, now: datetime | None = None) -> int:
    """Re-check every due tracked pair; returns how many were checked."""
    pairs = await due_pairs(db, now)
    checked = 0
    for p in pairs:
        try:
            # Bill the org's first (oldest) active user — its owner in practice.
            user = await db.scalar(
                select(User).where(User.org_id == p["org_id"], User.is_active.is_(True))
                .order_by(User.created_at).limit(1)
            )
            if user is None:
                continue

            prev = await db.scalar(
                select(RankSnapshot)
                .where(
                    RankSnapshot.org_id == p["org_id"],
                    RankSnapshot.keyword == p["keyword"],
                    RankSnapshot.domain == p["domain"],
                    RankSnapshot.location_code == p["location_code"],
                    RankSnapshot.language_code == p["language_code"],
                    RankSnapshot.device == p["device"],
                )
                .order_by(RankSnapshot.created_at.desc()).limit(1)
            )
            position, url = await _fetch_position(
                db, user, p["keyword"], p["location_code"], p["language_code"],
                p["domain"], p["device"],
            )
            db.add(RankSnapshot(
                org_id=p["org_id"], keyword=p["keyword"], domain=p["domain"],
                location_code=p["location_code"], language_code=p["language_code"],
                device=p["device"], position=position, url=url,
            ))
            await db.commit()
            checked += 1

            old_pos = prev.position if prev else None
            if _should_alert(old_pos, position, settings.rank_alert_delta):
                subject, html = build_alert_email(p["domain"], p["keyword"], old_pos, position)
                await email.send_email(user.email, subject, html)
                log.info("rank_alert", domain=p["domain"], keyword=p["keyword"],
                         old=old_pos, new=position)
        except Exception as exc:  # one bad pair must not stop the rest
            log.error("rank_autocheck_failed", pair=p, error=str(exc))
    if checked:
        log.info("rank_autocheck", checked=checked)
    return checked
