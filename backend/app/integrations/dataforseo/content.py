"""Content Analysis API wrappers + parsers (summary, citations search)."""
from __future__ import annotations

from typing import Any

from app.integrations.dataforseo.client import DfsResult, dfs_client

PATH_SUMMARY = "/v3/content_analysis/summary/live"
PATH_SEARCH = "/v3/content_analysis/search/live"


async def summary(keyword: str) -> DfsResult:
    return await dfs_client.post(PATH_SUMMARY, {"keyword": keyword})


async def search(keyword: str, limit: int = 20) -> DfsResult:
    payload = {"keyword": keyword, "search_mode": "one_per_domain", "limit": limit}
    return await dfs_client.post(PATH_SEARCH, payload)


def parse_summary(result: list[dict[str, Any]]) -> dict:
    if not result:
        return {"total_count": 0, "sentiment": {}, "connotations": {}}
    block = result[0]
    conn = block.get("connotation_types") or {}
    sent = block.get("sentiment_connotations") or {}
    return {
        "total_count": block.get("total_count") or 0,
        "sentiment": {
            "positive": conn.get("positive"),
            "negative": conn.get("negative"),
            "neutral": conn.get("neutral"),
        },
        "connotations": {
            "anger": sent.get("anger"),
            "happiness": sent.get("happiness"),
            "love": sent.get("love"),
            "sadness": sent.get("sadness"),
            "fun": sent.get("fun"),
        },
    }


def parse_citations(result: list[dict[str, Any]]) -> list[dict]:
    if not result:
        return []
    items = result[0].get("items") or []
    out: list[dict] = []
    for it in items:
        info = it.get("content_info") or {}
        out.append(
            {
                "domain": it.get("domain"),
                "url": it.get("url"),
                "title": it.get("main_title") or info.get("main_title"),
                "snippet": info.get("snippet") or it.get("snippet"),
            }
        )
    return [c for c in out if c.get("url")]
