"""Keywords Data API wrappers + parsers (search volume, Google Trends)."""
from __future__ import annotations

from datetime import date
from typing import Any

from app.integrations.dataforseo.client import DfsResult, dfs_client

PATH_GOOGLE_TRENDS = "/v3/keywords_data/google_trends/explore/live"

# google_ads/search_volume/live is deliberately gone: Labs keyword_overview
# returns the same volumes for 1.26c against its flat 9.00c and carries ~92
# months of history instead of 12. The coalescer calls Labs and flattens the
# rows back into this module's shape, so the parsers below are unchanged.
# See docs/PROVIDER_STRATEGY.md.


async def google_trends(
    keywords: list[str],
    location_code: int,
    language_code: str,
    time_range: str = "past_12_months",
    date_from: str | None = None,
    date_to: str | None = None,
) -> DfsResult:
    payload = {
        "keywords": keywords,
        "location_code": location_code,
        "language_code": language_code,
        "type": "web",
    }
    # A custom from/to window takes precedence over the named range.
    if date_from and date_to:
        payload["date_from"] = date_from
        payload["date_to"] = date_to
    else:
        payload["time_range"] = time_range
    return await dfs_client.post(PATH_GOOGLE_TRENDS, payload)


def parse_search_volume(result: list[dict[str, Any]]) -> dict[str, int | None]:
    """Map each keyword -> its search volume (None when unknown)."""
    out: dict[str, int | None] = {}
    for it in result or []:
        kw = (it.get("keyword") or "").lower()
        if kw:
            out[kw] = it.get("search_volume")
    return out


def _monthly(it: dict) -> list[dict]:
    rows = []
    for m in it.get("monthly_searches") or []:
        rows.append(
            {"year": m.get("year"), "month": m.get("month"), "volume": m.get("search_volume")}
        )
    return rows


def parse_volume_rows(result: list[dict[str, Any]]) -> list[dict]:
    """Full per-keyword metrics for the /keywords/volume endpoint."""
    out: list[dict] = []
    for it in result or []:
        if not it.get("keyword"):
            continue
        out.append(
            {
                "keyword": it.get("keyword"),
                "search_volume": it.get("search_volume"),
                "cpc": it.get("cpc"),
                "competition": it.get("competition_index"),
                "competition_level": it.get("competition"),
                "monthly_searches": _monthly(it),
            }
        )
    return out


def parse_trends(result: list[dict[str, Any]]) -> dict:
    """Return {keywords, graph:[{date, values:[...]}]} from a Trends explore result."""
    if not result:
        return {"keywords": [], "graph": []}
    block = result[0]
    keywords = block.get("keywords") or []
    graph: list[dict] = []
    for item in block.get("items") or []:
        if item.get("type") != "google_trends_graph":
            continue
        kws = item.get("keywords") or keywords
        for point in item.get("data") or []:
            ts = point.get("timestamp")
            label = (
                date.fromtimestamp(ts).isoformat()
                if isinstance(ts, (int, float))
                else point.get("date_from")
            )
            graph.append({"date": label, "values": point.get("values") or []})
        keywords = kws
        break
    return {"keywords": keywords, "graph": graph}
