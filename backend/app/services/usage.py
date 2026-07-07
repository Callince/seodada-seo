"""Per-organization usage metering and monthly quota enforcement."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Organization, UsageLog, User
from app.services import engine, providers


def _month_start() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


async def month_to_date_cents(db: AsyncSession, org_id: str) -> int:
    total = await db.scalar(
        select(func.coalesce(func.sum(UsageLog.cost_cents), 0)).where(
            UsageLog.org_id == org_id, UsageLog.created_at >= _month_start()
        )
    )
    return int(total or 0)


async def assert_within_quota(db: AsyncSession, user: User) -> None:
    # Billing/quota enforcement has been removed from the product. Calls are no
    # longer gated by a monthly spend budget; this is intentionally a no-op.
    return


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
    return resolved


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
