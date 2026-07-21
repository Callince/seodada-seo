"""DataForSEO Labs API wrappers + parsers.

Covers keyword expansion (suggestions / related / ideas) for Keyword Research
and the domain endpoints (ranked keywords / competitors / overview / gap) for
Domain Analytics. Labs items nest the metrics either directly or under a
`keyword_data` object depending on endpoint; `_extract_keyword` normalises both.
"""
from __future__ import annotations

from typing import Any

from app.integrations.dataforseo.client import DfsResult, dfs_client

PATH_SUGGESTIONS = "/v3/dataforseo_labs/google/keyword_suggestions/live"
PATH_RELATED = "/v3/dataforseo_labs/google/related_keywords/live"
PATH_IDEAS = "/v3/dataforseo_labs/google/keyword_ideas/live"
PATH_RANKED_KEYWORDS = "/v3/dataforseo_labs/google/ranked_keywords/live"
PATH_COMPETITORS = "/v3/dataforseo_labs/google/competitors_domain/live"
PATH_DOMAIN_OVERVIEW = "/v3/dataforseo_labs/google/domain_rank_overview/live"
PATH_DOMAIN_INTERSECTION = "/v3/dataforseo_labs/google/domain_intersection/live"


# ---- Keyword expansion ----------------------------------------------------

async def keyword_suggestions(
    seed: str, location_code: int, language_code: str, limit: int = 100
) -> DfsResult:
    payload = {
        "keyword": seed,
        "location_code": location_code,
        "language_code": language_code,
        "limit": limit,
        "include_serp_info": False,
    }
    return await dfs_client.post(PATH_SUGGESTIONS, payload)


async def related_keywords(
    seed: str, location_code: int, language_code: str, limit: int = 100, depth: int = 2
) -> DfsResult:
    payload = {
        "keyword": seed,
        "location_code": location_code,
        "language_code": language_code,
        "limit": limit,
        "depth": depth,
    }
    return await dfs_client.post(PATH_RELATED, payload)


async def keyword_ideas(
    keywords: list[str], location_code: int, language_code: str, limit: int = 100
) -> DfsResult:
    payload = {
        "keywords": keywords,
        "location_code": location_code,
        "language_code": language_code,
        "limit": limit,
    }
    return await dfs_client.post(PATH_IDEAS, payload)


# ---- Domain analytics -----------------------------------------------------

async def ranked_keywords(
    target: str, location_code: int, language_code: str, limit: int = 100
) -> DfsResult:
    payload = {
        "target": target,
        "location_code": location_code,
        "language_code": language_code,
        "limit": limit,
    }
    return await dfs_client.post(PATH_RANKED_KEYWORDS, payload)


async def competitors_domain(
    target: str, location_code: int, language_code: str, limit: int = 50
) -> DfsResult:
    payload = {
        "target": target,
        "location_code": location_code,
        "language_code": language_code,
        "limit": limit,
    }
    return await dfs_client.post(PATH_COMPETITORS, payload)


async def domain_rank_overview(
    target: str, location_code: int, language_code: str
) -> DfsResult:
    payload = {
        "target": target,
        "location_code": location_code,
        "language_code": language_code,
    }
    return await dfs_client.post(PATH_DOMAIN_OVERVIEW, payload)


async def domain_intersection(
    target1: str, target2: str, location_code: int, language_code: str, limit: int = 100
) -> DfsResult:
    payload = {
        "target1": target1,
        "target2": target2,
        "location_code": location_code,
        "language_code": language_code,
        "limit": limit,
    }
    return await dfs_client.post(PATH_DOMAIN_INTERSECTION, payload)


# ---- Parsers --------------------------------------------------------------

def _extract_keyword(item: dict) -> dict:
    """Pull the keyword metrics object out of a Labs item (handles both shapes)."""
    kd = item.get("keyword_data") or item
    info = kd.get("keyword_info") or {}
    props = kd.get("keyword_properties") or {}
    intent = kd.get("search_intent_info") or {}
    return {
        "keyword": kd.get("keyword"),
        "search_volume": info.get("search_volume"),
        "cpc": info.get("cpc"),
        "competition": info.get("competition"),
        "keyword_difficulty": props.get("keyword_difficulty"),
        "intent": intent.get("main_intent"),
    }


def parse_keyword_items(result: list[dict[str, Any]]) -> list[dict]:
    if not result:
        return []
    items = result[0].get("items") or []
    out = [_extract_keyword(it) for it in items]
    return [r for r in out if r.get("keyword")]


def parse_ranked_keywords(result: list[dict[str, Any]]) -> list[dict]:
    if not result:
        return []
    out: list[dict] = []
    for it in result[0].get("items") or []:
        kd = it.get("keyword_data") or {}
        info = kd.get("keyword_info") or {}
        serp = (it.get("ranked_serp_element") or {}).get("serp_item") or {}
        out.append(
            {
                "keyword": kd.get("keyword"),
                "position": serp.get("rank_absolute"),
                "search_volume": info.get("search_volume"),
                "etv": serp.get("etv"),
                "url": serp.get("url"),
            }
        )
    return [r for r in out if r.get("keyword")]


def parse_competitors(result: list[dict[str, Any]]) -> list[dict]:
    if not result:
        return []
    out: list[dict] = []
    for it in result[0].get("items") or []:
        metrics = (it.get("metrics") or {}).get("organic") or {}
        out.append(
            {
                "domain": it.get("domain"),
                "common_keywords": it.get("intersections"),
                "avg_position": it.get("avg_position"),
                "etv": metrics.get("etv"),
                "keywords_count": metrics.get("count"),
            }
        )
    return [r for r in out if r.get("domain")]


def parse_domain_overview(result: list[dict[str, Any]]) -> dict:
    if not result:
        return {"organic": {}, "paid": {}}
    items = result[0].get("items") or []
    metrics = (items[0].get("metrics") if items else {}) or {}
    organic = metrics.get("organic") or {}
    paid = metrics.get("paid") or {}
    return {
        "organic": {
            "count": organic.get("count"),
            "etv": organic.get("etv"),
            "traffic_cost": organic.get("estimated_paid_traffic_cost"),
        },
        "paid": {
            "count": paid.get("count"),
            "etv": paid.get("etv"),
            "traffic_cost": paid.get("estimated_paid_traffic_cost"),
        },
    }


def parse_intersection(result: list[dict[str, Any]]) -> list[dict]:
    if not result:
        return []
    out: list[dict] = []
    for it in result[0].get("items") or []:
        kd = it.get("keyword_data") or {}
        info = kd.get("keyword_info") or {}
        first = (it.get("first_domain_serp_element") or {})
        second = (it.get("second_domain_serp_element") or {})
        out.append(
            {
                "keyword": kd.get("keyword"),
                "search_volume": info.get("search_volume"),
                "target1_position": first.get("rank_absolute"),
                "target2_position": second.get("rank_absolute"),
            }
        )
    return [r for r in out if r.get("keyword")]


# ---- Keyword overview + history (intent, difficulty, volume in one call) ---

PATH_KEYWORD_OVERVIEW = "/v3/dataforseo_labs/google/keyword_overview/live"
PATH_HISTORICAL_RANK = "/v3/dataforseo_labs/google/historical_rank_overview/live"


async def keyword_overview(
    keyword: str, location_code: int, language_code: str
) -> DfsResult:
    payload = {
        "keywords": [keyword],
        "location_code": location_code,
        "language_code": language_code,
        "include_serp_info": False,
    }
    return await dfs_client.post(PATH_KEYWORD_OVERVIEW, payload)


async def keywords_overview(
    keywords: list[str], location_code: int, language_code: str
) -> DfsResult:
    """Overview for MANY keywords in one call — volume, CPC, competition,
    difficulty AND search intent.

    Same endpoint as keyword_overview, which already accepted a list; this
    just names the bulk use. Measured against keywords_data/google_ads/
    search_volume, which the bulk pane used before: identical search volumes on
    every keyword tested, but 1.34c vs 9.0c for 12 keywords and it carries the
    intent and difficulty that endpoint has no field for.
    """
    payload = {
        "keywords": keywords[:700],  # endpoint's documented ceiling
        "location_code": location_code,
        "language_code": language_code,
        "include_serp_info": False,
    }
    return await dfs_client.post(PATH_KEYWORD_OVERVIEW, payload)


def parse_keywords_overview(result: list[dict[str, Any]]) -> list[dict]:
    """One row per keyword, shaped like parse_volume_rows plus intent."""
    items = (result[0].get("items") if result else None) or []
    rows: list[dict] = []
    for it in items:
        info = it.get("keyword_info") or {}
        props = it.get("keyword_properties") or {}
        intent = it.get("search_intent_info") or {}
        comp = info.get("competition")
        rows.append(
            {
                "keyword": it.get("keyword"),
                "search_volume": info.get("search_volume"),
                "cpc": info.get("cpc"),
                # Scale differs between the two sources and the table renders
                # "{competition}/100": google_ads exposes competition_index on
                # 0-100 while Labs exposes competition on 0-1. Verified against
                # the same keywords — Labs 0.06 x 100 == google_ads index 6 —
                # so this keeps the column's numbers identical to before rather
                # than silently rendering "0/100" for everything.
                "competition": None if comp is None else round(comp * 100),
                "competition_level": info.get("competition_level"),
                "keyword_difficulty": props.get("keyword_difficulty"),
                "intent": intent.get("main_intent"),
            }
        )
    return rows


def parse_keyword_overview(result: list[dict[str, Any]]) -> dict:
    items = (result[0].get("items") if result else None) or []
    it = items[0] if items else {}
    info = it.get("keyword_info") or {}
    props = it.get("keyword_properties") or {}
    intent = it.get("search_intent_info") or {}
    return {
        "keyword": it.get("keyword"),
        "search_volume": info.get("search_volume"),
        "cpc": info.get("cpc"),
        "competition": info.get("competition"),
        "difficulty": props.get("keyword_difficulty"),
        "intent": intent.get("main_intent"),
        "monthly_searches": [
            {"year": m.get("year"), "month": m.get("month"), "volume": m.get("search_volume")}
            for m in (info.get("monthly_searches") or [])
        ],
    }


async def historical_rank(
    target: str, location_code: int, language_code: str
) -> DfsResult:
    payload = {
        "target": target,
        "location_code": location_code,
        "language_code": language_code,
    }
    return await dfs_client.post(PATH_HISTORICAL_RANK, payload)


def parse_historical_rank(result: list[dict[str, Any]]) -> list[dict]:
    items = (result[0].get("items") if result else None) or []
    out = []
    for it in items:
        m = (it.get("metrics") or {}).get("organic") or {}
        out.append(
            {
                "year": it.get("year"),
                "month": it.get("month"),
                "keywords": m.get("count"),
                "etv": m.get("etv"),
                "top3": (int(m.get("pos_1") or 0) + int(m.get("pos_2_3") or 0)) or None,
            }
        )
    return out
