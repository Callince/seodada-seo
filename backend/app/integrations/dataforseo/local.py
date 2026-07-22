"""Business Data API — Google business listings search (Local SEO)."""
from __future__ import annotations

from typing import Any

from app.integrations.dataforseo.client import DfsResult, dfs_client

PATH_LISTINGS = "/v3/business_data/business_listings/search/live"


async def listings(what: str, location_code: int, limit: int = 20) -> DfsResult:
    """Business listings for a geo-target.

    The endpoint also accepts `location_coordinate` and `location_name` at the
    same cost (all three verified live at 0.01308). `location_code` is used
    because it is what the shared location picker already emits, so Local SEO
    reaches the same 57k cities as every other page instead of a hardcoded few.
    """
    payload = {
        "title": what,
        "location_code": location_code,
        "limit": limit,
        "order_by": ["rating.value,desc"],
    }
    return await dfs_client.post(PATH_LISTINGS, payload)


def parse_listings(result: list[dict[str, Any]]) -> list[dict]:
    items = (result[0].get("items") if result else None) or []
    out = []
    for it in items:
        rating = it.get("rating") or {}
        out.append(
            {
                "title": it.get("title"),
                "category": it.get("category"),
                "address": it.get("address"),
                "phone": it.get("phone"),
                "url": it.get("url"),
                "domain": it.get("domain"),
                "rating": rating.get("value"),
                "reviews": rating.get("votes_count"),
                "lat": (it.get("latitude") if it.get("latitude") is not None else None),
                "lng": (it.get("longitude") if it.get("longitude") is not None else None),
                "is_claimed": it.get("is_claimed"),
            }
        )
    return [r for r in out if r["title"]]
