from __future__ import annotations

import pytest

from app.integrations.dataforseo.client import DfsResult
from app.services import engine


@pytest.mark.asyncio
async def test_resolve_caches_after_first_call(db):
    calls = {"n": 0}

    async def fetch() -> DfsResult:
        calls["n"] += 1
        return DfsResult(result=[{"keyword": "shoes"}], cost_cents=5)

    params = {"keyword": "shoes", "location_code": 2840}

    first = await engine.resolve(db, "serp.organic", params, 3600, fetch)
    assert first.from_cache is False
    assert first.cost_cents == 5
    assert first.source == "live"
    assert calls["n"] == 1

    # L1 hot tier serves the repeat at $0 without re-fetching.
    second = await engine.resolve(db, "serp.organic", params, 3600, fetch)
    assert second.from_cache is True
    assert second.cost_cents == 0
    assert second.source == "redis"
    assert calls["n"] == 1
    assert second.data == first.data


@pytest.mark.asyncio
async def test_resolve_falls_back_to_postgres_when_l1_evicted(db, fresh_cache):
    async def fetch() -> DfsResult:
        return DfsResult(result=[{"x": 1}], cost_cents=7)

    params = {"k": "v"}
    await engine.resolve(db, "labs.x", params, 3600, fetch)

    # Drop the hot tier; durable Postgres row should still answer at $0.
    fresh_cache._store.clear()

    again = await engine.resolve(db, "labs.x", params, 3600, fetch)
    assert again.from_cache is True
    assert again.cost_cents == 0
    assert again.source == "postgres"


@pytest.mark.asyncio
async def test_expired_entry_refetches_live(db, fresh_cache):
    """Expired cache entries must trigger a fresh fetch, not silently serve stale."""
    from datetime import timedelta

    from sqlalchemy import select

    from app.db.models import ApiCache

    calls = {"n": 0}

    async def fetch() -> DfsResult:
        calls["n"] += 1
        return DfsResult(result=[{"v": calls["n"]}], cost_cents=3)

    params = {"k": "expired"}
    await engine.resolve(db, "serp.organic", params, 3600, fetch)

    # Expire the durable row (still inside the stale window) and drop L1.
    key = engine.params_hash("serp.organic", params)
    row = await db.scalar(select(ApiCache).where(ApiCache.params_hash == key))
    row.expires_at = engine._now() - timedelta(hours=1)
    await db.commit()
    fresh_cache._store.clear()

    again = await engine.resolve(db, "serp.organic", params, 3600, fetch)
    assert again.source == "live" and again.data == [{"v": 2}]
    assert calls["n"] == 2


@pytest.mark.asyncio
async def test_stale_served_only_when_upstream_fails(db, fresh_cache):
    from datetime import timedelta

    from sqlalchemy import select

    from app.db.models import ApiCache

    async def fetch() -> DfsResult:
        return DfsResult(result=[{"v": "original"}], cost_cents=3)

    params = {"k": "stale-fallback"}
    await engine.resolve(db, "serp.organic", params, 3600, fetch)

    key = engine.params_hash("serp.organic", params)
    row = await db.scalar(select(ApiCache).where(ApiCache.params_hash == key))
    row.expires_at = engine._now() - timedelta(hours=1)
    await db.commit()
    fresh_cache._store.clear()

    async def broken_fetch() -> DfsResult:
        raise RuntimeError("upstream down")

    fallback = await engine.resolve(db, "serp.organic", params, 3600, broken_fetch)
    assert fallback.source == "stale"
    assert fallback.from_cache is True
    assert fallback.data == [{"v": "original"}]


def test_params_hash_is_order_independent():
    a = engine.params_hash("serp", {"keyword": "x", "loc": 1})
    b = engine.params_hash("serp", {"loc": 1, "keyword": "x"})
    assert a == b
    assert a != engine.params_hash("serp", {"keyword": "y", "loc": 1})
