"""Per-organization usage metering and daily plan-limit enforcement."""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import log
from app.db.models import Organization, Plan, Subscription, UsageLog, User
from app.services import engine, providers
from app.services.cache_backend import cache_backend


def _month_start() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _day_start() -> datetime:
    return datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)


async def month_to_date_cents(db: AsyncSession, org_id: str) -> int:
    total = await db.scalar(
        select(func.coalesce(func.sum(UsageLog.cost_cents), 0)).where(
            UsageLog.org_id == org_id, UsageLog.created_at >= _month_start()
        )
    )
    return int(total or 0)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def daily_calls(db: AsyncSession, org_id: str) -> int:
    """Number of real (non-cached) analyses the org has run today."""
    return int(
        await db.scalar(
            select(func.count(UsageLog.id)).where(
                UsageLog.org_id == org_id,
                UsageLog.created_at >= _day_start(),
                UsageLog.from_cache.is_(False),
            )
        )
        or 0
    )


async def daily_limit(db: AsyncSession, org_id: str) -> int:
    """The org's daily analysis limit: the active plan's usage_per_day, else the
    free allowance."""
    now = datetime.now(timezone.utc)
    sub = await db.scalar(
        select(Subscription)
        .where(Subscription.org_id == org_id, Subscription.status == "active")
        .order_by(Subscription.created_at.desc())
    )
    if sub and (not sub.current_period_end or _aware(sub.current_period_end) > now):
        plan = await db.get(Plan, sub.plan_id)
        if plan and plan.usage_per_day:
            return plan.usage_per_day
    return settings.free_daily_analyses


def _is_platform_admin(user: User) -> bool:
    """Super-admins (ADMIN_EMAILS) and staff admins — same rule as api.deps."""
    return user.email.strip().lower() in settings.admin_email_list or bool(getattr(user, "is_staff", False))


async def assert_within_quota(db: AsyncSession, user: User) -> None:
    """Enforce the daily analysis limit (seodada model). Raises 402 when hit.

    Platform admins are exempt — they have no daily limit."""
    if not settings.quota_enabled or _is_platform_admin(user):
        return
    limit = await daily_limit(db, user.org_id)
    if await daily_calls(db, user.org_id) >= limit:
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            f"You've reached your daily limit of {limit} analyses. Upgrade your plan for more.",
        )


async def record(
    db: AsyncSession, user: User, endpoint: str, cost_cents: int, from_cache: bool
) -> None:
    db.add(
        UsageLog(
            user_id=user.id,
            org_id=user.org_id,
            endpoint=endpoint,
            cost_cents=0 if from_cache else cost_cents,
            from_cache=from_cache,
        )
    )
    await db.commit()


async def metered(
    db: AsyncSession,
    user: User,
    endpoint: str,
    params: dict,
    ttl_seconds: int,
    fetch_fn: engine.FetchFn,
    force_live: bool = False,
) -> engine.Resolved:
    """Quota-guard, resolve through the cost engine, and record the call."""
    await assert_within_quota(db, user)
    resolved = await engine.resolve(db, endpoint, params, ttl_seconds, fetch_fn, force_live=force_live)
    await record(db, user, endpoint, resolved.cost_cents, resolved.from_cache)
    # Stale-while-revalidate: the engine served a cached copy that's due for a
    # refresh — do it in the background so the next view is fresh, attributing the
    # (real, billed) refresh cost to this org. Deduped so only one refresh runs.
    if resolved.source == "revalidating":
        _spawn_revalidation(user, endpoint, params, ttl_seconds, fetch_fn)
    return resolved


def _spawn_revalidation(
    user: User, endpoint: str, params: dict, ttl_seconds: int, fetch_fn: engine.FetchFn
) -> None:
    key = f"reval:{engine.params_hash(endpoint, params)}"

    async def _job() -> None:
        # Atomic dedup — only the first caller in the window actually refreshes.
        if await cache_backend.incr(key, 300) != 1:
            return
        try:
            cost = await engine.revalidate(endpoint, params, ttl_seconds, fetch_fn)
            async with engine_session() as db2:
                # Record the background refresh's real cost so spend stays accurate.
                # ponytail: this row counts toward daily usage too — acceptable, it's
                # deduped to ≤1 per key per 5 min.
                db2.add(UsageLog(user_id=user.id, org_id=user.org_id, endpoint=endpoint, cost_cents=cost, from_cache=False))
                await db2.commit()
        except Exception as exc:  # a failed refresh just leaves the stale copy in place
            log.warning("swr_revalidate_failed", endpoint=endpoint, error=str(exc))

    asyncio.create_task(_job())


def engine_session():
    from app.db.session import SessionLocal

    return SessionLocal()


async def dashboard_stats(db: AsyncSession, org_id: str, unlimited: bool = False) -> dict:
    """seodada-style dashboard metrics: today's usage vs daily quota, plan,
    total analyses run, and the most-used tool. `unlimited` (platform admins)
    reports a 0 daily_limit, which the UI renders as ∞."""
    today = await daily_calls(db, org_id)
    limit = 0 if unlimited else await daily_limit(db, org_id)
    total = int(
        await db.scalar(
            select(func.count(UsageLog.id)).where(
                UsageLog.org_id == org_id, UsageLog.from_cache.is_(False)
            )
        )
        or 0
    )
    fav = (
        await db.execute(
            select(UsageLog.endpoint, func.count(UsageLog.id).label("c"))
            .where(UsageLog.org_id == org_id)
            .group_by(UsageLog.endpoint)
            .order_by(func.count(UsageLog.id).desc())
            .limit(1)
        )
    ).first()

    # Last-14-day call volume for the dashboard sparkline (real data).
    since = _day_start() - timedelta(days=13)
    day_rows = (
        await db.execute(
            select(func.date(UsageLog.created_at), func.count(UsageLog.id))
            .where(UsageLog.org_id == org_id, UsageLog.created_at >= since)
            .group_by(func.date(UsageLog.created_at))
        )
    ).all()
    by_day = {str(d): int(c) for d, c in day_rows}
    usage_series = [
        by_day.get((since + timedelta(days=i)).date().isoformat(), 0) for i in range(14)
    ]

    sub = await db.scalar(
        select(Subscription).where(Subscription.org_id == org_id, Subscription.status == "active")
    )
    plan_name = "Free"
    if sub:
        plan = await db.get(Plan, sub.plan_id)
        if plan:
            plan_name = plan.name
    return {
        "today_used": today,
        "daily_limit": limit,
        "remaining": max(0, limit - today),
        "total_analyses": total,
        "favorite_tool": fav[0] if fav else None,
        "favorite_tool_count": int(fav[1]) if fav else 0,
        "usage_series": usage_series,
        "plan_name": plan_name,
    }


async def summary(db: AsyncSession, org_id: str) -> dict:
    org = await db.get(Organization, org_id)
    quota = org.monthly_quota_cents if org else 0
    spent = await month_to_date_cents(db, org_id)
    by_module = await db.execute(
        select(UsageLog.endpoint, func.sum(UsageLog.cost_cents))
        .where(UsageLog.org_id == org_id, UsageLog.created_at >= _month_start())
        .group_by(UsageLog.endpoint)
    )
    return {
        "month_to_date_cents": spent,
        "quota_cents": quota,
        "remaining_cents": max(0, quota - spent),
        "by_module": [{"endpoint": e, "cost_cents": int(c or 0)} for e, c in by_module.all()],
        "providers": providers.active(),
    }
