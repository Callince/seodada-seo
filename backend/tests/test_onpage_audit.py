from __future__ import annotations

import pytest

from app.db.models import Organization, User
from app.integrations.dataforseo.client import DfsResult
from app.integrations.free import local_onpage
from app.services import competitive, density, pixels, scoring

_DOC = """<html lang="en"><head>
<title>Best Running Shoes 2026 — Reviews and Buying Guide for Road Runners</title>
<meta name="description" content="A complete hands-on guide to the best running shoes for road and trail runners in 2026, with expert reviews and side-by-side comparisons.">
<meta name="robots" content="index,follow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="https://example.com/best-running-shoes">
<meta property="og:title" content="Best Running Shoes">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"x"}</script>
</head><body>
<h1>Best Running Shoes</h1><h2>Road shoes</h2><h2>Trail shoes</h2>
<img src="a.jpg" alt="running shoes on a road"><img src="b.jpg">
<a href="/guide">internal</a><a href="https://other.com/x">external</a>
<p>__BODY__</p></body></html>"""


def _doc(body_repeat: int = 60) -> str:
    return _DOC.replace("__BODY__", "running shoes are great for every runner who runs. " * body_repeat)


def test_pixel_width_and_truncation():
    assert pixels.text_width_px("", 20) == 0
    short = pixels.text_width_px("Hi", 20)
    wide = pixels.text_width_px("WWWWWWWWWW", 20)
    assert wide > short
    long_title = "W" * 80
    measured = pixels._measure(long_title, pixels.TITLE_FONT_PX, pixels.TITLE_LIMIT_PX)
    assert measured["truncated"] is True
    assert measured["preview"].endswith("…")


def test_extract_page_audits():
    page = local_onpage.extract_page(_doc(), "https://example.com/best-running-shoes", "running shoes")
    imgs = page["images"]
    assert imgs["total"] == 2
    assert imgs["missing_alt"] == 1
    assert imgs["with_keyword_alt"] is True
    # Full per-image list with absolute src; missing-alt image surfaced first.
    assert len(imgs["items"]) == 2
    assert imgs["items"][0]["has_alt"] is False
    assert imgs["items"][0]["src"] == "https://example.com/b.jpg"
    assert any(it["alt"] == "running shoes on a road" for it in imgs["items"])
    idx = page["indexability"]
    assert idx["noindex"] is False
    assert idx["has_viewport"] is True
    assert idx["lang"] == "en"
    assert idx["open_graph"] is True
    assert idx["schema_types"] == ["Article"]
    assert idx["canonical"] == "https://example.com/best-running-shoes"
    assert page["links"] == {"internal": 1, "external": 1}
    assert page["heading_count"] == 3
    assert page["snippet"]["title"]["pixels"] > 0


def test_noindex_caps_score():
    doc = _doc().replace("index,follow", "noindex,follow")
    page = local_onpage.extract_page(doc, "https://example.com/x", "running shoes")
    assert page["signals"].noindex is True
    ev = scoring.evaluate(page["signals"])
    assert ev["score"] <= 40
    assert any("noindex" in i for i in ev["issues"])


async def _seed_user(db) -> User:
    org = Organization(name="Acme", monthly_quota_cents=5000)
    db.add(org)
    await db.flush()
    user = User(email="seo@acme.test", hashed_password="x", org_id=org.id, role="owner")
    db.add(user)
    await db.commit()
    return user


def _serp_result(urls: list[str]) -> DfsResult:
    items = [
        {"type": "organic", "rank_absolute": i + 1, "title": f"R{i}", "description": "d",
         "url": u, "domain": u.split("/")[2]}
        for i, u in enumerate(urls)
    ]
    return DfsResult(result=[{"items": items}], cost_cents=0)


@pytest.mark.asyncio
async def test_benchmark_and_content_gap(db, monkeypatch):
    user = await _seed_user(db)

    comp_urls = ["https://c1.com/p", "https://c2.com/p", "https://c3.com/p"]

    async def fake_organic(*args, **kwargs):
        return _serp_result(comp_urls)

    monkeypatch.setattr(competitive.serp_api, "organic", fake_organic)

    # Every competitor page is rich in "trail" and "marathon" — terms our page lacks.
    comp_html = "<html><body><h1>x</h1><h2>y</h2>" + (
        "trail marathon training shoes cushioning for the marathon trail runner. " * 40
    ) + "</body></html>"

    async def fake_fetch(url: str) -> str:
        return comp_html

    monkeypatch.setattr(density, "fetch_html", fake_fetch)

    page_terms = {"running": 30, "shoes": 28, "running shoes": 20}  # no trail/marathon
    out = await competitive.benchmark(
        db, user, "running shoes", 2840, "en",
        page_terms=page_terms, page_word_count=400, page_heading_count=2,
    )
    assert out is not None
    assert out["competitors_analyzed"] == 3
    assert out["word_count"]["median"] > 0
    gap_terms = {g["term"] for g in out["missing_terms"]}
    assert "trail" in gap_terms or "marathon" in gap_terms
    # Terms already on our page must not be reported as gaps.
    assert "running" not in gap_terms
