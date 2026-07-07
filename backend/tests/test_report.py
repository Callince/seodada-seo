from __future__ import annotations

import pytest

from app.db.models import Organization, User
from app.integrations.dataforseo.client import DfsResult
from app.services import density, report


async def _seed_user(db) -> User:
    org = Organization(name="Acme", monthly_quota_cents=100000)
    db.add(org)
    await db.flush()
    user = User(email="rep@acme.test", hashed_password="x", org_id=org.id, role="owner")
    db.add(user)
    await db.commit()
    return user


def _ranked() -> DfsResult:
    items = [
        {"keyword_data": {"keyword": "seo tools", "keyword_info": {"search_volume": 1000}},
         "ranked_serp_element": {"serp_item": {"rank_absolute": 3, "etv": 50.0, "url": "https://acme.com/tools"}}},
        {"keyword_data": {"keyword": "seo audit", "keyword_info": {"search_volume": 500}},
         "ranked_serp_element": {"serp_item": {"rank_absolute": 7, "etv": 20.0, "url": "https://acme.com/audit"}}},
    ]
    return DfsResult(result=[{"items": items}], cost_cents=4)


def _overview() -> DfsResult:
    metrics = {"organic": {"count": 1200, "etv": 300.0, "estimated_paid_traffic_cost": 1500.0}, "paid": {}}
    return DfsResult(result=[{"items": [{"metrics": metrics}]}], cost_cents=2)


def _competitors() -> DfsResult:
    items = [{"domain": "rival.com", "intersections": 40, "avg_position": 12,
              "metrics": {"organic": {"etv": 900.0, "count": 3000}}}]
    return DfsResult(result=[{"items": items}], cost_cents=2)


def _serp() -> DfsResult:
    items = [{"type": "organic", "rank_absolute": 5, "title": "Acme", "description": "d",
              "url": "https://acme.com/tools", "domain": "acme.com"}]
    return DfsResult(result=[{"items": items}], cost_cents=3)


_HTML = (
    "<html lang='en'><head><title>Acme SEO Tools — Reviews and Guide</title>"
    "<meta name='description' content='A complete guide to acme seo tools for marketers in 2026.'>"
    "</head><body><h1>Acme SEO Tools</h1><h2>Features</h2><p>"
    + ("seo tools help every marketer rank better and faster. " * 60)
    + "</p></body></html>"
)


@pytest.mark.asyncio
async def test_site_report_assembles_all_sections(db, monkeypatch):
    user = await _seed_user(db)

    async def f_ranked(*a, **k):
        return _ranked()

    async def f_overview(*a, **k):
        return _overview()

    async def f_comp(*a, **k):
        return _competitors()

    async def f_serp(*a, **k):
        return _serp()

    async def f_fetch(url):
        return _HTML

    monkeypatch.setattr(report.labs, "ranked_keywords", f_ranked)
    monkeypatch.setattr(report.labs, "domain_rank_overview", f_overview)
    monkeypatch.setattr(report.labs, "competitors_domain", f_comp)
    monkeypatch.setattr(report.serp_api, "organic", f_serp)
    monkeypatch.setattr(density, "fetch_html", f_fetch)

    out = await report.site_report(db, user, "https://www.acme.com/", "seo tools", 2840, "en", max_pages=2)

    assert out["domain"] == "acme.com"
    assert out["health_score"] is not None
    assert len(out["pages"]) == 2
    assert out["pages"][0]["content_score"] is not None
    assert out["top_keywords"][0]["keyword"] == "seo tools"
    assert out["competitors"][0]["domain"] == "rival.com"
    assert out["overview"]["organic"]["count"] == 1200
    # Organic rank, not the absolute SERP slot: the lone organic listing is #1
    # even though it sits in absolute slot 5 (ads/PAA/etc. above it).
    assert out["ranking"]["found"] is True and out["ranking"]["position"] == 1
    assert out["findings"]  # non-empty
    assert out["meta"]["cost_cents"] == 4 + 2 + 2 + 3  # sum of billed calls


@pytest.mark.asyncio
async def test_site_report_without_keyword_skips_ranking(db, monkeypatch):
    user = await _seed_user(db)
    monkeypatch.setattr(report.labs, "ranked_keywords", lambda *a, **k: _async(_ranked()))
    monkeypatch.setattr(report.labs, "domain_rank_overview", lambda *a, **k: _async(_overview()))
    monkeypatch.setattr(report.labs, "competitors_domain", lambda *a, **k: _async(_competitors()))
    monkeypatch.setattr(density, "fetch_html", lambda url: _async(_HTML))

    out = await report.site_report(db, user, "acme.com", None, 2840, "en", max_pages=1)
    assert out["ranking"] is None
    assert out["meta"]["cost_cents"] == 4 + 2 + 2  # no SERP call


async def _async(value):
    return value
