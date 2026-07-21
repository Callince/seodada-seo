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
from app.services.normalize import clean_domain as _clean  # single shared normalizer

PATH_SUMMARY = "/v3/backlinks/summary/live"
PATH_BACKLINKS = "/v3/backlinks/backlinks/live"
PATH_REFERRING = "/v3/backlinks/referring_domains/live"
PATH_ANCHORS = "/v3/backlinks/anchors/live"
PATH_TIMESERIES = "/v3/backlinks/timeseries_summary/live"
PATH_NEW_LOST = "/v3/backlinks/timeseries_new_lost_summary/live"
PATH_COMPETITORS = "/v3/backlinks/competitors/live"
PATH_BULK_SPAM = "/v3/backlinks/bulk_spam_score/live"
PATH_DOMAIN_INTERSECTION = "/v3/backlinks/domain_intersection/live"


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


async def timeseries(target: str, date_from: str, date_to: str) -> DfsResult:
    """Authority/link totals over time (monthly buckets)."""
    payload = {
        "target": _clean(target),
        "date_from": date_from,
        "date_to": date_to,
        "group_range": "month",
    }
    return await dfs_client.post(PATH_TIMESERIES, payload)


async def new_lost(target: str, date_from: str, date_to: str) -> DfsResult:
    """New vs lost backlinks/referring domains over time (monthly buckets)."""
    payload = {
        "target": _clean(target),
        "date_from": date_from,
        "date_to": date_to,
        "group_range": "month",
    }
    return await dfs_client.post(PATH_NEW_LOST, payload)


async def competitors(target: str, limit: int = 20) -> DfsResult:
    """Domains with the most overlapping link profile."""
    payload = {"target": _clean(target), "limit": limit, "exclude_large_domains": True}
    return await dfs_client.post(PATH_COMPETITORS, payload)


async def spam_score(target: str) -> DfsResult:
    return await dfs_client.post(PATH_BULK_SPAM, {"targets": [_clean(target)]})


async def link_gap(target: str, competitors_: list[str], limit: int = 50) -> DfsResult:
    """Referring domains that link to the competitors but NOT to `target`."""
    targets = {str(i + 1): _clean(c) for i, c in enumerate(competitors_)}
    payload = {
        "targets": targets,
        "exclude_targets": [_clean(target)],
        "limit": limit,
        "order_by": ["1.rank,desc"],
    }
    return await dfs_client.post(PATH_DOMAIN_INTERSECTION, payload)


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


def _mostly_dofollow(item: dict[str, Any]) -> bool:
    """An anchor is 'dofollow' if its dofollow links outnumber nofollow ones.
    Robust to DataForSEO returning referring_links_attributes as null or a
    non-dict — the old code called .get() on a null value and 500'd."""
    backlinks = int(item.get("backlinks") or 0)
    attrs = item.get("referring_links_attributes")
    nofollow = int(attrs.get("nofollow") or 0) if isinstance(attrs, dict) else 0
    return backlinks > nofollow


def parse_anchors(result: list[dict[str, Any]]) -> list[dict]:
    items = (result[0].get("items") if result else None) or []
    return [
        {
            "anchor": i.get("anchor"),
            "backlinks": i.get("backlinks"),
            "referring_domains": i.get("referring_domains"),
            "dofollow": _mostly_dofollow(i),
        }
        for i in items
        if i.get("anchor")
    ]


def parse_timeseries(result: list[dict[str, Any]]) -> list[dict]:
    items = (result[0].get("items") if result else None) or []
    return [
        {
            "date": (i.get("date") or "")[:10],
            "rank": i.get("rank"),
            "authority": authority_from_rank(i.get("rank")),
            "backlinks": i.get("backlinks"),
            "referring_domains": i.get("referring_domains"),
        }
        for i in items
        if i.get("date")
    ]


def parse_new_lost(result: list[dict[str, Any]]) -> list[dict]:
    items = (result[0].get("items") if result else None) or []
    return [
        {
            "date": (i.get("date") or "")[:10],
            "new_backlinks": i.get("new_backlinks"),
            "lost_backlinks": i.get("lost_backlinks"),
            "new_referring_domains": i.get("new_referring_domains"),
            "lost_referring_domains": i.get("lost_referring_domains"),
        }
        for i in items
        if i.get("date")
    ]


def parse_competitors(result: list[dict[str, Any]]) -> list[dict]:
    # NB: this endpoint's `rank` is not the 0-1000 backlink rank — surface raw.
    items = (result[0].get("items") if result else None) or []
    return [
        {
            "domain": i.get("target"),
            "rank": i.get("rank"),
            "intersections": i.get("intersections"),
        }
        for i in items
        if i.get("target")
    ]


def parse_spam_score(result: list[dict[str, Any]]) -> int | None:
    items = (result[0].get("items") if result else None) or []
    if not items:
        return None
    score = items[0].get("spam_score")
    return int(score) if score is not None else None


def parse_link_gap(result: list[dict[str, Any]]) -> list[dict]:
    """Each item nests per-target summaries under `domain_intersection`, keyed
    by target index ("1", "2", …); the referring domain is each entry's
    `target`. NB: multi-competitor mode returns domains linking to ALL of them."""
    items = (result[0].get("items") if result else None) or []
    rows: list[dict] = []
    for i in items:
        per_target = [
            v
            for v in (i.get("domain_intersection") or {}).values()
            if isinstance(v, dict)
        ]
        if not per_target:
            continue
        first = per_target[0]
        rows.append(
            {
                "domain": first.get("target"),
                "rank": first.get("rank"),
                "authority": authority_from_rank(first.get("rank")),
                "links_to_competitors": sum(int(t.get("backlinks") or 0) for t in per_target),
                "competitors_linked": len(per_target),
            }
        )
    return [r for r in rows if r["domain"]]
