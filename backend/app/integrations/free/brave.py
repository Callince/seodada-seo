"""Brave Search API → DataForSEO-SERP-shaped result.

Free tier: https://brave.com/search/api/ (sign up, ~2,000 queries/month free,
rate-limited to 1 req/sec). We shape the response to mirror the DataForSEO SERP
"advanced" result (`result[0]["items"]` with `type="organic"`) so the existing
`serp.parse_organic` parser consumes it unchanged. Cost is always $0.
"""
from __future__ import annotations

from urllib.parse import urlparse

import httpx

from app.core.config import settings
from app.core.logging import log
from app.integrations.dataforseo.client import DfsResult

ENDPOINT = "https://api.search.brave.com/res/v1/web/search"

# DataForSEO numeric location_code → Brave 2-letter country.
_COUNTRY_BY_LOCATION = {
    2840: "us", 2826: "gb", 2356: "in", 2036: "au", 2124: "ca",
    2276: "de", 2250: "fr", 2724: "es", 2380: "it", 2392: "jp",
    2076: "br", 2528: "nl", 2752: "se", 2616: "pl", 2710: "za",
}


class BraveError(Exception):
    pass


def _country(location_code: int) -> str:
    return _COUNTRY_BY_LOCATION.get(location_code, "us")


def _host(url: str | None) -> str:
    try:
        return urlparse(url or "").hostname or ""
    except ValueError:
        return ""


async def organic(
    keyword: str, location_code: int, language_code: str, depth: int = 10
) -> DfsResult:
    key = settings.brave_api_key.strip()
    if not key:
        raise BraveError("Brave API key not configured")

    params = {
        "q": keyword,
        "count": min(max(depth, 1), 20),  # Brave caps web results at 20/page
        "country": _country(location_code),
        "search_lang": (language_code or "en").split("-")[0],
        "result_filter": "web",
        "text_decorations": "false",
        "safesearch": "moderate",
    }
    headers = {"Accept": "application/json", "X-Subscription-Token": key}

    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
        resp = await client.get(ENDPOINT, params=params, headers=headers)
        if resp.status_code == 429:
            raise BraveError("Brave API rate limit reached (free tier is 1 req/sec).")
        resp.raise_for_status()
        data = resp.json()

    results = ((data.get("web") or {}).get("results")) or []
    items: list[dict] = []
    for i, it in enumerate(results, start=1):
        meta_url = it.get("meta_url") or {}
        items.append(
            {
                "type": "organic",
                "rank_absolute": i,
                "title": it.get("title") or "",
                "description": it.get("description"),
                "url": it.get("url") or "",
                "domain": meta_url.get("hostname") or _host(it.get("url")),
            }
        )
    log.info("brave_call", keyword=keyword, results=len(items))
    # Mirror the DataForSEO SERP-advanced envelope: a single result block whose
    # `items` carry organic rows. No People-Also-Ask on the free web endpoint.
    return DfsResult(result=[{"items": items}], cost_cents=0)
