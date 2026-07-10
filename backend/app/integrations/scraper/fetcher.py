"""Async HTTP fetcher with TLS fingerprint spoofing via curl_cffi.

This is tier T3 of the pipeline — the cheap, fast path. ``curl_cffi``
handles JA3/JA4, HTTP/2 SETTINGS, and header ordering so our requests
look like real Chrome/Safari/Edge. The User-Agent is always paired
with the TLS profile that produced it (see ``scraper.config.TLS_PROFILES``).

Callers get ``FetchResult`` back. The engine is responsible for deciding
whether to parse, escalate to tier-5, or accept the 304.
"""

from __future__ import annotations

import asyncio
import random
from dataclasses import dataclass, field
from typing import Optional

from tenacity import (
    AsyncRetrying,
    RetryError,
    retry_if_exception_type,
    stop_after_attempt,
    wait_random_exponential,
)

try:
    from curl_cffi.requests import AsyncSession, RequestsError
except ImportError as exc:  # pragma: no cover — surface a clear error
    raise ImportError(
        "curl_cffi is required for scraper.fetcher. Install with "
        "`pip install curl_cffi` and rerun."
    ) from exc

from app.integrations.scraper.cache import CacheEntry, ETagCache
from app.integrations.scraper.config import TLS_PROFILES, CrawlerConfig, get_config


@dataclass
class Persona:
    """A fixed identity bundle used for all requests on a single domain.

    Consistency inside a session is what makes the crawler look human.
    Rotating TLS profile and UA on every request is an obvious bot tell.
    """

    tls_profile: str
    user_agent: str
    accept_language: str = "en-US,en;q=0.9"
    viewport: tuple[int, int] = (1920, 1080)
    timezone: str = "America/New_York"
    platform: str = "Win32"
    color_scheme: str = "light"
    reading_wpm: int = 240
    click_delay_mu: float = 1.2
    click_delay_sigma: float = 0.7
    hover_before_click: bool = True

    @classmethod
    def random(cls, config: Optional[CrawlerConfig] = None) -> "Persona":
        cfg = config or get_config()
        tls_profile, ua = random.choice(TLS_PROFILES)
        return cls(
            tls_profile=tls_profile,
            user_agent=ua,
            reading_wpm=random.randint(cfg.reading_wpm_min, cfg.reading_wpm_max),
            click_delay_mu=cfg.click_delay_mu,
            click_delay_sigma=cfg.click_delay_sigma,
        )


@dataclass
class FetchResult:
    url: str
    final_url: str
    status: int
    headers: dict
    body: str = ""
    body_bytes: Optional[bytes] = None
    from_cache: bool = False
    not_modified: bool = False
    error: Optional[str] = None
    elapsed_sec: float = 0.0
    retry_after: Optional[float] = None   # seconds the server asked us to wait
    persona: Optional[Persona] = None
    encoding: Optional[str] = None
    extras: dict = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return 200 <= self.status < 300 and self.error is None


def _default_headers(persona: Persona) -> dict:
    """Browser-like header bundle in the order Chrome sends them."""
    return {
        "User-Agent": persona.user_agent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": persona.accept_language,
        "Accept-Encoding": "gzip, deflate, br",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
    }


def _parse_retry_after(value: Optional[str]) -> Optional[float]:
    """RFC 7231 Retry-After can be seconds or an HTTP date."""
    if not value:
        return None
    value = value.strip()
    try:
        return max(0.0, float(value))
    except ValueError:
        pass
    try:
        from email.utils import parsedate_to_datetime
        from datetime import datetime, timezone
        dt = parsedate_to_datetime(value)
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        delta = (dt - datetime.now(timezone.utc)).total_seconds()
        return max(0.0, delta)
    except Exception:
        return None


class AsyncFetcher:
    """One instance per crawl run. Opens a single curl_cffi AsyncSession
    and an ``ETagCache``; both are cleaned up via ``close()`` / async-with.
    """

    def __init__(
        self,
        persona: Optional[Persona] = None,
        cache: Optional[ETagCache] = None,
        config: Optional[CrawlerConfig] = None,
    ) -> None:
        self._config = config or get_config()
        self._persona = persona or Persona.random(self._config)
        self._cache = cache  # may be None — caller owns lifecycle if provided
        self._owns_cache = cache is None
        self._session: Optional[AsyncSession] = None

    @property
    def persona(self) -> Persona:
        return self._persona

    async def open(self) -> None:
        if self._session is not None:
            return
        self._session = AsyncSession(
            impersonate=self._persona.tls_profile,
            timeout=self._config.request_timeout_sec,
        )
        if self._cache is None:
            self._cache = ETagCache(self._config)
        await self._cache.open()

    async def close(self) -> None:
        if self._session is not None:
            try:
                await self._session.close()
            except Exception:
                pass
            self._session = None
        if self._owns_cache and self._cache is not None:
            await self._cache.close()
            self._cache = None

    async def __aenter__(self) -> "AsyncFetcher":
        await self.open()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self.close()

    # ------------------------------------------------------------------
    # The one method everything else calls.
    # ------------------------------------------------------------------
    async def fetch(
        self,
        url: str,
        *,
        referer: Optional[str] = None,
        use_cache: bool = True,
        extra_headers: Optional[dict] = None,
    ) -> FetchResult:
        if self._session is None:
            await self.open()
        assert self._session is not None and self._cache is not None

        cache_entry: Optional[CacheEntry] = None
        if use_cache:
            cache_entry = await self._cache.get(url)

        headers = _default_headers(self._persona)
        if referer:
            headers["Referer"] = referer
            headers["Sec-Fetch-Site"] = "same-origin"
        if cache_entry:
            headers.update(cache_entry.conditional_headers())
        if extra_headers:
            headers.update(extra_headers)

        loop = asyncio.get_event_loop()
        start = loop.time()

        try:
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(self._config.max_retries),
                wait=wait_random_exponential(
                    multiplier=self._config.retry_backoff_base,
                    max=self._config.retry_backoff_max,
                ),
                retry=retry_if_exception_type(RequestsError),
                reraise=True,
            ):
                with attempt:
                    resp = await self._session.get(
                        url,
                        headers=headers,
                        allow_redirects=True,
                    )
        except RetryError as exc:  # pragma: no cover
            return FetchResult(
                url=url,
                final_url=url,
                status=0,
                headers={},
                error=f"RetryError: {exc}",
                elapsed_sec=loop.time() - start,
                persona=self._persona,
            )
        except RequestsError as exc:
            return FetchResult(
                url=url,
                final_url=url,
                status=0,
                headers={},
                error=str(exc),
                elapsed_sec=loop.time() - start,
                persona=self._persona,
            )

        elapsed = loop.time() - start
        resp_headers = {k.lower(): v for k, v in resp.headers.items()}
        retry_after = _parse_retry_after(resp_headers.get("retry-after"))

        # 304 Not Modified — serve the cache entry, no body work
        if resp.status_code == 304 and cache_entry is not None:
            return FetchResult(
                url=url,
                final_url=str(resp.url),
                status=304,
                headers=resp_headers,
                from_cache=True,
                not_modified=True,
                elapsed_sec=elapsed,
                persona=self._persona,
                retry_after=retry_after,
            )

        body_bytes = resp.content or b""
        encoding = resp.encoding or "utf-8"
        try:
            body = body_bytes.decode(encoding, errors="replace")
        except (LookupError, TypeError):
            body = body_bytes.decode("utf-8", errors="replace")
            encoding = "utf-8"

        # Update cache on 2xx HTML responses
        if 200 <= resp.status_code < 300 and use_cache:
            await self._cache.put(
                url,
                etag=resp_headers.get("etag"),
                last_modified=resp_headers.get("last-modified"),
                content=body_bytes,
                status=resp.status_code,
            )

        return FetchResult(
            url=url,
            final_url=str(resp.url),
            status=resp.status_code,
            headers=resp_headers,
            body=body,
            body_bytes=body_bytes,
            elapsed_sec=elapsed,
            retry_after=retry_after,
            persona=self._persona,
            encoding=encoding,
        )
