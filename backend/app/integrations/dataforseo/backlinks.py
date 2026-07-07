"""DataForSEO Backlinks API wrappers + parsers.

Provides the "authority" picture competitors like Ahrefs/Semrush lead with:
  * summary  — domain rank (mapped to a 0-100 Authority score), backlink and
               referring-domain totals, dofollow split, broken links
  * backlinks list — strongest links, one per referring domain
  * referring domains — who links, with their own rank
  * anchors  — the anchor texts ("keyword backlinks") pointing at the target
"""
from __future__ import annotations

from typing import Any

from app.integrations.dataforseo.client import DfsResult, dfs_client

PATH_SUMMARY = "/v3/backlinks/summary/live"
PATH_BACKLINKS = "/v3/backlinks/backlinks/live"
PATH_REFERRING = "/v3/backlinks/referring_domains/live"
PATH_ANCHORS = "/v3/backlinks/anchors/live"


from app.services.normalize import clean_domain as _clean  # single shared normalizer


async def summary(target: str) -> DfsResult:
    payload = {
        "target": _clean(target),
        "include_subdomains": True,
        "exclude_internal_backlinks": True,
    }
    return await dfs_client.post(PATH_SUMMARY, payload)


async def backlinks_list(target: str, limit: int = 50) -> DfsResult:
    payload = {
        "target": _clean(target),
        "limit": limit,
        "mode": "one_per_domain",
        "order_by": ["domain_from_rank,desc"],
    }
    return await dfs_client.post(PATH_BACKLINKS, payload)


async def referring_domains(target: str, limit: int = 50) -> DfsResult:
    payload = {"target": _clean(target), "limit": limit, "order_by": ["rank,desc"]}
    return await dfs_client.post(PATH_REFERRING, payload)


async def anchors(target: str, limit: int = 50) -> DfsResult:
    payload = {"target": _clean(target), "limit": limit, "order_by": ["backlinks,desc"]}
    return await dfs_client.post(PATH_ANCHORS, payload)


# ---------------------------------------------------------------- parsers


def authority_from_rank(rank: float | int | None) -> int | None:
    """DataForSEO backlink rank is 0-1000; map to the familiar 0-100 scale."""
    if rank is None:
        return None
    return max(0, min(100, round(float(rank) / 10)))


def parse_summary(result: list[dict[str, Any]]) -> dict:
    item = result[0] if result else {}
    attrs = item.get("referring_links_attributes") or {}
    nofollow = int(attrs.get("nofollow") or 0)
    backlinks = int(item.get("backlinks") or 0)
    return {
        "rank": item.get("rank"),
        "authority": authority_from_rank(item.get("rank")),
        "backlinks": backlinks,
        "referring_domains": item.get("referring_domains"),
        "referring_main_domains": item.get("referring_main_domains"),
        "broken_backlinks": item.get("broken_backlinks"),
        "referring_ips": item.get("referring_ips"),
        "dofollow": max(0, backlinks - nofollow),
        "nofollow": nofollow,
        "first_seen": item.get("first_seen"),
    }


def parse_backlinks(result: list[dict[str, Any]]) -> list[dict]:
    items = (result[0].get("items") if result else None) or []
    return [
        {
            "domain_from": i.get("domain_from"),
            "url_from": i.get("url_from"),
            "url_to": i.get("url_to"),
            "anchor": i.get("anchor"),
            "dofollow": bool(i.get("dofollow")),
            "domain_from_rank": i.get("domain_from_rank"),
            "page_from_rank": i.get("page_from_rank"),
            "first_seen": i.get("first_seen"),
            "last_seen": i.get("last_seen"),
        }
        for i in items
        if i.get("type") in (None, "backlink")
    ]


def parse_referring_domains(result: list[dict[str, Any]]) -> list[dict]:
    items = (result[0].get("items") if result else None) or []
    return [
        {
            "domain": i.get("domain"),
            "rank": i.get("rank"),
            "authority": authority_from_rank(i.get("rank")),
            "backlinks": i.get("backlinks"),
            "referring_pages": i.get("referring_pages"),
            "first_seen": i.get("first_seen"),
        }
        for i in items
    ]


def parse_anchors(result: list[dict[str, Any]]) -> list[dict]:
    items = (result[0].get("items") if result else None) or []
    return [
        {
            "anchor": i.get("anchor"),
            "backlinks": i.get("backlinks"),
            "referring_domains": i.get("referring_domains"),
            "dofollow": i.get("referring_links_attributes", {}).get("nofollow") is None
            or (i.get("backlinks") or 0) > int((i.get("referring_links_attributes") or {}).get("nofollow") or 0),
        }
        for i in items
        if i.get("anchor")
    ]
