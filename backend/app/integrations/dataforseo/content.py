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


# ---- Sentiment + phrase trends ----------------------------------------------

PATH_SENTIMENT = "/v3/content_analysis/sentiment_analysis/live"
PATH_PHRASE_TRENDS = "/v3/content_analysis/phrase_trends/live"


async def sentiment(keyword: str) -> DfsResult:
    return await dfs_client.post(PATH_SENTIMENT, {"keyword": keyword})


def parse_sentiment(result: list[dict[str, Any]]) -> dict:
    """The live endpoint returns one block whose `positive_connotation_distribution`
    holds a summary per polarity (positive/negative/neutral), each with its own
    total_count and emotion breakdown — aggregate them."""
    block = (result[0] if result else {}) or {}
    dist = block.get("positive_connotation_distribution") or {}
    types: dict[str, int] = {}
    conn: dict[str, int] = {}
    total = 0
    for polarity, sub in dist.items():
        if not isinstance(sub, dict):
            continue
        count = sub.get("total_count") or 0
        types[polarity] = count
        total += count
        for emotion, v in (sub.get("sentiment_connotations") or {}).items():
            conn[emotion] = conn.get(emotion, 0) + (v or 0)
    return {
        "total_citations": total or None,
        "connotations": conn,
        "types": types,
    }


async def phrase_trends(keyword: str, date_from: str, date_to: str) -> DfsResult:
    payload = {
        "keyword": keyword,
        "date_from": date_from,
        "date_to": date_to,
        "date_group": "month",
    }
    return await dfs_client.post(PATH_PHRASE_TRENDS, payload)


def parse_phrase_trends(result: list[dict[str, Any]]) -> list[dict]:
    """The live endpoint returns one `content_analysis_trends` block per period
    directly in `result` (no `items` wrapper)."""
    return [
        {
            "date": (i.get("date_from") or i.get("date") or "")[:10],
            "citations": i.get("total_count") or i.get("count"),
        }
        for i in (result or [])
        if isinstance(i, dict) and (i.get("date_from") or i.get("date"))
    ]
