"""Self-hosted site crawler — the engine behind the Site Audit.

Replaces the billed DataForSEO OnPage task-crawl with an in-process async
crawler that costs $0 and returns live data. Design goals, in priority order:

* **Works on every page** — BFS over same-site links discovered from each page,
  seeded from the homepage and the URLs in robots.txt `Sitemap:` lines.
* **Doesn't get blocked** — a real browser User-Agent + full header set,
  robots.txt obeyed, bounded politeness, and exponential backoff that honours
  `Retry-After` on 429/503.
* **Fast and server-friendly** — level-batched BFS so at most `concurrency`
  requests are ever in flight (one shared HTTP/2 keep-alive pool), the stdlib
  HTML parser (no lxml/bs4 — low memory), response bodies capped and discarded
  after parsing, and a hard wall-clock budget. Tuned to stay well within the
  droplet's 2 GB / 1 vCPU envelope.

A crawl runs as a background asyncio task; the API hands back a job id and the
client polls status. Job state lives in-memory (the API runs a single uvicorn
worker, so the same process serves start + poll).
"""
from __future__ import annotations

import asyncio
import hashlib
import time
from dataclasses import dataclass, field
from urllib.parse import urldefrag, urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx

from app.core.config import settings
from app.core.logging import log
from app.integrations.dataforseo.audit import build_issues, label_for, severity_for
from app.integrations.free.local_onpage import _MetaParser, _classify_links  # noqa: SLF001
from app.services import density

# Asset / non-HTML extensions we never enqueue as crawlable pages.
_SKIP_EXT = (
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico", ".bmp", ".tiff",
    ".css", ".js", ".mjs", ".json", ".xml", ".rss", ".pdf", ".zip", ".gz", ".tar",
    ".rar", ".7z", ".mp3", ".mp4", ".avi", ".mov", ".webm", ".woff", ".woff2",
    ".ttf", ".eot", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".csv",
)

_PENALTY = {"error": 12, "warning": 5, "notice": 1}

# Limit how many crawls run at once across the whole process (memory guard).
_job_gate: asyncio.Semaphore | None = None

# Dedicated crawl client — browser-like so sites don't serve us a bot wall.
_client: httpx.AsyncClient | None = None


def _crawl_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            follow_redirects=True,
            http2=True,
            timeout=httpx.Timeout(settings.crawl_timeout_seconds_per_page, connect=8.0),
            headers={
                "User-Agent": settings.crawl_user_agent,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                # NB: do NOT set Accept-Encoding manually — httpx advertises only
                # the codecs it can actually decode (gzip/deflate, + brotli/zstd
                # when installed). Forcing "br" yields undecodable bytes.
                "Upgrade-Insecure-Requests": "1",
            },
            limits=httpx.Limits(max_connections=24, max_keepalive_connections=12),
        )
    return _client


async def close() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


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


def _in_scope(url: str, base_host: str) -> bool:
    p = urlparse(url)
    if p.scheme not in ("http", "https") or not p.hostname:
        return False
    if _normalize_host(p.hostname.lower()) != base_host:
        return False
    path = p.path.lower()
    return not path.endswith(_SKIP_EXT)


def _clean_url(url: str) -> str:
    """Drop the fragment and trailing slash noise so /a and /a#x dedupe."""
    url, _ = urldefrag(url)
    return url


# --------------------------------------------------------------- per page

def _analyze(raw: str, final_url: str, status: int, load_ms: float) -> tuple[dict, list[str]]:
    """Parse one page into a compact record + the in-scope links it points to."""
    parser = _MetaParser()
    try:
        parser.feed(raw)
    except Exception:  # malformed HTML — keep whatever parsed
        pass

    text = density.extract_text(raw)
    words = density.word_count(text)
    internal, external = _classify_links(parser.hrefs, final_url)
    title = parser.title
    desc = parser.meta_description
    images_missing_alt = sum(1 for im in parser.images if not im["alt"])

    checks: dict[str, bool] = {}
    if status >= 500:
        checks["is_5xx_code"] = True
    elif status >= 400:
        checks["is_4xx_code"] = True
    else:
        if not title:
            checks["no_title"] = True
        elif len(title) > 60:
            checks["title_too_long"] = True
        elif len(title) < 10:
            checks["title_too_short"] = True
        if not desc:
            checks["no_description"] = True
        if not parser.h1:
            checks["no_h1_tag"] = True
        if words < 250:
            checks["low_content_rate"] = True
        if images_missing_alt:
            checks["no_image_alt"] = True
        if urlparse(final_url).scheme == "http":
            checks["is_http"] = True
        if load_ms > 3000:
            checks["high_loading_time"] = True
        if not parser.canonical:
            checks["no_canonical"] = True
        if not parser.has_viewport:
            checks["no_viewport"] = True
        if urlparse(final_url).query:
            checks["seo_friendly_url_dynamic_check"] = True

    # Content fingerprint for cross-page duplicate detection.
    fp = hashlib.sha1(" ".join(text.split())[:5000].encode("utf-8", "ignore")).hexdigest()

    record = {
        "url": final_url,
        "status_code": status,
        "title": title,
        "meta_description": desc,
        "word_count": words,
        "internal_links": internal,
        "external_links": external,
        "load_time_ms": round(load_ms, 1),
        "images_missing_alt": images_missing_alt,
        "checks": checks,
        "fingerprint": fp,
    }
    links = []
    if status < 400:
        for href in parser.hrefs:
            absu = _clean_url(urljoin(final_url, href.strip()))
            if absu:
                links.append(absu)
    return record, links


def _score(checks: dict) -> float:
    penalty = sum(_PENALTY[severity_for(c)] for c in checks)
    return float(max(0, 100 - penalty))


# Markers of a JS bot-challenge interstitial (Cloudflare / similar). No plain
# HTTP crawler can pass these — they need a real browser + challenge solve.
_CHALLENGE_MARKERS = (
    "just a moment", "challenges.cloudflare.com", "cf-mitigated",
    "__cf_chl", "cf_chl_opt", "_cf_chl", "attention required",
    "checking your browser", "ddos-guard", "ray id",
)


def _is_challenge(status: int, raw: str) -> bool:
    if status not in (403, 429, 503):
        return False
    low = raw[:6000].lower()
    return any(m in low for m in _CHALLENGE_MARKERS)


def _challenge_message(domain: str) -> str:
    return (
        f"{domain} is behind a bot-protection challenge (e.g. Cloudflare), which blocks "
        "every automated crawler. Because it's your own site, the fix is free and one-time: "
        f"allowlist this auditor's User-Agent — it contains \"{settings.crawl_user_agent_tag}\". "
        "In Cloudflare go to Security → WAF → Custom rules → Create rule: "
        f"if User-Agent contains \"{settings.crawl_user_agent_tag}\" → Skip (all remaining "
        "managed rules / Bot Fight Mode), Deploy, then run the audit again."
    )


# --------------------------------------------------------------- the crawl

async def _fetch(url: str) -> tuple[int, str, str, float]:
    """Return (status, final_url, html, load_ms). Retries 429/503 with backoff."""
    client = _crawl_client()
    for attempt in range(3):
        t0 = time.monotonic()
        try:
            resp = await client.get(url)
        except httpx.HTTPError as exc:
            raise density.FetchError(str(exc)) from exc
        load_ms = (time.monotonic() - t0) * 1000
        if resp.status_code in (429, 503) and attempt < 2:
            delay = float(resp.headers.get("Retry-After") or (1.5 * (attempt + 1)))
            await asyncio.sleep(min(delay, 8.0))
            continue
        ctype = resp.headers.get("content-type", "")
        if "html" not in ctype.lower() and resp.status_code < 400:
            return resp.status_code, str(resp.url), "", load_ms
        raw = resp.content[: density._MAX_BYTES]  # noqa: SLF001 — shared cap
        return resp.status_code, str(resp.url), raw.decode(resp.encoding or "utf-8", "ignore"), load_ms
    return 0, url, "", 0.0


async def _robots(scheme: str, host: str) -> tuple[RobotFileParser, list[str]]:
    """Fetch robots.txt; return (parser, sitemap_urls). Allow-all on failure."""
    rp = RobotFileParser()
    sitemaps: list[str] = []
    try:
        resp = await _crawl_client().get(f"{scheme}://{host}/robots.txt")
        if resp.status_code < 400 and resp.text:
            rp.parse(resp.text.splitlines())
            sitemaps = [
                ln.split(":", 1)[1].strip()
                for ln in resp.text.splitlines()
                if ln.lower().startswith("sitemap:")
            ]
        else:
            rp.allow_all = True
    except (httpx.HTTPError, Exception):
        rp.allow_all = True
    return rp, sitemaps


def _aggregate(records: list[dict], seed_https: bool, server: str | None, domain: str) -> dict:
    """Roll per-page records into the summary the API/UI expect."""
    # Cross-page duplicate detection.
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
        if r.get("status_code", 0) < 400:
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
        failed = [
            label_for(c) for c in checks if severity_for(c) in ("error", "warning")
        ]
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


async def _run(job: CrawlJob) -> None:
    global _job_gate
    if _job_gate is None:
        _job_gate = asyncio.Semaphore(settings.crawl_max_concurrent_jobs)

    async with _job_gate:
        job.progress = "in_progress"
        seed_host = _normalize_host(job.domain.lower())
        # Verify the host is real & public before crawling (SSRF guard).
        if not await density._is_public_host(seed_host):  # noqa: SLF001
            # www. variant may resolve when the bare host doesn't.
            if not await density._is_public_host("www." + seed_host):  # noqa: SLF001
                job.progress = "error"
                job.error = "That domain could not be resolved. Check the spelling."
                return

        seed = _clean_url(f"https://{job.domain}/")
        rp, sitemaps = await _robots("https", job.domain)

        # Fetch the homepage first: it reveals a site-wide bot wall immediately,
        # so we can return actionable guidance instead of grinding through 403s.
        try:
            s_status, s_url, s_raw, s_ms = await _fetch(seed)
        except density.FetchError as exc:
            job.progress = "error"
            job.error = f"Could not reach {job.domain}: {exc}"
            return
        if _is_challenge(s_status, s_raw):
            job.progress = "error"
            job.error = _challenge_message(job.domain)
            log.info("site_crawl_blocked", domain=job.domain, status=s_status)
            return

        seen: set[str] = {seed}
        frontier: list[str] = []
        records: list[dict] = []
        seed_https = not s_url.startswith("http://")

        seed_rec, seed_links = _analyze(s_raw, s_url, s_status, s_ms)
        records.append(seed_rec)
        for l in seed_links:
            cl = _clean_url(l)
            if cl not in seen and _in_scope(cl, seed_host):
                seen.add(cl)
                frontier.append(cl)
        for sm in sitemaps[:5]:  # add sitemap URLs if present
            cl = _clean_url(sm)
            if _in_scope(cl, seed_host) and cl not in seen:
                seen.add(cl)
                frontier.append(cl)

        deadline = time.monotonic() + settings.crawl_total_timeout_seconds
        ua = settings.crawl_user_agent
        batch = max(1, settings.crawl_concurrency)
        job.pages_crawled = len(records)
        job.pages_in_queue = len(frontier)

        while frontier and len(records) < job.max_pages and time.monotonic() < deadline:
            take = frontier[:batch][: job.max_pages - len(records)]
            frontier = frontier[len(take):]
            take = [u for u in take if rp.can_fetch(ua, u)]
            if not take:
                continue
            results = await asyncio.gather(*(_fetch(u) for u in take), return_exceptions=True)
            for url, res in zip(take, results):
                if isinstance(res, Exception):
                    records.append({
                        "url": url, "status_code": 0, "title": None,
                        "meta_description": None, "word_count": 0, "internal_links": 0,
                        "external_links": 0, "load_time_ms": 0.0, "images_missing_alt": 0,
                        "checks": {"is_broken": True}, "fingerprint": "",
                    })
                    continue
                status, final_url, raw, load_ms = res
                record, links = _analyze(raw, final_url, status, load_ms)
                records.append(record)
                for l in links:
                    cl = _clean_url(l)
                    if cl not in seen and _in_scope(cl, seed_host):
                        seen.add(cl)
                        frontier.append(cl)
            job.pages_crawled = len(records)
            job.pages_in_queue = len(frontier)

        job.result = _aggregate(records, seed_https, None, job.domain)
        job.pages_crawled = len(records)
        job.pages_in_queue = 0
        job.progress = "finished"
        log.info("site_crawl_done", domain=job.domain, pages=len(records),
                 score=job.result["onpage_score"])


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

    asyncio.create_task(_runner())
    return job
