"""Site Audit — record→check mapping, scoring, and aggregation.

The crawl itself is the ported TieredCrawler (`app.integrations.scraper`);
these tests cover the audit glue in `app.services.crawler` that maps a
CrawlRecord (+ its extractor extras) to the DataForSEO-compatible checks and
rolls them up. They run fully offline against synthetic records.
"""
from __future__ import annotations

from types import SimpleNamespace

from app.integrations.scraper import CrawlRecord
from app.services import crawler


def _rec(
    *,
    status: int = 200,
    url: str = "https://site.test/p",
    title: str | None = "A Good Long Title",
    desc: str | None = "a fine description",
    h1: bool = True,
    words: int = 300,
    img_no_alt: bool = False,
    internal: int = 1,
    external: int = 0,
    canonical: str | None = "https://site.test/p",
    viewport: str | None = "width=device-width",
    body: str = "word " * 300,
    error: str | None = None,
) -> CrawlRecord:
    """Build a CrawlRecord with the extractor extras `_checks_for` reads."""
    meta = SimpleNamespace(title=title, description=desc, canonical=canonical, viewport=viewport)
    headings = [SimpleNamespace(level=1, text="H")] if h1 else [SimpleNamespace(level=2, text="H2")]
    images = [SimpleNamespace(alt="" if img_no_alt else "alt text")]
    link_refs = [SimpleNamespace(is_internal=True)] * internal + [SimpleNamespace(is_internal=False)] * external
    text = SimpleNamespace(full_text=body, main_text=body, word_count=words)
    rec = CrawlRecord(
        url=url, final_url=url, status=status, depth=0, fetched_with_js=False,
        from_cache=False, word_count=words, title=title, description=desc,
        links_count=len(link_refs), images_count=len(images),
        headings_count=len(headings), schema_count=0, error=error,
    )
    rec.extras = {
        "_meta": meta, "_headings": headings, "_images": images,
        "_link_refs": link_refs, "_links": [], "_text": text,
    }
    return rec


# ------------------------------------------------------------------ scoping

def test_normalize_host_strips_www():
    assert crawler._normalize_host("www.site.test") == "site.test"
    assert crawler._normalize_host("site.test") == "site.test"


# ------------------------------------------------------------- per-page checks

def test_checks_flag_missing_title_and_thin_content():
    checks = crawler._checks_for(_rec(title=None, desc="d", words=10, body="only a few words"))
    assert checks.get("no_title") is True
    assert checks.get("low_content_rate") is True


def test_checks_flag_missing_alt_on_otherwise_clean_page():
    checks = crawler._checks_for(_rec(img_no_alt=True))
    assert checks.get("no_image_alt") is True
    assert "no_title" not in checks
    assert "low_content_rate" not in checks


def test_checks_flag_http_missing_canonical_and_viewport():
    checks = crawler._checks_for(
        _rec(url="http://site.test/p", canonical=None, viewport=None)
    )
    assert checks.get("is_http") is True
    assert checks.get("no_canonical") is True
    assert checks.get("no_viewport") is True


def test_checks_title_length_bounds():
    assert crawler._checks_for(_rec(title="short"))["title_too_short"] is True
    assert crawler._checks_for(_rec(title="x" * 80))["title_too_long"] is True


def test_checks_4xx_marks_error_only():
    checks = crawler._checks_for(_rec(status=404, title=None))
    assert checks == {"is_4xx_code": True}  # no content checks on an error page


def test_checks_5xx_and_broken():
    assert crawler._checks_for(_rec(status=500)) == {"is_5xx_code": True}
    assert crawler._checks_for(_rec(status=0, error="conn reset")) == {"is_broken": True}


def test_checks_dynamic_url():
    assert crawler._checks_for(_rec(url="https://site.test/p?ref=x")).get(
        "seo_friendly_url_dynamic_check"
    ) is True


# ------------------------------------------------------- record → audit dict

def test_audit_record_maps_links_and_alt_and_fingerprint():
    rec = _rec(internal=3, external=2, img_no_alt=True, body="unique body text here")
    out = crawler._audit_record(rec)
    assert out["internal_links"] == 3
    assert out["external_links"] == 2
    assert out["images_missing_alt"] == 1
    assert out["fingerprint"]  # non-empty content hash for a 200 page
    assert out["status_code"] == 200


def test_audit_record_no_fingerprint_for_error_page():
    out = crawler._audit_record(_rec(status=404, body=""))
    assert out["fingerprint"] == ""


# ----------------------------------------------------------------- scoring

def test_score_penalizes_by_severity():
    assert crawler._score({}) == 100.0
    assert crawler._score({"no_title": True}) == 88.0        # one error (-12)
    assert crawler._score({"no_description": True}) == 95.0   # one warning (-5)
    assert crawler._score({"no_canonical": True}) == 99.0     # one notice (-1)


# --------------------------------------------------------------- aggregation

def test_aggregate_detects_cross_page_duplicates():
    base = {
        "word_count": 300, "internal_links": 1, "external_links": 0,
        "load_time_ms": 10.0, "images_missing_alt": 0, "checks": {},
    }
    records = [
        {"url": "https://s/1", "status_code": 200, "title": "Same", "meta_description": "Same", "fingerprint": "abc", **base},
        {"url": "https://s/2", "status_code": 200, "title": "Same", "meta_description": "Same", "fingerprint": "abc", **base},
        {"url": "https://s/3", "status_code": 200, "title": "Unique", "meta_description": "Other", "fingerprint": "zzz", **base},
    ]
    out = crawler._aggregate(records, seed_https=True, server=None, domain="s")
    counts = {i["check"]: i["count"] for i in out["issues"]}
    assert counts.get("duplicate_title") == 2
    assert counts.get("duplicate_description") == 2
    assert counts.get("duplicate_content") == 2
    assert out["total_pages"] == 3
    assert out["ssl"] is True


def test_aggregate_end_to_end_from_records():
    """The post-crawl path: CrawlRecords → _audit_record → _aggregate."""
    recs = [
        _rec(url="https://site.test/", title="Home Page Title"),
        _rec(url="https://site.test/contact", title=None),          # no_title
        _rec(url="https://site.test/dup1", title="Repeated", body="shared duplicate body"),
        _rec(url="https://site.test/dup2", title="Repeated", body="shared duplicate body"),
    ]
    out = crawler._aggregate([crawler._audit_record(r) for r in recs], True, None, "site.test")
    counts = {i["check"]: i["count"] for i in out["issues"]}
    assert out["total_pages"] == 4
    assert counts.get("no_title") == 1
    assert counts.get("duplicate_title") == 2
    assert out["onpage_score"] is not None


# ----------------------------------------------------------------- challenge

def test_challenge_message_explains_the_block():
    msg = crawler._challenge_message("komaki.in")
    assert "komaki.in" in msg
    # Names the culprit and points to the real fix (Cloudflare / lower protection).
    assert "Cloudflare" in msg and ("Bot Fight Mode" in msg or "WAF" in msg)


# --------------------------------------------------------- shared job store

async def test_get_job_reads_published_state_when_not_local(monkeypatch):
    """A poll landing on a replica that didn't run the crawl (or after a restart)
    must still find the job via the shared cache mirror."""
    job = crawler.CrawlJob(id="j1", domain="site.test", max_pages=10)
    job.progress = "finished"
    job.pages_crawled = 7
    job.result = {"onpage_score": 90}
    await crawler._publish(job)
    crawler._JOBS.pop("j1", None)  # simulate a different process

    restored = await crawler.get_job("j1")
    assert restored is not None
    assert restored.progress == "finished"
    assert restored.pages_crawled == 7
    assert restored.result == {"onpage_score": 90}

    assert await crawler.get_job("missing") is None
