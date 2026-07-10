"""SQLite-backed conditional-GET cache.

Stores per-URL ``ETag``, ``Last-Modified``, and a content hash so the
fetcher can send ``If-None-Match`` / ``If-Modified-Since`` headers and
skip the body on ``304 Not Modified``.

This is what turns a re-crawl of the same site from "fetch everything
again" into "fetch only what changed."
"""

from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass
from typing import Optional

import aiosqlite

from app.integrations.scraper.config import CrawlerConfig, get_config


_SCHEMA = """
CREATE TABLE IF NOT EXISTS http_cache (
    url           TEXT PRIMARY KEY,
    etag          TEXT,
    last_modified TEXT,
    content_hash  TEXT,
    status        INTEGER,
    fetched_at    REAL NOT NULL,
    expires_at    REAL
);
CREATE INDEX IF NOT EXISTS idx_http_cache_expires ON http_cache(expires_at);
"""


@dataclass
class CacheEntry:
    url: str
    etag: Optional[str]
    last_modified: Optional[str]
    content_hash: Optional[str]
    status: int
    fetched_at: float
    expires_at: Optional[float]

    def conditional_headers(self) -> dict:
        headers = {}
        if self.etag:
            headers["If-None-Match"] = self.etag
        if self.last_modified:
            headers["If-Modified-Since"] = self.last_modified
        return headers


class ETagCache:
    """Async SQLite store. One instance per crawl run; call ``close()`` when done."""

    def __init__(self, config: Optional[CrawlerConfig] = None) -> None:
        self._config = config or get_config()
        self._db: Optional[aiosqlite.Connection] = None

    async def open(self) -> None:
        if self._db is not None:
            return
        self._db = await aiosqlite.connect(self._config.cache_db_path)
        # WAL = concurrent readers + single writer (much better under load
        # than default rollback journal). busy_timeout = wait up to 30s for
        # the lock instead of failing immediately.
        await self._db.execute("PRAGMA journal_mode=WAL")
        await self._db.execute("PRAGMA busy_timeout=30000")
        await self._db.execute("PRAGMA synchronous=NORMAL")
        await self._db.executescript(_SCHEMA)
        await self._db.commit()

    async def close(self) -> None:
        if self._db is not None:
            await self._db.close()
            self._db = None

    async def get(self, url: str) -> Optional[CacheEntry]:
        if self._db is None:
            await self.open()
        assert self._db is not None
        async with self._db.execute(
            "SELECT url, etag, last_modified, content_hash, status, fetched_at, expires_at "
            "FROM http_cache WHERE url = ?",
            (url,),
        ) as cur:
            row = await cur.fetchone()
        if row is None:
            return None
        entry = CacheEntry(*row)
        if entry.expires_at is not None and entry.expires_at < time.time():
            return None
        return entry

    async def put(
        self,
        url: str,
        *,
        etag: Optional[str],
        last_modified: Optional[str],
        content: Optional[bytes],
        status: int,
    ) -> None:
        if self._db is None:
            await self.open()
        assert self._db is not None
        now = time.time()
        expires_at = now + self._config.cache_ttl_sec
        content_hash = hashlib.sha256(content).hexdigest() if content else None
        await self._db.execute(
            "INSERT INTO http_cache(url, etag, last_modified, content_hash, status, fetched_at, expires_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(url) DO UPDATE SET "
            "  etag=excluded.etag, "
            "  last_modified=excluded.last_modified, "
            "  content_hash=excluded.content_hash, "
            "  status=excluded.status, "
            "  fetched_at=excluded.fetched_at, "
            "  expires_at=excluded.expires_at",
            (url, etag, last_modified, content_hash, status, now, expires_at),
        )
        await self._db.commit()

    async def purge_expired(self) -> int:
        if self._db is None:
            await self.open()
        assert self._db is not None
        now = time.time()
        cur = await self._db.execute(
            "DELETE FROM http_cache WHERE expires_at IS NOT NULL AND expires_at < ?",
            (now,),
        )
        await self._db.commit()
        return cur.rowcount or 0

    async def __aenter__(self) -> "ETagCache":
        await self.open()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self.close()
