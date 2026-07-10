"""TieredCrawler — the T0..T8 pipeline.

Flow for a single URL:

    T0  Canonicalize + dedupe      →  scraper.frontier
    T1  Politeness gate             →  scraper.politeness (robots + AIMD + breaker)
    T2  Conditional GET (ETag)      →  scraper.fetcher + scraper.cache
    T3  Fast HTTP fetch              →  scraper.fetcher (curl_cffi TLS spoof)
    T4  Emptiness detect             →  scraper.parser.needs_js
    T5  JS render fallback           →  scraper.renderer (Phase 4 — optional)
    T6  Parse once                    →  scraper.parser
    T7  Extract fanout                →  scraper.extractors
    T8  Persist + enqueue outlinks   →  scraper.frontier

This module does not know about Playwright; the renderer is injected
at construction time so Phase 4 can plug it in without touching T0..T4.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Callable, List, Optional, Protocol
from urllib.parse import urlparse

from app.integrations.scraper.cache import ETagCache
from app.integrations.scraper.config import CrawlerConfig, get_config
from app.integrations.scraper.extractors import (
    extract_headings,
    extract_images,
    extract_json_ld,
    extract_links,
    extract_meta,
    extract_text,
)
from app.integrations.scraper.fetcher import AsyncFetcher, FetchResult, Persona
from app.integrations.scraper.frontier import Frontier
from app.integrations.scraper.humanizer import Humanizer, Mode, looks_like_captcha
from app.integrations.scraper.parser import ParsedDoc, needs_js, parse_html
from app.integrations.scraper.politeness import CircuitOpenError, PolitenessManager
from app.integrations.scraper import metrics

log = logging.getLogger(__name__)


def _host_norm(host: str) -> str:
    """Strip a leading www. so example.com and www.example.com compare equal."""
    return host[4:] if host.startswith("www.") else host


# ---------------------------------------------------------------------------
# Renderer protocol — Phase 4 plugs a Playwright-backed impl in here.
# ---------------------------------------------------------------------------


class Renderer(Protocol):
    async def render(self, url: str, *, referer: Optional[str] = None) -> FetchResult: ...
    async def close(self) -> None: ...


# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------


@dataclass
class CrawlRecord:
    url: str
    final_url: str
    status: int
    depth: int
    fetched_with_js: bool
    from_cache: bool
    word_count: int
    title: Optional[str]
    description: Optional[str]
    links_count: int
    images_count: int
    headings_count: int
    schema_count: int
    error: Optional[str] = None
    extras: dict = field(default_factory=dict)


@dataclass
class CrawlReport:
    seeds: List[str]
    pages: List[CrawlRecord] = field(default_factory=list)
    errors: List[CrawlRecord] = field(default_factory=list)
    total_requests: int = 0
    total_cached: int = 0
    total_js_renders: int = 0
    elapsed_sec: float = 0.0


# ---------------------------------------------------------------------------
# TieredCrawler
# ---------------------------------------------------------------------------


class TieredCrawler:
    def __init__(
        self,
        *,
        config: Optional[CrawlerConfig] = None,
        persona: Optional[Persona] = None,
        renderer: Optional[Renderer] = None,
        humanizer: Optional[Humanizer] = None,
        on_page: Optional[Callable[[ParsedDoc, CrawlRecord], Any]] = None,
    ) -> None:
        self._config = config or get_config()
        self._persona = persona or Persona.random(self._config)
        self._renderer = renderer
        self._humanizer = humanizer or Humanizer(self._config)
        self._on_page = on_page

        # These are created in open()
        self._cache: Optional[ETagCache] = None
        self._fetcher: Optional[AsyncFetcher] = None
        self._politeness: Optional[PolitenessManager] = None
        self._frontier: Optional[Frontier] = None

    # ---- lifecycle ----------------------------------------------------
    async def open(self) -> None:
        if self._fetcher is not None:
            return
        self._cache = ETagCache(self._config)
        await self._cache.open()
        self._fetcher = AsyncFetcher(
            persona=self._persona,
            cache=self._cache,
            config=self._config,
        )
        await self._fetcher.open()
        self._politeness = PolitenessManager(self._fetcher, self._config)
        # Separate file for the frontier so its writes don't fight the
        # ETag cache's writes for the same SQLite lock.
        frontier_path = self._config.cache_db_path
        if frontier_path.endswith(".sqlite"):
            frontier_path = frontier_path[:-7] + ".frontier.sqlite"
        else:
            frontier_path = frontier_path + ".frontier"
        self._frontier = Frontier(db_path=frontier_path, config=self._config)
        await self._frontier.open()

    async def close(self) -> None:
        if self._frontier is not None:
            await self._frontier.close()
            self._frontier = None
        if self._fetcher is not None:
            await self._fetcher.close()
            self._fetcher = None
        if self._cache is not None:
            # fetcher owns the cache if we passed it in
            pass
        if self._renderer is not None:
            try:
                await self._renderer.close()
            except Exception:
                pass

    async def __aenter__(self) -> "TieredCrawler":
        await self.open()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self.close()

    # ---- public entry points ------------------------------------------
    async def crawl(
        self,
        seeds: List[str],
        *,
        max_pages: int = 100,
        max_depth: int = 2,
        workers: Optional[int] = None,
        allowed_hosts: Optional[set[str]] = None,
        use_cache: bool = True,
    ) -> CrawlReport:
        """Run a bounded crawl from ``seeds``.

        ``allowed_hosts`` (www-stripped) scopes enqueued outlinks to those hosts,
        so a single-site crawl (e.g. Site Audit) never wanders off-domain.
        ``use_cache=False`` bypasses the ETag cache so every run fetches fresh
        full content (re-audits must not see empty 304 bodies).
        """
        assert self._frontier is not None
        allowed = {_host_norm(h) for h in allowed_hosts} if allowed_hosts else None
        loop = asyncio.get_event_loop()
        start_t = loop.time()

        for seed in seeds:
            await self._frontier.add(seed, depth=0)

        report = CrawlReport(seeds=list(seeds))
        n_workers = workers or min(self._config.global_concurrency_cap, 10)

        processed = 0
        processed_lock = asyncio.Lock()
        done = asyncio.Event()

        async def worker():
            nonlocal processed
            while True:
                if processed >= max_pages or done.is_set():
                    return
                item = await self._frontier.pop()
                if item is None:
                    # Frontier empty — give the other workers a beat to enqueue
                    await asyncio.sleep(0.05)
                    if self._frontier.empty():
                        return
                    continue
                depth = item.priority[0]
                if depth > max_depth:
                    continue

                try:
                    doc, fetch = await self._process_one(item.url, item.referer, use_cache=use_cache)
                except CircuitOpenError as exc:
                    log.info("circuit-open %s", exc)
                    continue
                except Exception as exc:  # defensive — don't let a worker die
                    log.exception("worker error for %s: %s", item.url, exc)
                    report.errors.append(
                        CrawlRecord(
                            url=item.url,
                            final_url=item.url,
                            status=0,
                            depth=depth,
                            fetched_with_js=False,
                            from_cache=False,
                            word_count=0,
                            title=None,
                            description=None,
                            links_count=0,
                            images_count=0,
                            headings_count=0,
                            schema_count=0,
                            error=str(exc),
                        )
                    )
                    continue

                if doc is None:
                    if fetch is not None and fetch.error:
                        report.errors.append(
                            CrawlRecord(
                                url=item.url,
                                final_url=fetch.final_url,
                                status=fetch.status,
                                depth=depth,
                                fetched_with_js=False,
                                from_cache=False,
                                word_count=0,
                                title=None,
                                description=None,
                                links_count=0,
                                images_count=0,
                                headings_count=0,
                                schema_count=0,
                                error=fetch.error,
                            )
                        )
                    continue

                # --- T7: Extract fanout ----------------------------------
                record = self._build_record(doc, depth)
                report.pages.append(record)
                report.total_requests += 1
                if doc.from_cache:
                    report.total_cached += 1
                if doc.fetched_with_js:
                    report.total_js_renders += 1

                if self._on_page is not None:
                    try:
                        result = self._on_page(doc, record)
                        if asyncio.iscoroutine(result):
                            await result
                    except Exception:
                        log.exception("on_page callback failed")

                # --- T8: Persist + enqueue outlinks ----------------------
                if depth + 1 <= max_depth:
                    for link in record.extras.get("_links", []):
                        if allowed is not None:
                            host = urlparse(link).hostname or ""
                            if _host_norm(host.lower()) not in allowed:
                                continue
                        await self._frontier.add(
                            link,
                            depth=depth + 1,
                            referer=doc.final_url,
                        )

                async with processed_lock:
                    processed += 1
                    if processed >= max_pages:
                        done.set()
                        return

        await asyncio.gather(*(worker() for _ in range(n_workers)))
        report.elapsed_sec = loop.time() - start_t
        return report

    # ---- per-URL pipeline ---------------------------------------------
    async def _process_one(
        self,
        url: str,
        referer: Optional[str],
        *,
        use_cache: bool = True,
    ) -> tuple[Optional[ParsedDoc], Optional[FetchResult]]:
        """T1..T6 for a single URL. Returns (doc, last fetch result)."""
        assert self._fetcher is not None
        assert self._politeness is not None

        host = self._politeness.host_of(url)

        # T1: politeness gate — robots.txt + circuit breaker
        allowed = await self._politeness.prepare_host(url)
        if not allowed:
            log.info("blocked by politeness: %s", url)
            return None, None

        # Humanizer: in polite/persona mode, sleep a log-normal delay before fetch
        action = self._humanizer.plan(host)
        if action.pre_fetch_sleep > 0:
            await asyncio.sleep(action.pre_fetch_sleep)

        # T1.5: acquire per-host concurrency slot
        try:
            async with self._politeness.governor.acquire(host):
                # T2 + T3: conditional GET, fast HTTP fetch
                fetch = await self._fetcher.fetch(url, referer=referer, use_cache=use_cache)
        except CircuitOpenError:
            raise

        # --- Metrics: fetch latency + status ------------------------------
        metrics.record_fetch(host, fetch.status, fetch.elapsed_sec, tier="http")
        if fetch.error:
            metrics.record_error(host, type(fetch.error).__name__ if not isinstance(fetch.error, str) else "RequestError")
        if fetch.not_modified:
            metrics.record_cache_hit(host)

        # Feed AIMD / circuit breaker AND humanizer hostility tracker
        if fetch.ok:
            self._politeness.governor.on_success(host)
            self._humanizer.on_success(host)
        else:
            self._politeness.governor.on_failure(host, retry_after=fetch.retry_after)
            if fetch.status in (403, 429) or looks_like_captcha(fetch.body):
                self._humanizer.on_block(host, fetch.status, fetch.body)
            if not fetch.not_modified:
                return None, fetch

        # --- Metrics: live governor + humanizer state ---------------------
        gov_snap = self._politeness.governor.snapshot(host)
        metrics.update_host_concurrency(host, gov_snap["concurrency"])
        metrics.update_circuit_state(host, self._politeness.governor.circuit_open(host))
        metrics.update_hostility(host, self._humanizer.score_of(host))

        # T2 hit: 304 from cache → nothing to parse; report it but skip extract
        if fetch.not_modified:
            doc = ParsedDoc(
                url=url,
                final_url=fetch.final_url,
                status=304,
                tree=parse_html("", url=url).tree,
                headers=fetch.headers,
                raw_html="",
                from_cache=True,
            )
            return doc, fetch

        # T6: parse once
        doc = parse_html(
            fetch.body,
            url=url,
            final_url=fetch.final_url,
            status=fetch.status,
            headers=fetch.headers,
        )

        # T4: emptiness detector → maybe T5 Playwright render.
        # Also trigger if the humanizer has escalated this host to persona mode.
        should_render = self._renderer is not None and (
            needs_js(doc, self._config)
            or self._humanizer.mode_of(host) is Mode.PERSONA
        )
        if should_render:
            log.info("escalating to JS render: %s", url)
            self._humanizer.on_js_escalation(host)
            reason = "persona_mode" if self._humanizer.mode_of(host) is Mode.PERSONA else "emptiness"
            metrics.record_js_render(host, reason=reason)
            js_fetch = await self._renderer.render(url, referer=referer)
            if js_fetch.ok:
                metrics.record_fetch(host, js_fetch.status, js_fetch.elapsed_sec, tier="js")
                doc = parse_html(
                    js_fetch.body,
                    url=url,
                    final_url=js_fetch.final_url,
                    status=js_fetch.status,
                    headers=js_fetch.headers,
                    fetched_with_js=True,
                )
                fetch = js_fetch

        return doc, fetch

    def _build_record(self, doc: ParsedDoc, depth: int) -> CrawlRecord:
        meta = extract_meta(doc)
        metrics.record_extractor("meta")
        links = extract_links(doc)
        metrics.record_extractor("links")
        images = extract_images(doc)
        metrics.record_extractor("images")
        headings = extract_headings(doc)
        metrics.record_extractor("headings")
        schemas = extract_json_ld(doc)
        metrics.record_extractor("schema")
        text = extract_text(doc)
        metrics.record_extractor("text")

        record = CrawlRecord(
            url=doc.url,
            final_url=doc.final_url,
            status=doc.status,
            depth=depth,
            fetched_with_js=doc.fetched_with_js,
            from_cache=doc.from_cache,
            word_count=text.word_count,
            title=meta.title,
            description=meta.description,
            links_count=len(links),
            images_count=len(images),
            headings_count=len(headings),
            schema_count=len(schemas),
        )
        # Stash the raw extractor outputs for callers that want them
        record.extras = {
            "_meta": meta,
            "_links": [l.url for l in links],
            "_link_refs": links,
            "_images": images,
            "_headings": headings,
            "_schemas": schemas,
            "_text": text,
        }
        return record
