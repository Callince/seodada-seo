"""Domain -> brand-name + brand-search-volume enrichment for SERP rows.

The brand *name* is derived locally from the domain (no API cost). Brand
*volume* is the monthly search volume for that brand term, fetched in one
batched `search_volume` call routed through the cost engine so it is cached
and metered like any other billed lookup.
"""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User
from app.integrations.dataforseo import keywords as kw
from app.services import engine, usage
from app.services.coalescer import search_volume_coalescer

# Generic suffixes/subdomains we strip when guessing a brand name.
_STRIP_SUBDOMAINS = {"www", "m", "shop", "store", "blog", "en", "us"}
# Multi-part public suffixes worth recognising so "x.co.uk" -> "x".
_COMPOUND_TLDS = {"co.uk", "com.au", "co.in", "co.jp", "com.br", "co.nz", "org.uk"}


def brand_name_from_domain(domain: str) -> str:
    """`shop.nike.com` -> `Nike`; `bbc.co.uk` -> `Bbc`."""
    if not domain:
        return ""
    host = domain.strip().lower().rstrip(".")
    parts = host.split(".")
    while parts and parts[0] in _STRIP_SUBDOMAINS:
        parts = parts[1:]
    if len(parts) >= 3 and ".".join(parts[-2:]) in _COMPOUND_TLDS:
        core = parts[-3]
    elif len(parts) >= 2:
        core = parts[-2]
    elif parts:
        core = parts[0]
    else:
        return ""
    core = core.replace("-", " ").strip()
    return core.title()


async def enrich(
    db: AsyncSession,
    user: User,
    rows: list[dict],
    location_code: int,
    language_code: str,
    with_volume: bool = True,
) -> int:
    """Attach `brand_name` + `brand_volume` to each SERP row in place.

    The brand *name* is always derived locally ($0). The brand *volume* lookup
    is a billed DataForSEO call; pass `with_volume=False` (e.g. when the SERP
    itself came from a free provider) to skip it and leave `brand_volume` unset.

    Returns the cost (cents) incurred for the brand-volume lookup (0 on cache hit).
    """
    for r in rows:
        r["brand_name"] = brand_name_from_domain(r.get("domain") or "")

    if not with_volume:
        return 0

    brands = sorted({r["brand_name"] for r in rows if r.get("brand_name")})
    if not brands:
        return 0

    terms = [b.lower() for b in brands]
    resolved = await engine.resolve(
        db,
        endpoint="keywords.search_volume",
        params={"keywords": terms, "location_code": location_code, "language_code": language_code},
        ttl_seconds=engine.TTL["search_volume"],
        fetch_fn=lambda: search_volume_coalescer.fetch(terms, location_code, language_code),
    )
    await usage.record(
        db, user, "keywords.search_volume", resolved.cost_cents, resolved.from_cache
    )

    vol_by_term = kw.parse_search_volume(resolved.data)
    for r in rows:
        r["brand_volume"] = vol_by_term.get((r.get("brand_name") or "").lower())
    return resolved.cost_cents
