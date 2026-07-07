"""Automated site SEO report.

Given a domain (and optional target keyword), assembles ONE complete report:
  * domain overview (organic/paid metrics),
  * the domain's top ranked keywords,
  * competing domains,
  * per-page On-Page scoring of the domain's most valuable pages,
  * the domain's ranking for the target keyword (if given),
  * an aggregate health score, key findings, and prioritized recommendations.

The billed DataForSEO calls run sequentially (a single AsyncSession is not
concurrency-safe); the per-page HTML fetch + scoring is local ($0) and runs
concurrently. Every billed call flows through the cost engine, so repeat reports
are largely cache-served.
"""
from __future__ import annotations

import asyncio
import time
from collections import Counter

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User
from app.integrations.dataforseo import labs
from app.integrations.dataforseo import serp as serp_api
from app.integrations.free import local_onpage
from app.services import density, engine, ranking, scoring, usage
from app.services.normalize import clean_domain

_PAGE_TIMEOUT = 8.0


async def _score_page(url: str, keyword: str | None) -> dict | None:
    try:
        raw = await asyncio.wait_for(density.fetch_html(url), timeout=_PAGE_TIMEOUT)
    except Exception:  # blocked / slow / SSRF guard — skip this page
        return None
    page = local_onpage.extract_page(raw, url, keyword)
    ev = scoring.evaluate(page["signals"])
    return {
        "url": url,
        "content_score": ev["score"],
        "word_count": page["word_count"],
        "title": page["title"],
        "issues": ev["issues"][:5],
        "recommendation": ev["recommendations"][0] if ev["recommendations"] else None,
        "_recs": ev["recommendations"],
    }


def _top_page_urls(ranked: list[dict], domain: str, max_pages: int) -> list[str]:
    agg: dict[str, float] = {}
    for r in ranked:
        url = r.get("url")
        if url:
            agg[url] = agg.get(url, 0.0) + (r.get("etv") or 0.0)
    ordered = [u for u, _ in sorted(agg.items(), key=lambda kv: -kv[1])]
    return ordered[:max_pages] or [f"https://{domain}/"]


async def site_report(
    db: AsyncSession,
    user: User,
    domain: str,
    keyword: str | None,
    location_code: int,
    language_code: str,
    max_pages: int = 5,
    force_live: bool = False,
) -> dict:
    start = time.perf_counter()
    domain = clean_domain(domain)
    cost = 0

    # --- Billed Labs calls (sequential; shared session is not concurrency-safe).
    ranked_res = await usage.metered(
        db, user, "labs.ranked_keywords",
        {"target": domain, "location_code": location_code, "language_code": language_code, "limit": 50},
        engine.TTL["labs"],
        lambda: labs.ranked_keywords(domain, location_code, language_code, 50),
        force_live=force_live,
    )
    cost += ranked_res.cost_cents
    ranked = labs.parse_ranked_keywords(ranked_res.data)

    overview_res = await usage.metered(
        db, user, "labs.domain_rank_overview",
        {"target": domain, "location_code": location_code, "language_code": language_code},
        engine.TTL["labs"],
        lambda: labs.domain_rank_overview(domain, location_code, language_code),
        force_live=force_live,
    )
    cost += overview_res.cost_cents
    overview = labs.parse_domain_overview(overview_res.data)

    comp_res = await usage.metered(
        db, user, "labs.competitors_domain",
        {"target": domain, "location_code": location_code, "language_code": language_code, "limit": 10},
        engine.TTL["labs"],
        lambda: labs.competitors_domain(domain, location_code, language_code, 10),
        force_live=force_live,
    )
    cost += comp_res.cost_cents
    competitors = labs.parse_competitors(comp_res.data)

    ranking_info = None
    if keyword:
        serp_res = await usage.metered(
            db, user, "serp.organic",
            {"keyword": keyword, "location_code": location_code,
             "language_code": language_code, "depth": 100, "provider": "dataforseo"},
            engine.TTL["serp"],
            lambda: serp_api.organic(keyword, location_code, language_code, 100),
            force_live=force_live,
        )
        cost += serp_res.cost_cents
        pos, url = ranking.find_position(serp_api.parse_organic(serp_res.data), domain)
        ranking_info = {"keyword": keyword, "position": pos, "url": url, "found": pos is not None}

    # --- Per-page On-Page scoring (local, $0, concurrent).
    urls = _top_page_urls(ranked, domain, max_pages)
    scored = await asyncio.gather(*[_score_page(u, keyword) for u in urls])
    pages = [p for p in scored if p]

    page_scores = [p["content_score"] for p in pages if p["content_score"] is not None]
    health = round(sum(page_scores) / len(page_scores)) if page_scores else None

    rec_counts: Counter = Counter()
    for p in pages:
        rec_counts.update(p.pop("_recs", []))
    recommendations = [r for r, _ in rec_counts.most_common(8)]

    findings = _findings(domain, ranked, overview, pages, health, keyword, ranking_info)

    return {
        "domain": domain,
        "keyword": keyword,
        "location_code": location_code,
        "language_code": language_code,
        "health_score": health,
        "overview": overview,
        "pages": pages,
        "top_keywords": ranked[:15],
        "competitors": competitors[:8],
        "ranking": ranking_info,
        "findings": findings,
        "recommendations": recommendations,
        "meta": {
            "from_cache": False,
            "cost_cents": cost,
            "source": "composite",
            "latency_ms": int((time.perf_counter() - start) * 1000),
        },
    }


def _findings(domain, ranked, overview, pages, health, keyword, ranking_info) -> list[str]:
    out: list[str] = []
    org = overview.get("organic") or {}
    if org.get("count") is not None:
        out.append(
            f"Ranks for {org['count']:,} organic keywords (estimated traffic value "
            f"{round(org.get('traffic_cost') or 0):,} cents)."
        )
    if ranked:
        top = ranked[0]
        out.append(f"Top keyword: “{top['keyword']}” at position {top.get('position') or '—'}.")
    if health is not None:
        out.append(f"Average on-page score {health}/100 across {len(pages)} analyzed page(s).")
    elif not pages:
        out.append(
            f"On-page health is unavailable — {domain}'s pages could not be crawled "
            "(the site blocked the automated request)."
        )
    thin = sum(1 for p in pages if (p.get("word_count") or 0) < 300)
    if thin:
        out.append(f"{thin} analyzed page(s) have thin content (under 300 words).")
    if keyword and ranking_info and not ranking_info["found"]:
        out.append(f"{domain} is not in the top 100 results for “{keyword}”.")
    elif keyword and ranking_info and ranking_info["found"]:
        out.append(f"{domain} ranks #{ranking_info['position']} for “{keyword}”.")
    return out
