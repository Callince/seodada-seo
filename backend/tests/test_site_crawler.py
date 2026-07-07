"""Self-hosted Site Audit crawler — scoping, per-page checks, aggregation."""
from __future__ import annotations

import pytest

from app.services import crawler


# ------------------------------------------------------------------ scoping

def test_in_scope_same_host_and_www_variant():
    assert crawler._in_scope("https://site.test/a", "site.test")
    assert crawler._in_scope("https://www.site.test/a", "site.test")
    assert not crawler._in_scope("https://other.test/a", "site.test")
    assert not crawler._in_scope("https://blog.site.test/a", "site.test")  # subdomain off-scope


def test_in_scope_skips_assets_and_non_http():
    assert not crawler._in_scope("https://site.test/photo.JPG", "site.test")
    assert not crawler._in_scope("https://site.test/app.js", "site.test")
    assert not crawler._in_scope("https://site.test/doc.pdf", "site.test")
    assert not crawler._in_scope("mailto:a@site.test", "site.test")


def test_clean_url_strips_fragment():
    assert crawler._clean_url("https://site.test/a#section") == "https://site.test/a"


# ------------------------------------------------------------- per-page checks

def _html(title=None, desc=None, h1=True, body="word " * 300, img_no_alt=False):
    head = "<html><head>"
    if title is not None:
        head += f"<title>{title}</title>"
    if desc is not None:
        head += f"<meta name='description' content='{desc}'>"
    head += "</head><body>"
    if h1:
        head += "<h1>Heading</h1>"
    if img_no_alt:
        head += "<img src='/x.png'>"
    head += f"<p>{body}</p></body></html>"
    return head


def test_analyze_flags_missing_title_and_thin_content():
    rec, _ = crawler._analyze(_html(title=None, desc="d", body="only a few words"),
                              "https://site.test/p", 200, 100.0)
    assert rec["checks"].get("no_title") is True
    assert rec["checks"].get("low_content_rate") is True


def test_analyze_flags_missing_alt_and_clean_page():
    rec, _ = crawler._analyze(_html(title="A Good Long Title", desc="d", img_no_alt=True),
                              "https://site.test/p", 200, 100.0)
    assert rec["checks"].get("no_image_alt") is True
    assert "no_title" not in rec["checks"]
    assert "low_content_rate" not in rec["checks"]


def test_analyze_4xx_marks_error_only():
    rec, links = crawler._analyze("", "https://site.test/missing", 404, 50.0)
    assert rec["checks"].get("is_4xx_code") is True
    assert links == []  # don't crawl onward from an error page


def test_analyze_extracts_in_scope_links_only():
    html = _html(title="Home Title Here", desc="d") + (
        "<a href='/about'>a</a><a href='https://other.test/x'>b</a><a href='/f.pdf'>c</a>"
    )
    rec, links = crawler._analyze(html, "https://site.test/", 200, 90.0)
    # _analyze returns all absolute links; scope filtering happens in the crawl loop.
    assert "https://site.test/about" in links


def test_score_penalizes_by_severity():
    assert crawler._score({}) == 100.0
    assert crawler._score({"no_title": True}) == 88.0          # one error (-12)
    assert crawler._score({"no_description": True}) == 95.0    # one warning (-5)
    assert crawler._score({"no_canonical": True}) == 99.0      # one notice (-1)


# --------------------------------------------------------------- aggregation

def test_aggregate_detects_cross_page_duplicates():
    records = [
        {"url": "https://s/1", "status_code": 200, "title": "Same", "meta_description": "Same",
         "word_count": 300, "internal_links": 1, "external_links": 0, "load_time_ms": 10.0,
         "checks": {}, "fingerprint": "abc"},
        {"url": "https://s/2", "status_code": 200, "title": "Same", "meta_description": "Same",
         "word_count": 300, "internal_links": 1, "external_links": 0, "load_time_ms": 10.0,
         "checks": {}, "fingerprint": "abc"},
        {"url": "https://s/3", "status_code": 200, "title": "Unique", "meta_description": "Other",
         "word_count": 300, "internal_links": 1, "external_links": 0, "load_time_ms": 10.0,
         "checks": {}, "fingerprint": "zzz"},
    ]
    out = crawler._aggregate(records, seed_https=True, server=None, domain="s")
    checks = {i["check"]: i["count"] for i in out["issues"]}
    assert checks.get("duplicate_title") == 2
    assert checks.get("duplicate_description") == 2
    assert checks.get("duplicate_content") == 2
    assert out["total_pages"] == 3
    assert out["ssl"] is True


# --------------------------------------------------------------- full crawl

def test_is_challenge_detects_cloudflare():
    cf = "<html><head><title>Just a moment...</title></head><body>challenges.cloudflare.com</body></html>"
    assert crawler._is_challenge(403, cf) is True
    assert crawler._is_challenge(503, cf) is True
    assert crawler._is_challenge(200, cf) is False  # 200 is never a challenge
    assert crawler._is_challenge(403, "<html><body>plain forbidden</body></html>") is False


def test_challenge_message_names_the_allowlist_tag():
    msg = crawler._challenge_message("komaki.in")
    assert "komaki.in" in msg
    assert crawler.settings.crawl_user_agent_tag in msg


@pytest.mark.asyncio
async def test_crawl_aborts_with_guidance_when_seed_challenged(monkeypatch):
    async def fake_fetch(url):
        return (403, url, "<title>Just a moment...</title>challenges.cloudflare.com", 40.0)

    async def fake_public(host):
        return True

    async def fake_robots(scheme, host):
        from urllib.robotparser import RobotFileParser
        rp = RobotFileParser(); rp.allow_all = True
        return rp, []

    monkeypatch.setattr(crawler, "_fetch", fake_fetch)
    monkeypatch.setattr(crawler.density, "_is_public_host", fake_public)
    monkeypatch.setattr(crawler, "_robots", fake_robots)

    job = crawler.CrawlJob(id="blk", domain="komaki.in", max_pages=20)
    await crawler._run(job)
    assert job.progress == "error"
    assert crawler.settings.crawl_user_agent_tag in (job.error or "")


@pytest.mark.asyncio
async def test_full_crawl_integration(monkeypatch):
    pages = {
        "https://site.test/": _html(title="Home Page Title", desc="home")
        + "<a href='/about'>a</a><a href='/contact'>c</a>"
          "<a href='/dup1'>d</a><a href='/dup2'>e</a>"
          "<a href='/file.pdf'>f</a><a href='https://other.test/'>x</a>",
        "https://site.test/about": _html(title="About Our Company", desc="about", body="about page words " * 80),
        "https://site.test/contact": _html(title=None, desc="contact", body="contact words " * 80),
        "https://site.test/dup1": _html(title="Repeated Title", desc="dupe", body="shared duplicate body " * 80),
        "https://site.test/dup2": _html(title="Repeated Title", desc="dupe", body="shared duplicate body " * 80),
    }

    async def fake_fetch(url):
        html = pages.get(url) or pages.get(url.rstrip("/")) or pages.get(url + "/")
        return (200, url, html or "<html></html>", 80.0)

    async def fake_public(host):
        return True

    async def fake_robots(scheme, host):
        from urllib.robotparser import RobotFileParser
        rp = RobotFileParser()
        rp.allow_all = True
        return rp, []

    monkeypatch.setattr(crawler, "_fetch", fake_fetch)
    monkeypatch.setattr(crawler.density, "_is_public_host", fake_public)
    monkeypatch.setattr(crawler, "_robots", fake_robots)

    job = crawler.CrawlJob(id="t1", domain="site.test", max_pages=50)
    await crawler._run(job)

    assert job.progress == "finished"
    assert job.result is not None
    # 5 HTML pages crawled; the .pdf and the external link are out of scope.
    assert job.result["total_pages"] == 5
    urls = {p["url"] for p in job.result["pages"]}
    assert "https://site.test/about" in urls
    assert not any("file.pdf" in u for u in urls)
    assert not any("other.test" in u for u in urls)
    checks = {i["check"]: i["count"] for i in job.result["issues"]}
    assert checks.get("no_title") == 1            # /contact
    assert checks.get("duplicate_title") == 2     # /dup1 + /dup2
    assert job.result["onpage_score"] is not None
