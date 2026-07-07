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
