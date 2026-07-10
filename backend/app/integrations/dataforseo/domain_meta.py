"""Domain Analytics API wrappers — WHOIS overview + technology stack."""
from __future__ import annotations

from typing import Any

from app.integrations.dataforseo.client import DfsResult, dfs_client

PATH_WHOIS = "/v3/domain_analytics/whois/overview/live"
PATH_TECHNOLOGIES = "/v3/domain_analytics/technologies/domain_technologies/live"


async def whois(domain: str) -> DfsResult:
    payload = {"limit": 1, "filters": ["domain", "=", domain]}
    return await dfs_client.post(PATH_WHOIS, payload)


def parse_whois(result: list[dict[str, Any]]) -> dict:
    items = (result[0].get("items") if result else None) or []
    it = items[0] if items else {}
    return {
        "domain": it.get("domain"),
        "created": (it.get("created_datetime") or "")[:10] or None,
        "expires": (it.get("expiration_datetime") or "")[:10] or None,
        "updated": (it.get("changed_datetime") or "")[:10] or None,
        "registrar": it.get("registrar"),
        "first_seen": (it.get("first_seen") or "")[:10] or None,
        "epp_status_codes": it.get("epp_status_codes") or [],
    }


async def technologies(domain: str) -> DfsResult:
    return await dfs_client.post(PATH_TECHNOLOGIES, {"target": domain})


def parse_technologies(result: list[dict[str, Any]]) -> dict:
    """result[0] IS the item: {domain, domain_rank, title, technologies: {group:
    {category: [names]}}, …}. Returns a site profile + flattened tech rows."""
    it = result[0] if result else {}
    techs = it.get("technologies") or {}
    rows: list[dict] = []
    for group, subgroups in techs.items():
        if not isinstance(subgroups, dict):
            continue
        for subgroup, names in subgroups.items():
            if not isinstance(names, list):
                continue
            for name in names:
                rows.append({"group": group, "category": subgroup, "name": name})
    return {
        "domain": it.get("domain"),
        "title": it.get("title"),
        "country": it.get("country_iso_code"),
        "language": it.get("language_code"),
        "last_visited": (it.get("last_visited") or "")[:10] or None,
        "emails": it.get("emails") or [],
        "phones": it.get("phone_numbers") or [],
        "rows": rows,
    }
