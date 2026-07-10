"""URL frontier — the crawler's work queue.

Responsibilities:

* **Canonicalize** incoming URLs (strip fragments/UTM, sort query params,
  lowercase host) so ``?utm_source=x`` and the bare URL are one entry.
* **Dedupe** cheaply with a Bloom filter (``rbloom``) backed by a
  persistent seen-set in SQLite — so re-runs skip pages we've already
  hit on previous crawls, not just this one.
* **Prioritize** by depth + caller-supplied score (lower first). The
  session walker uses this to prefer "current page's outlinks" over
  "random queue picks".
* **Filter** against the unwanted-extensions regex from config.
"""

from __future__ import annotations

import asyncio
import heapq
import itertools
import time
from dataclasses import dataclass, field
from typing import List, Optional, Tuple
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse

import aiosqlite
from rbloom import Bloom
from w3lib.url import canonicalize_url

from app.integrations.scraper.config import CrawlerConfig, get_config


# ---------------------------------------------------------------------------
# URL normalization (ported from crawler.py:59-125 + w3lib canonicalization)
# ---------------------------------------------------------------------------


_TRACKING_PARAMS = frozenset({
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "gclid", "fbclid", "mc_cid", "mc_eid", "igshid", "ref", "ref_src",
    "_ga", "_gl", "mkt_tok",
})


def normalize_url(url: str, base_url: Optional[str] = None) -> Optional[str]:
    """Return a canonical form of ``url`` or ``None`` if not crawlable.

    Handles:
      * relative and protocol-relative URLs
      * lowercased scheme + host
      * fragment stripping
      * common tracking-parameter stripping
      * ``w3lib.canonicalize_url`` post-pass (sorts query, percent-encodes)
    """
    if not url or not url.strip():
        return None
    url = url.strip()

    # Protocol-relative: //cdn.example.com/x → use base scheme
    if url.startswith("//"):
        if base_url:
            base_scheme = urlparse(base_url).scheme or "https"
            url = f"{base_scheme}:{url}"
        else:
            url = f"https:{url}"

    # Relative: /path or path → resolve against base
    if base_url and not url.startswith(("http://", "https://")):
        url = urljoin(base_url, url)

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return None
    if not parsed.netloc:
        return None

    # Lowercase scheme + host; drop fragment
    scheme = parsed.scheme.lower()
    netloc = parsed.netloc.lower()

    # Strip tracking params
    query_items = [
        (k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True)
        if k.lower() not in _TRACKING_PARAMS
    ]
    query = urlencode(query_items, doseq=True)

    rebuilt = urlunparse((scheme, netloc, parsed.path or "/", parsed.params, query, ""))

    # Final canonicalization (sorts query keys, percent-encodes consistently)
    try:
        return canonicalize_url(rebuilt)
    except Exception:
        return rebuilt


# ---------------------------------------------------------------------------
# Frontier
# ---------------------------------------------------------------------------


@dataclass(order=True)
class _FrontierItem:
    """Heap entry: lower priority tuple first."""

    priority: Tuple[int, int, int]  # (depth, score, tiebreak)
    url: str = field(compare=False)
    referer: Optional[str] = field(default=None, compare=False)


_SCHEMA = """
CREATE TABLE IF NOT EXISTS seen_urls (
    url       TEXT PRIMARY KEY,
    first_seen REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS frontier_queue (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    url      TEXT NOT NULL,
    depth    INTEGER NOT NULL,
    score    INTEGER NOT NULL,
    referer  TEXT
);
"""


class Frontier:
    """Async URL frontier with bloom dedup + SQLite persistence.

    The bloom filter gives O(1) "have I seen this?" in memory for the
    common case. The SQLite ``seen_urls`` table is the authoritative
    store — used to rebuild the bloom after a restart and to resolve
    bloom false positives when it matters (``has_seen_exact``).
    """

    def __init__(
        self,
        db_path: Optional[str] = None,
        config: Optional[CrawlerConfig] = None,
    ) -> None:
        self._config = config or get_config()
        self._db_path = db_path or self._config.cache_db_path
        self._db: Optional[aiosqlite.Connection] = None
        self._bloom = Bloom(
            self._config.bloom_capacity,
            self._config.bloom_false_positive_rate,
        )
        self._heap: List[_FrontierItem] = []
        self._counter = itertools.count()
        self._lock = asyncio.Lock()
        self._unwanted = self._config.unwanted_regex()

    # ---- lifecycle ----------------------------------------------------
    async def open(self) -> None:
        if self._db is not None:
            return
        self._db = await aiosqlite.connect(self._db_path)
        # Same write-contention treatment as the ETag cache.
        await self._db.execute("PRAGMA journal_mode=WAL")
        await self._db.execute("PRAGMA busy_timeout=30000")
        await self._db.execute("PRAGMA synchronous=NORMAL")
        await self._db.executescript(_SCHEMA)
        await self._db.commit()
        # Rehydrate the bloom filter from persistent seen-set
        async with self._db.execute("SELECT url FROM seen_urls") as cur:
            async for (url,) in cur:
                self._bloom.add(url)

    async def close(self) -> None:
        if self._db is not None:
            await self._db.close()
            self._db = None

    async def __aenter__(self) -> "Frontier":
        await self.open()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self.close()

    # ---- enqueue / dequeue --------------------------------------------
    async def add(
        self,
        url: str,
        *,
        depth: int = 0,
        score: int = 0,
        referer: Optional[str] = None,
        base_url: Optional[str] = None,
    ) -> bool:
        """Canonicalize, filter, dedupe, enqueue. Returns True if enqueued."""
        canonical = normalize_url(url, base_url=base_url)
        if canonical is None:
            return False
        if self._unwanted.search(canonical):
            return False
        if canonical in self._bloom:
            # Bloom might false-positive; double-check against SQLite for safety
            if await self._is_persisted(canonical):
                return False
        async with self._lock:
            tiebreak = next(self._counter)
            heapq.heappush(
                self._heap,
                _FrontierItem((depth, score, tiebreak), canonical, referer),
            )
            self._bloom.add(canonical)
        await self._mark_seen(canonical)
        return True

    async def pop(self) -> Optional[_FrontierItem]:
        async with self._lock:
            if not self._heap:
                return None
            return heapq.heappop(self._heap)

    def empty(self) -> bool:
        return not self._heap

    def __len__(self) -> int:
        return len(self._heap)

    # ---- persistence helpers ------------------------------------------
    async def _mark_seen(self, url: str) -> None:
        if self._db is None:
            return
        await self._db.execute(
            "INSERT OR IGNORE INTO seen_urls(url, first_seen) VALUES (?, ?)",
            (url, time.time()),
        )
        await self._db.commit()

    async def _is_persisted(self, url: str) -> bool:
        if self._db is None:
            return False
        async with self._db.execute(
            "SELECT 1 FROM seen_urls WHERE url = ? LIMIT 1", (url,)
        ) as cur:
            return (await cur.fetchone()) is not None
