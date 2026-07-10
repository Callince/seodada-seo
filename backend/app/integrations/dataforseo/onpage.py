"""On-Page API wrapper + parser (instant pages)."""
from __future__ import annotations

from typing import Any

from app.integrations.dataforseo.client import DfsResult, dfs_client

PATH_INSTANT_PAGES = "/v3/on_page/instant_pages"


async def instant_pages(url: str) -> DfsResult:
    payload = {"url": url, "enable_javascript": False}
    return await dfs_client.post(PATH_INSTANT_PAGES, payload)


def parse_instant_pages(result: list[dict[str, Any]]) -> dict:
    """Pull content score, readability, meta tags, and on-page issues."""
    empty = {
        "content_score": None,
        "word_count": None,
        "readability": {},
        "title": None,
        "meta_description": None,
        "h1": [],
        "issues": [],
    }
    if not result:
        return empty
    items = result[0].get("items") or []
    if not items:
        return empty
    page = items[0]
    meta = page.get("meta") or {}
    content = meta.get("content") or {}
    htags = meta.get("htags") or {}
    checks = page.get("checks") or {}

    # Surface failed boolean checks as human-readable issues.
    issues = [name.replace("_", " ") for name, failed in checks.items() if failed is True]

    return {
        "content_score": page.get("onpage_score"),
        "word_count": content.get("plain_text_word_count"),
        "readability": {
            "ari": content.get("automated_readability_index"),
            "flesch_kincaid": content.get("flesch_kincaid_readability_index")
            or content.get("flesch_kincaid_readability"),
        },
        "title": meta.get("title"),
        "meta_description": meta.get("description"),
        "h1": htags.get("h1") or [],
        "issues": issues[:25],
    }


# ---- Lighthouse (Core Web Vitals) ------------------------------------------

PATH_LIGHTHOUSE = "/v3/on_page/lighthouse/live/json"

_CWV_AUDITS = {
    "largest-contentful-paint": "lcp",
    "cumulative-layout-shift": "cls",
    "total-blocking-time": "tbt",
    "first-contentful-paint": "fcp",
    "speed-index": "speed_index",
    "interactive": "tti",
}


async def lighthouse(url: str) -> DfsResult:
    payload = {"url": url, "for_mobile": True}
    return await dfs_client.post(PATH_LIGHTHOUSE, payload)


def parse_lighthouse(result: list[dict[str, Any]]) -> dict:
    """Category scores (0-100) + the Core Web Vitals audit values."""
    lh = result[0] if result else {}
    categories = {
        key: round(float(cat.get("score") or 0) * 100)
        for key, cat in (lh.get("categories") or {}).items()
        if isinstance(cat, dict) and cat.get("score") is not None
    }
    vitals = {}
    audits = lh.get("audits") or {}
    for audit_id, short in _CWV_AUDITS.items():
        a = audits.get(audit_id) or {}
        if a:
            vitals[short] = {
                "display": a.get("displayValue"),
                "value": a.get("numericValue"),
                "score": None if a.get("score") is None else round(float(a["score"]) * 100),
            }
    return {"categories": categories, "vitals": vitals, "fetched_url": lh.get("finalUrl")}
