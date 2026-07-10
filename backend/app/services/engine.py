"""Cost & Performance Engine.

Single entry point every billed DataForSEO call flows through. Implements the
three-tier cache (Redis -> Postgres -> upstream), singleflight coalescing and
stale-while-revalidate, and returns rich `meta` describing source/cost/latency.
"""
from __future__ import annotations

import hashlib
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import orjson
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ApiCache
from app.integrations.dataforseo.client import DfsResult
from app.services.cache_backend import cache_backend

# TTLs (seconds) by data volatility — kept short so pages stay fresh; the SWR
# window below means an expired entry is still served instantly while it refreshes.
TTL = {
    "serp": 6 * 3600,
    "search_volume": 3 * 24 * 3600,
    "labs": 2 * 24 * 3600,
    "trends": 12 * 3600,
    "on_page": 30 * 60,
    "content": 6 * 3600,
    "backlinks": 3 * 24 * 3600,
    "domain_meta": 7 * 24 * 3600,  # whois / tech stack — slow-changing
    "ai_mentions": 24 * 3600,      # LLM mentions + AI keyword volume
    "local": 24 * 3600,            # business listings
}
# Stale-while-revalidate: past hard expiry (but within this window) we serve the
# cached copy immediately and flag it for a background refresh, so the page is
# instant AND self-updates. `metered()` owns the refresh (so cost is attributed).
SWR_WINDOW = timedelta(days=7)
# How long a served-stale copy is primed into L1 (avoids re-hitting Postgres on
# every request while the background refresh is in flight).
SWR_L1_TTL = 60
# Hard fallback window (must exceed SWR_WINDOW): past the SWR window we fetch
# synchronously, and only fall back to this old copy if the upstream fetch fails.
STALE_WINDOW = timedelta(days=30)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_aware(dt: datetime) -> datetime:
    """SQLite returns tz-naive datetimes; treat stored timestamps as UTC."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def params_hash(endpoint: str, params: dict) -> str:
    canonical = orjson.dumps(params, option=orjson.OPT_SORT_KEYS)
    return hashlib.sha256(endpoint.encode() + b"|" + canonical).hexdigest()


@dataclass(slots=True)
class Resolved:
    data: list[dict[str, Any]]
    cost_cents: int
    from_cache: bool
    source: str  # redis | postgres | stale | live
    latency_ms: int
    fetched_at: str | None = None  # when the data was fetched upstream (ISO)

    def meta(self) -> dict:
        return {
            "from_cache": self.from_cache,
            "cost_cents": self.cost_cents,
            "source": self.source,
            "latency_ms": self.latency_ms,
            "fetched_at": self.fetched_at,
        }


FetchFn = Callable[[], Awaitable[DfsResult]]


async def resolve(
    db: AsyncSession,
    endpoint: str,
    params: dict,
    ttl_seconds: int,
    fetch_fn: FetchFn,
    force_live: bool = False,
) -> Resolved:
    """Resolve through the cache tiers.

    `force_live=True` skips every cache *read* and always fetches fresh data
    upstream (billed). The result is still persisted and primed into the hot
    tier, so subsequent normal reads benefit.
    """
    start = time.perf_counter()
    key = params_hash(endpoint, params)

    # L1 — Redis/memory hot tier.
    if not force_live:
        hot = await cache_backend.get(key)
        if hot is not None:
            return _hit(hot, "redis", start)

    # Singleflight: only one caller fetches a given key at a time.
    async with cache_backend.lock(key):
        now = _now()
        stale_payload: dict | None = None
        if not force_live:
            # Re-check L1 (another caller may have filled it while we waited).
            hot = await cache_backend.get(key)
            if hot is not None:
                return _hit(hot, "redis", start)

            # L2 — Postgres durable tier.
            row = await db.scalar(select(ApiCache).where(ApiCache.params_hash == key))
            if row is not None:
                payload = {
                    "data": row.response.get("result", []),
                    "cost_cents": row.cost_cents,
                    "fetched_at": _as_aware(row.fetched_at).isoformat(),
                }
                expires_at = _as_aware(row.expires_at)
                if expires_at > now:
                    await cache_backend.set(key, payload, _remaining(expires_at, now))
                    return _hit(payload, "postgres", start)
                if expires_at + SWR_WINDOW > now:
                    # Stale-while-revalidate: serve the cached copy now, briefly prime
                    # L1 so we don't hammer Postgres, and flag it so `metered()` kicks
                    # off a background refresh. The page is instant and self-updates.
                    await cache_backend.set(key, payload, SWR_L1_TTL)
                    return _hit(payload, "revalidating", start)
                if expires_at + STALE_WINDOW > now:
                    # Past the SWR window — kept only as a fallback if upstream fails.
                    stale_payload = payload

        # Miss / expired / forced live -> hit upstream for fresh data.
        try:
            fetched: DfsResult = await fetch_fn()
        except Exception:
            if stale_payload is not None:
                return _hit(stale_payload, "stale", start)
            raise
        payload = {
            "data": fetched.result,
            "cost_cents": fetched.cost_cents,
            "fetched_at": now.isoformat(),
        }
        await _persist(db, key, endpoint, fetched, ttl_seconds, now)
        await cache_backend.set(key, payload, ttl_seconds)
        latency = int((time.perf_counter() - start) * 1000)
        return Resolved(
            data=fetched.result,
            cost_cents=fetched.cost_cents,
            from_cache=False,
            source="live",
            latency_ms=latency,
            fetched_at=now.isoformat(),
        )


async def revalidate(endpoint: str, params: dict, ttl_seconds: int, fetch_fn: FetchFn) -> int:
    """Background SWR refresh: force-fetch fresh, persist to Postgres, and prime the
    hot tier. Opens its own DB session (the request's session is long gone). Returns
    the cost in cents so the caller can attribute the spend."""
    from app.db.session import SessionLocal

    key = params_hash(endpoint, params)
    now = _now()
    fetched: DfsResult = await fetch_fn()
    payload = {"data": fetched.result, "cost_cents": fetched.cost_cents, "fetched_at": now.isoformat()}
    async with SessionLocal() as db:
        await _persist(db, key, endpoint, fetched, ttl_seconds, now)
    await cache_backend.set(key, payload, ttl_seconds)
    return fetched.cost_cents


def _hit(payload: dict, source: str, start: float) -> Resolved:
    return Resolved(
        data=payload["data"],
        cost_cents=0,
        from_cache=True,
        source=source,
        latency_ms=int((time.perf_counter() - start) * 1000),
        fetched_at=payload.get("fetched_at"),
    )


def _remaining(expires_at: datetime, now: datetime) -> int:
    return max(1, int((expires_at - now).total_seconds()))


async def _persist(
    db: AsyncSession,
    key: str,
    endpoint: str,
    fetched: DfsResult,
    ttl_seconds: int,
    now: datetime,
) -> None:
    expires = now + timedelta(seconds=ttl_seconds)
    values = dict(
        endpoint=endpoint,
        params_hash=key,
        response={"result": fetched.result},
        cost_cents=fetched.cost_cents,
        fetched_at=now,
        expires_at=expires,
    )
    dialect = db.bind.dialect.name if db.bind else "sqlite"
    if dialect == "postgresql":
        stmt = pg_insert(ApiCache).values(**values)
        stmt = stmt.on_conflict_do_update(
            index_elements=[ApiCache.params_hash],
            set_={
                "response": stmt.excluded.response,
                "cost_cents": stmt.excluded.cost_cents,
                "fetched_at": stmt.excluded.fetched_at,
                "expires_at": stmt.excluded.expires_at,
            },
        )
        await db.execute(stmt)
    else:
        existing = await db.scalar(select(ApiCache).where(ApiCache.params_hash == key))
        if existing:
            existing.response = values["response"]
            existing.cost_cents = values["cost_cents"]
            existing.fetched_at = now
            existing.expires_at = expires
        else:
            db.add(ApiCache(**values))
    await db.commit()
