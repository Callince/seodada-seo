"""L1 hot-cache + distributed-lock abstraction.

Two interchangeable backends selected by `CACHE_BACKEND`:
  - "redis":  production, shared across workers, real locks.
  - "memory": single-process dev fallback when Redis is unavailable.
Both expose the same async interface used by the engine.
"""
from __future__ import annotations

import asyncio
import time
from contextlib import asynccontextmanager
from typing import Any

import orjson

from app.core.config import settings


class CacheBackend:
    async def get(self, key: str) -> Any | None: ...
    async def set(self, key: str, value: Any, ttl_seconds: int) -> None: ...
    async def incr(self, key: str, ttl_seconds: int) -> int: ...  # type: ignore[empty-body]
    async def get_count(self, key: str) -> int: ...  # type: ignore[empty-body]
    @asynccontextmanager
    async def lock(self, key: str, timeout: int = 60): ...  # type: ignore[empty-body]
    async def close(self) -> None: ...


class MemoryBackend(CacheBackend):
    def __init__(self) -> None:
        self._store: dict[str, tuple[float, Any]] = {}
        self._counters: dict[str, tuple[float, int]] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    async def get(self, key: str) -> Any | None:
        item = self._store.get(key)
        if not item:
            return None
        expires_at, value = item
        if expires_at < time.time():
            self._store.pop(key, None)
            return None
        return value

    async def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        self._store[key] = (time.time() + ttl_seconds, value)

    async def incr(self, key: str, ttl_seconds: int) -> int:
        now = time.time()
        item = self._counters.get(key)
        if item is None or item[0] < now:  # fresh window
            self._counters[key] = (now + ttl_seconds, 1)
            return 1
        expires_at, n = item
        n += 1
        self._counters[key] = (expires_at, n)  # keep the original window expiry
        return n

    async def get_count(self, key: str) -> int:
        item = self._counters.get(key)
        if item is None or item[0] < time.time():
            return 0
        return item[1]

    @asynccontextmanager
    async def lock(self, key: str, timeout: int = 60):
        lk = self._locks.setdefault(key, asyncio.Lock())
        async with lk:
            yield

    async def close(self) -> None:
        self._store.clear()
        self._counters.clear()


class RedisBackend(CacheBackend):
    def __init__(self, url: str) -> None:
        import redis.asyncio as redis  # local import keeps dev light

        self._redis = redis.from_url(url, encoding="utf-8", decode_responses=False)

    async def get(self, key: str) -> Any | None:
        raw = await self._redis.get(key)
        return orjson.loads(raw) if raw else None

    async def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        await self._redis.set(key, orjson.dumps(value), ex=ttl_seconds)

    async def incr(self, key: str, ttl_seconds: int) -> int:
        n = await self._redis.incr(key)
        if n == 1:  # first hit in the window — set the expiry
            await self._redis.expire(key, ttl_seconds)
        return int(n)

    async def get_count(self, key: str) -> int:
        raw = await self._redis.get(key)
        return int(raw) if raw else 0

    @asynccontextmanager
    async def lock(self, key: str, timeout: int = 60):
        async with self._redis.lock(f"lock:{key}", timeout=timeout, blocking_timeout=timeout):
            yield

    async def close(self) -> None:
        await self._redis.aclose()


def build_cache_backend() -> CacheBackend:
    if settings.cache_backend == "redis":
        return RedisBackend(settings.redis_url)
    return MemoryBackend()


cache_backend: CacheBackend = build_cache_backend()
