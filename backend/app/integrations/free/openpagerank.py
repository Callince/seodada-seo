"""OpenPageRank — free domain-authority scores (https://www.domcop.com/openpagerank/).

Open-data PageRank for ~120M domains, free API key, 10,000 requests/hour and up
to 100 domains per call. Returns a 0-10 score which we map to the same 0-100
authority scale the DataForSEO-backed metric uses, so the UI renders either
source identically. Cost is always $0.
"""
from __future__ import annotations

from typing import Any

import httpx

from app.core.config import settings
from app.integrations.dataforseo.client import DfsResult

ENDPOINT = "https://openpagerank.com/api/v1.0/getPageRank"


class OpenPageRankError(Exception):
    pass


def available() -> bool:
    return bool(settings.openpagerank_api_key.strip())


async def page_rank(domains: list[str]) -> DfsResult:
    """Fetch PageRank rows for up to 100 domains. Shaped as a DfsResult so the
    cost engine caches it exactly like a billed call (at $0)."""
    key = settings.openpagerank_api_key.strip()
    if not key:
        raise OpenPageRankError("OpenPageRank API key not configured")
    params = [("domains[]", d) for d in domains[:100]]
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(ENDPOINT, params=params, headers={"API-OPR": key})
    if resp.status_code != 200:
        raise OpenPageRankError(f"OpenPageRank HTTP {resp.status_code}")
    rows = resp.json().get("response") or []
    return DfsResult(result=rows, cost_cents=0)


def parse(rows: list[dict[str, Any]]) -> dict[str, dict]:
    """domain -> {authority (0-100), score10 (0-10), global_rank} for found domains."""
    out: dict[str, dict] = {}
    for r in rows or []:
        if str(r.get("status_code")) != "200":
            continue
        domain = (r.get("domain") or "").lower()
        try:
            score10 = float(r.get("page_rank_decimal") or 0.0)
        except (TypeError, ValueError):
            score10 = 0.0
        rank_raw = r.get("rank")
        try:
            global_rank = int(rank_raw) if rank_raw not in (None, "") else None
        except (TypeError, ValueError):
            global_rank = None
        out[domain] = {
            "authority": max(0, min(100, round(score10 * 10))),
            "score10": score10,
            "global_rank": global_rank,
        }
    return out
