"""Per-host politeness: robots.txt, AIMD concurrency, circuit breaker.

This module enforces three independent rules that all requests must pass
before the engine lets them through:

1. **robots.txt** — fetched once per host, cached, checked per URL.
   Extracts ``Crawl-delay`` from the matching user-agent section and
   uses it as the minimum gap between requests to that host.
2. **AIMD semaphore** — per-host concurrency that grows on success and
   halves on 429/5xx (TCP-congestion style). No hardcoded worker count.
3. **Circuit breaker** — after N consecutive failures on a host, the
   breaker opens and new requests to that host are rejected for a
   cooldown window.

``HostGovernor.acquire(host)`` returns an async context manager; the
engine calls it around every fetch.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Dict, Optional
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

from app.integrations.scraper.config import CrawlerConfig, get_config
from app.integrations.scraper.fetcher import AsyncFetcher


# ---------------------------------------------------------------------------
# robots.txt cache
# ---------------------------------------------------------------------------


@dataclass
class RobotsEntry:
    parser: RobotFileParser
    crawl_delay: Optional[float]
    fetched_at: float


class RobotsCache:
    """Async robots.txt cache keyed by (scheme, host).

    Uses the provided ``AsyncFetcher`` so requests go through the same TLS
    profile / persona as real page fetches — otherwise the robots.txt
    request itself would stand out.
    """

    def __init__(self, fetcher: AsyncFetcher, config: Optional[CrawlerConfig] = None) -> None:
        self._fetcher = fetcher
        self._config = config or get_config()
        self._entries: Dict[str, RobotsEntry] = {}
        self._locks: Dict[str, asyncio.Lock] = {}
        self._ttl_sec = 3600  # robots.txt cached for 1 hour

    def _host_key(self, url: str) -> str:
        p = urlparse(url)
        return f"{p.scheme}://{p.netloc}"

    def _lock_for(self, key: str) -> asyncio.Lock:
        if key not in self._locks:
            self._locks[key] = asyncio.Lock()
        return self._locks[key]

    async def _load(self, key: str) -> RobotsEntry:
        robots_url = f"{key}/robots.txt"
        result = await self._fetcher.fetch(robots_url, use_cache=False)
        parser = RobotFileParser()
        if result.ok and result.body:
            parser.parse(result.body.splitlines())
        else:
            # Missing / error fetching robots.txt → treat as "everything allowed"
            parser.parse([""])

        # RobotFileParser doesn't expose crawl_delay nicely before 3.8;
        # we call it with our own UA fragment.
        delay: Optional[float] = None
        try:
            raw_delay = parser.crawl_delay("*") or parser.crawl_delay(self._fetcher.persona.user_agent)
            if raw_delay is not None:
                delay = float(raw_delay)
        except Exception:
            delay = None
        return RobotsEntry(parser=parser, crawl_delay=delay, fetched_at=time.time())

    async def get(self, url: str) -> RobotsEntry:
        key = self._host_key(url)
        entry = self._entries.get(key)
        now = time.time()
        if entry is not None and (now - entry.fetched_at) < self._ttl_sec:
            return entry
        async with self._lock_for(key):
            entry = self._entries.get(key)
            if entry is not None and (now - entry.fetched_at) < self._ttl_sec:
                return entry
            entry = await self._load(key)
            self._entries[key] = entry
            return entry

    async def allowed(self, url: str) -> bool:
        if not self._config.respect_robots_txt:
            return True
        entry = await self.get(url)
        return entry.parser.can_fetch(self._fetcher.persona.user_agent, url)

    async def crawl_delay(self, url: str) -> float:
        entry = await self.get(url)
        if entry.crawl_delay is not None:
            return entry.crawl_delay
        return self._config.default_crawl_delay_sec


# ---------------------------------------------------------------------------
# AIMD per-host semaphore (TCP-style adaptive concurrency)
# ---------------------------------------------------------------------------


@dataclass
class _HostState:
    """Bookkeeping for one host."""

    concurrency: float = 2.0              # fractional — AIMD increases slowly
    in_flight: int = 0
    consecutive_failures: int = 0
    circuit_open_until: float = 0.0
    last_request_at: float = 0.0
    min_delay_sec: float = 0.0            # from robots.txt crawl-delay
    waiters: asyncio.Condition = field(default_factory=asyncio.Condition)

    def effective_limit(self) -> int:
        return max(1, int(self.concurrency))


class HostGovernor:
    """Per-host concurrency + circuit breaker.

    Usage::

        async with governor.acquire(host):
            ...  # do one request
        governor.on_success(host)    # or governor.on_failure(host, ...)
    """

    def __init__(self, config: Optional[CrawlerConfig] = None) -> None:
        self._config = config or get_config()
        self._states: Dict[str, _HostState] = {}

    def _state(self, host: str) -> _HostState:
        st = self._states.get(host)
        if st is None:
            st = _HostState(concurrency=float(self._config.per_host_concurrency_start))
            self._states[host] = st
        return st

    def set_min_delay(self, host: str, delay_sec: float) -> None:
        """Wire robots.txt crawl-delay into the governor."""
        self._state(host).min_delay_sec = max(delay_sec, self._config.min_per_host_delay_sec)

    def circuit_open(self, host: str) -> bool:
        st = self._state(host)
        return st.circuit_open_until > time.time()

    def acquire(self, host: str) -> "_HostGuard":
        return _HostGuard(self, host)

    # Called by _HostGuard.__aenter__ after semaphore slot is obtained,
    # to enforce the per-host minimum delay (robots.txt crawl-delay).
    async def _wait_for_slot(self, host: str) -> None:
        st = self._state(host)
        async with st.waiters:
            while True:
                if self.circuit_open(host):
                    remaining = max(0.0, st.circuit_open_until - time.time())
                    raise CircuitOpenError(host, remaining)
                if st.in_flight < st.effective_limit():
                    break
                try:
                    await asyncio.wait_for(st.waiters.wait(), timeout=30.0)
                except asyncio.TimeoutError:
                    # keep spinning on the condition; avoids lost-wakeup deadlocks
                    continue
            # honor minimum gap between requests to this host
            now = time.time()
            gap = st.min_delay_sec
            if gap > 0:
                wait = (st.last_request_at + gap) - now
                if wait > 0:
                    await asyncio.sleep(wait)
            st.in_flight += 1
            st.last_request_at = time.time()

    async def _release(self, host: str) -> None:
        st = self._state(host)
        async with st.waiters:
            st.in_flight = max(0, st.in_flight - 1)
            st.waiters.notify_all()

    # ---- AIMD feedback ------------------------------------------------
    def on_success(self, host: str) -> None:
        st = self._state(host)
        st.consecutive_failures = 0
        # additive increase: concurrency += 1 / concurrency (TCP-like)
        st.concurrency = min(
            float(self._config.per_host_concurrency_cap),
            st.concurrency + (1.0 / max(1.0, st.concurrency)),
        )

    def on_failure(self, host: str, *, retry_after: Optional[float] = None) -> None:
        st = self._state(host)
        st.consecutive_failures += 1
        # multiplicative decrease
        st.concurrency = max(1.0, st.concurrency / 2.0)
        # server told us how long to wait? honor it.
        if retry_after is not None and retry_after > 0:
            st.circuit_open_until = max(st.circuit_open_until, time.time() + retry_after)
        # too many consecutive failures → open the breaker
        if st.consecutive_failures >= self._config.circuit_breaker_failures:
            st.circuit_open_until = max(
                st.circuit_open_until,
                time.time() + self._config.circuit_breaker_cooldown_sec,
            )
            st.consecutive_failures = 0  # reset so we try again after cooldown

    def snapshot(self, host: str) -> dict:
        st = self._state(host)
        return {
            "host": host,
            "concurrency": st.concurrency,
            "in_flight": st.in_flight,
            "failures": st.consecutive_failures,
            "circuit_open_until": st.circuit_open_until,
            "min_delay_sec": st.min_delay_sec,
        }


class CircuitOpenError(Exception):
    def __init__(self, host: str, cooldown_remaining: float) -> None:
        super().__init__(f"Circuit open for {host} — retry in {cooldown_remaining:.0f}s")
        self.host = host
        self.cooldown_remaining = cooldown_remaining


class _HostGuard:
    """Async context manager returned by ``HostGovernor.acquire()``."""

    def __init__(self, governor: HostGovernor, host: str) -> None:
        self._governor = governor
        self._host = host

    async def __aenter__(self) -> "_HostGuard":
        await self._governor._wait_for_slot(self._host)
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self._governor._release(self._host)


# ---------------------------------------------------------------------------
# Helper that bundles robots + governor into one call the engine uses
# ---------------------------------------------------------------------------


class PolitenessManager:
    """High-level gate used by the engine."""

    def __init__(
        self,
        fetcher: AsyncFetcher,
        config: Optional[CrawlerConfig] = None,
    ) -> None:
        self._config = config or get_config()
        self.robots = RobotsCache(fetcher, self._config)
        self.governor = HostGovernor(self._config)

    def host_of(self, url: str) -> str:
        return urlparse(url).netloc.lower()

    async def prepare_host(self, url: str) -> bool:
        """Ensure robots.txt is loaded and crawl-delay is wired in.

        Returns True if the URL is allowed and the host is not in cooldown.
        Crawl-delay is only applied when ``cfg.enforce_crawl_delay`` is
        True, and even then it's capped at ``cfg.crawl_delay_cap_sec`` so
        a single hostile robots.txt can't stall the entire crawl.
        """
        if not await self.robots.allowed(url):
            return False
        host = self.host_of(url)
        if self.governor.circuit_open(host):
            return False
        if self._config.enforce_crawl_delay:
            delay = await self.robots.crawl_delay(url)
            delay = min(delay, self._config.crawl_delay_cap_sec)
            self.governor.set_min_delay(host, delay)
        else:
            self.governor.set_min_delay(host, self._config.min_per_host_delay_sec)
        return True
