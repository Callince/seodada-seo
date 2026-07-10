"""Site Audit crawl engine — delegates to the advanced TieredCrawler.

Replaces the previous in-process httpx BFS with App B's next-gen async crawler
(`app.integrations.scraper`): curl_cffi TLS spoofing (JA3/JA4) so bot-walls like
Cloudflare don't serve us a challenge, selectolax parsing, robots.txt + AIMD
per-host politeness with a circuit breaker, ETag conditional-GET caching, and an
optional Playwright JS-render tier for SPA sites (`settings.scraper_render_js`).

The public surface is unchanged — a crawl runs as a background asyncio task,
`start_crawl` hands back a job id, and the client polls `get_job`. The per-page
SEO checks and the issue roll-up still flow through the DataForSEO-compatible
`build_issues` so the Site Audit UI is untouched; only the crawl underneath is
far stronger. Job state lives in-memory (single uvicorn worker serves start+poll).
"""
from __future__ import annotations

import asyncio
import glob
import hashlib
import os
import tempfile
import time
from dataclasses import dataclass, field
from urllib.parse import urlparse

from app.core.config import settings
from app.core.logging import log
from app.integrations.dataforseo.audit import build_issues, label_for, severity_for
from app.integrations.scraper import CrawlerConfig, Persona, TieredCrawler
from app.services import density

_PENALTY = {"error": 12, "warning": 5, "notice": 1}

# Limit how many crawls run at once across the whole process (memory guard).
_job_gate: asyncio.Semaphore | None = None


async def close() -> None:
    """Lifecycle hook (main.py shutdown). The TieredCrawler is per-crawl and
    closed inside `_run`, so there's no long-lived client to tear down."""
    return None


# ----------------------------------------------------------------- job store

@dataclass(slots=True)
class CrawlJob:
    id: str
    domain: str
    max_pages: int
    progress: str = "queued"  # queued | in_progress | finished | error
    pages_crawled: int = 0
    pages_in_queue: int = 0
    started_at: float = field(default_factory=time.monotonic)
    result: dict | None = None
    error: str | None = None


_JOBS: dict[str, CrawlJob] = {}
_MAX_JOBS = 50


def _remember(job: CrawlJob) -> None:
    _JOBS[job.id] = job
    if len(_JOBS) > _MAX_JOBS:  # drop the oldest finished jobs
        for jid in sorted(_JOBS, key=lambda k: _JOBS[k].started_at)[: len(_JOBS) - _MAX_JOBS]:
            _JOBS.pop(jid, None)


def get_job(job_id: str) -> CrawlJob | None:
    return _JOBS.get(job_id)


# ------------------------------------------------------------------ scoping

def _normalize_host(host: str) -> str:
    return host[4:] if host.startswith("www.") else host


# --------------------------------------------------------- record → audit

def _score(checks: dict) -> float:
    penalty = sum(_PENALTY[severity_for(c)] for c in checks)
    return float(max(0, 100 - penalty))


def _checks_for(rec) -> dict[str, bool]:
    """Map one CrawlRecord (+ its extractor extras) to the audit check flags —
    the same flag names the DataForSEO issue-builder expects."""
    checks: dict[str, bool] = {}
    status = rec.status
    if status >= 500:
        checks["is_5xx_code"] = True
        return checks
    if status >= 400:
        checks["is_4xx_code"] = True
        return checks
    if status <= 0 or rec.error:
        checks["is_broken"] = True
        return checks

    meta = rec.extras.get("_meta")
    headings = rec.extras.get("_headings", [])
    images = rec.extras.get("_images", [])
    title = meta.title if meta else None
    desc = meta.description if meta else None

    if not title:
        checks["no_title"] = True
    elif len(title) > 60:
        checks["title_too_long"] = True
    elif len(title) < 10:
        checks["title_too_short"] = True
    if not desc:
        checks["no_description"] = True
    if not any(getattr(h, "level", 0) == 1 for h in headings):
        checks["no_h1_tag"] = True
    if rec.word_count < 250:
        checks["low_content_rate"] = True
    if any(not getattr(im, "alt", "") for im in images):
        checks["no_image_alt"] = True
    if urlparse(rec.final_url).scheme == "http":
        checks["is_http"] = True
    if meta and not meta.canonical:
        checks["no_canonical"] = True
    if meta and not meta.viewport:
        checks["no_viewport"] = True
    if urlparse(rec.final_url).query:
        checks["seo_friendly_url_dynamic_check"] = True
    return checks


def _audit_record(rec) -> dict:
    """Compact per-page record in the shape `_aggregate` consumes."""
    link_refs = rec.extras.get("_link_refs", [])
    internal = sum(1 for l in link_refs if getattr(l, "is_internal", False))
    external = len(link_refs) - internal
    meta = rec.extras.get("_meta")
    text = rec.extras.get("_text")
    body = (getattr(text, "full_text", "") or getattr(text, "main_text", "")) if text else ""
    fp = (
        hashlib.sha1(" ".join(body.split())[:5000].encode("utf-8", "ignore")).hexdigest()
        if rec.status and rec.status < 400 and body
        else ""
    )
    return {
        "url": rec.final_url or rec.url,
        "status_code": rec.status,
        "title": meta.title if meta else None,
        "meta_description": meta.description if meta else None,
        "word_count": rec.word_count,
        "internal_links": internal,
        "external_links": external,
        # Per-request latency isn't carried on CrawlRecord (JS render / cache
        # muddy a single number), so the high-loading-time check is not raised.
        "load_time_ms": 0.0,
        "images_missing_alt": sum(1 for im in rec.extras.get("_images", []) if not getattr(im, "alt", "")),
        "checks": _checks_for(rec),
        "fingerprint": fp,
    }


def _aggregate(records: list[dict], seed_https: bool, server: str | None, domain: str) -> dict:
    """Roll per-page records into the summary the API/UI expect."""
    def _dups(key: str) -> set:
        counts: dict[str, int] = {}
        for r in records:
            v = r.get(key)
            if v:
                counts[v] = counts.get(v, 0) + 1
        return {v for v, n in counts.items() if n > 1}

    dup_titles = _dups("title")
    dup_descs = _dups("meta_description")
    dup_fps = _dups("fingerprint")

    check_counts: dict[str, int] = {}
    page_rows: list[dict] = []
    score_sum = 0.0
    for r in records:
        checks = dict(r["checks"])
        if r.get("status_code", 0) < 400 and r.get("status_code", 0) > 0:
            if r["title"] in dup_titles:
                checks["duplicate_title"] = True
            if r["meta_description"] in dup_descs:
                checks["duplicate_description"] = True
            if r["fingerprint"] in dup_fps:
                checks["duplicate_content"] = True
        for c in checks:
            check_counts[c] = check_counts.get(c, 0) + 1
        sc = _score(checks)
        score_sum += sc
        failed = [label_for(c) for c in checks if severity_for(c) in ("error", "warning")]
        page_rows.append({
            "url": r["url"],
            "status_code": r["status_code"],
            "onpage_score": round(sc, 1),
            "title": r["title"],
            "word_count": r["word_count"],
            "internal_links": r["internal_links"],
            "external_links": r["external_links"],
            "load_time_ms": r["load_time_ms"],
            "failed_checks": failed[:6],
        })

    issues = build_issues(check_counts)
    sev_totals = {"error": 0, "warning": 0, "notice": 0}
    for i in issues:
        sev_totals[i["severity"]] += i["count"]
    page_rows.sort(key=lambda p: p["onpage_score"])  # worst first
    health = round(score_sum / len(records)) if records else None
    return {
        "onpage_score": health,
        "total_pages": len(records),
        "ssl": seed_https and not any("is_http" in r["checks"] for r in records),
        "cms": None,
        "server": server,
        "errors": sev_totals["error"],
        "warnings": sev_totals["warning"],
        "notices": sev_totals["notice"],
        "issues": issues,
        "pages": page_rows,
    }


# --------------------------------------------------------------- challenge

def _challenge_message(domain: str) -> str:
    return (
        f"{domain} is behind a bot-protection challenge (e.g. Cloudflare) that blocked every "
        "request even with browser-grade TLS — so no pages could be read. If it's your own "
        "site, lower the protection for the crawl: in Cloudflare turn off Bot Fight Mode "
        "(Security → Bots) and 'Under Attack' mode, or add a WAF Skip / IP allow-rule for the "
        "machine running this audit, then re-run. Enabling JS rendering can get past a "
        "lightweight challenge. If it isn't your site, it does not permit automated crawling."
    )


# --------------------------------------------------------------- the crawl

def _job_db_path(job_id: str) -> str:
    """Per-audit SQLite path. The frontier persists seen-URLs and the ETag cache
    persists bodies, both keyed to this file — so each audit gets its own fresh,
    isolated DB (a re-audit must re-crawl, not dedupe against a prior run)."""
    return os.path.join(tempfile.gettempdir(), f"fourdm_audit_{job_id}.sqlite")


def _cleanup_job_db(job_id: str) -> None:
    base = _job_db_path(job_id)
    stem = base[:-7] if base.endswith(".sqlite") else base
    # Remove the cache DB, the derived frontier DB, and their WAL/SHM sidecars.
    for path in glob.glob(stem + "*"):
        try:
            os.remove(path)
        except OSError:
            pass


def _build_config(job_id: str) -> CrawlerConfig:
    """A CrawlerConfig tuned from the app settings (small-box friendly)."""
    return CrawlerConfig(
        request_timeout_sec=settings.crawl_timeout_seconds_per_page,
        connect_timeout_sec=8.0,
        per_host_concurrency_cap=max(2, settings.crawl_concurrency),
        global_concurrency_cap=max(4, settings.crawl_concurrency),
        respect_robots_txt=True,
        cache_db_path=_job_db_path(job_id),
    )


async def _run(job: CrawlJob) -> None:
    global _job_gate
    if _job_gate is None:
        _job_gate = asyncio.Semaphore(settings.crawl_max_concurrent_jobs)

    async with _job_gate:
        job.progress = "in_progress"
        seed_host = _normalize_host(job.domain.lower())
        # Verify the host is real & public before crawling (SSRF guard).
        if not await density._is_public_host(seed_host):  # noqa: SLF001
            if not await density._is_public_host("www." + seed_host):  # noqa: SLF001
                job.progress = "error"
                job.error = "That domain could not be resolved. Check the spelling."
                return

        seed = f"https://{job.domain}/"
        cfg = _build_config(job.id)
        persona = Persona.random(cfg)

        renderer = None
        if settings.scraper_render_js:
            try:
                from app.integrations.scraper.renderer import PlaywrightRenderer

                renderer = PlaywrightRenderer(persona, config=cfg)
                await renderer.open()
            except Exception as exc:  # Playwright missing/unopenable — HTTP-only.
                log.info("site_crawl_no_renderer", domain=job.domain, error=repr(exc))
                renderer = None

        def _on_page(_doc, _rec) -> None:
            job.pages_crawled += 1

        try:
            async with TieredCrawler(
                config=cfg, persona=persona, renderer=renderer, on_page=_on_page
            ) as crawler:
                report = await crawler.crawl(
                    [seed],
                    max_pages=job.max_pages,
                    max_depth=settings.crawl_max_depth,
                    workers=max(1, settings.crawl_concurrency),
                    allowed_hosts={seed_host},  # stay on the audited domain
                    use_cache=False,            # every audit fetches fresh content
                )
        except Exception as exc:
            job.progress = "error"
            job.error = f"Could not reach {job.domain}: {exc}"
            log.error("site_crawl_failed", domain=job.domain, error=repr(exc))
            return

        # Bot-wall detection: if nothing came back as a real (2xx/3xx) page and the
        # responses we did get are challenge statuses, the site is blocking us — a
        # Cloudflare "Just a moment…" page is served as a 403, so it can arrive as a
        # page rather than an error. Either way, report it clearly.
        all_records = list(report.pages) + list(report.errors)
        successful = [r for r in all_records if r.status and 200 <= r.status < 400]
        blocked = [r for r in all_records if r.status in (401, 403, 429, 503)]
        if not successful and blocked:
            job.progress = "error"
            job.error = _challenge_message(job.domain)
            log.info("site_crawl_blocked", domain=job.domain, status=blocked[0].status)
            return

        if not all_records:
            job.progress = "error"
            job.error = f"No pages could be crawled on {job.domain}."
            return

        audit_records = [_audit_record(r) for r in all_records]
        job.result = _aggregate(audit_records, True, None, job.domain)
        job.pages_crawled = len(all_records)
        job.pages_in_queue = 0
        job.progress = "finished"
        log.info(
            "site_crawl_done",
            domain=job.domain,
            pages=len(all_records),
            js_renders=report.total_js_renders,
            cached=report.total_cached,
            score=job.result["onpage_score"],
        )


def start_crawl(job_id: str, domain: str, max_pages: int) -> CrawlJob:
    """Create a job and launch the crawl in the background; returns immediately."""
    job = CrawlJob(id=job_id, domain=domain, max_pages=max_pages)
    _remember(job)

    async def _runner() -> None:
        try:
            await _run(job)
        except Exception as exc:  # never let a crawl crash silently
            job.progress = "error"
            job.error = str(exc)
            log.error("site_crawl_failed", domain=domain, error=repr(exc))
        finally:
            # The TieredCrawler has closed its SQLite connections by now, so the
            # per-audit cache/frontier files can be removed.
            _cleanup_job_db(job.id)

    asyncio.create_task(_runner())
    return job
