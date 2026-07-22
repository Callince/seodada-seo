"""Seed the `locations` table from DataForSEO's own geo-target list.

    python -m scripts.seed_locations            # countries + cities in MARKETS
    python -m scripts.seed_locations --all      # countries + every city (64k)

Why DataForSEO's list and not a public dataset: the `location_code` is the whole
point. Every research endpoint takes that number, so a list from anywhere else
would need a fuzzy name-join and would silently fail on a miss.

Cost: **$0**. `/v3/serp/google/locations` is free metadata (verified: the
response reports `cost: 0`).

Size control — the upstream list is 267,107 entries:

    Postal Code   131,171      dropped
    City           64,484      kept (filtered, see MARKETS)
    Municipality   23,404      dropped
    District       17,808      dropped
    Neighborhood   15,192      dropped
    ...
    Country           213      kept, always all of them

Keeping only Country + City is already a 76% cut. `MARKETS` narrows the cities
further to the markets the product actually serves — every country stays
selectable regardless, so nothing becomes unreachable.

Idempotent: re-running replaces the table's contents in one transaction.
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

import httpx
from sqlalchemy import delete, select, func

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402
from app.db.models import Location  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402

LOCATIONS_URL = "/v3/serp/google/locations"

# Markets whose cities are seeded, with the dominant Google language for each.
# Mirrors the country list the picker already shipped, so no market that used to
# be selectable stops being so. Countries outside this map are still seeded
# (every country is), they just carry no city rows.
MARKETS: dict[str, str] = {
    # Americas
    "US": "en", "CA": "en", "MX": "es", "BR": "pt", "AR": "es",
    "CO": "es", "CL": "es", "PE": "es",
    # Europe
    "GB": "en", "IE": "en", "DE": "de", "FR": "fr", "ES": "es", "IT": "it",
    "NL": "nl", "BE": "nl", "CH": "de", "AT": "de", "PT": "pt", "PL": "pl",
    "SE": "sv", "DK": "da", "FI": "fi", "CZ": "cs", "GR": "el", "RO": "ro",
    "HU": "hu", "UA": "uk", "TR": "tr",
    # Asia-Pacific
    "IN": "en", "AU": "en", "NZ": "en", "JP": "ja", "KR": "ko", "SG": "en",
    "HK": "en", "MY": "en", "ID": "id", "PH": "en", "TH": "th", "VN": "vi",
    "PK": "en", "BD": "en", "LK": "en", "NP": "en",
    # Middle East & Africa
    "AE": "en", "SA": "ar", "EG": "ar", "IL": "en", "ZA": "en",
    "NG": "en", "KE": "en",
}

DEFAULT_LANGUAGE = "en"


async def fetch_locations() -> list[dict]:
    """Pull the full geo-target list. ~30 MB of JSON, one free call."""
    auth = (settings.dfs_login, settings.dfs_password)
    async with httpx.AsyncClient(timeout=httpx.Timeout(600.0)) as client:
        resp = await client.get(f"{settings.dfs_base_url}{LOCATIONS_URL}", auth=auth)
        resp.raise_for_status()
        payload = resp.json()
    tasks = payload.get("tasks") or []
    if not tasks or tasks[0].get("status_code") != 20000:
        raise RuntimeError(f"DataForSEO locations failed: {tasks[:1]}")
    return tasks[0].get("result") or []


def to_rows(items: list[dict], all_cities: bool) -> list[dict]:
    """Filter to Country + City and reshape.

    Upstream `location_name` is comma-joined most-specific-first:
        country -> "India"
        city    -> "Chennai,Tamil Nadu,India"
    Splitting it gives the UI a clean primary label plus the region as secondary
    text, which is what disambiguates the many same-named cities (there are
    several "Springfield"s).
    """
    rows: list[dict] = []
    for it in items:
        kind_raw = it.get("location_type")
        if kind_raw not in ("Country", "City"):
            continue
        iso = (it.get("country_iso_code") or "").upper()
        if not iso:
            continue
        is_city = kind_raw == "City"
        if is_city and not all_cities and iso not in MARKETS:
            continue

        parts = [p.strip() for p in (it.get("location_name") or "").split(",") if p.strip()]
        if not parts:
            continue
        name = parts[0]
        country_name = parts[-1] if len(parts) > 1 else parts[0]
        # Upstream often repeats the city as its own district — "Chennai,
        # Chennai,Tamil Nadu,India" — which renders as "Chennai, Chennai,
        # Tamil Nadu". Drop middle parts that just echo the city name.
        middles = [p for p in parts[1:-1] if p.casefold() != name.casefold()]
        region = ", ".join(middles)

        rows.append(
            {
                "code": it["location_code"],
                "name": name,
                "region": region,
                "country_name": country_name,
                "country_iso": iso,
                "kind": "city" if is_city else "country",
                "language_code": MARKETS.get(iso, DEFAULT_LANGUAGE),
                # One lowercase haystack so a single LIKE matches the city, its
                # state or its country.
                "search_blob": " ".join([name, region, country_name]).lower(),
            }
        )
    return rows


async def seed(all_cities: bool = False) -> None:
    print("fetching DataForSEO locations (free metadata call)…")
    items = await fetch_locations()
    print(f"  upstream entries: {len(items):,}")

    rows = to_rows(items, all_cities)
    countries = sum(1 for r in rows if r["kind"] == "country")
    print(f"  keeping {len(rows):,} rows — {countries:,} countries, "
          f"{len(rows) - countries:,} cities "
          f"({len(rows) / max(len(items), 1) * 100:.1f}% of upstream)")

    async with SessionLocal() as db:
        await db.execute(delete(Location))
        # Chunked so SQLite's variable limit is never the binding constraint.
        CHUNK = 1000
        for i in range(0, len(rows), CHUNK):
            db.add_all([Location(**r) for r in rows[i : i + CHUNK]])
            await db.flush()
        await db.commit()

        total = await db.scalar(select(func.count()).select_from(Location))
        per_kind = (await db.execute(
            select(Location.kind, func.count()).group_by(Location.kind)
        )).all()
    print(f"seeded {total:,} rows: {dict(per_kind)}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--all", action="store_true",
        help="seed cities for every country (64k rows) instead of just MARKETS",
    )
    args = ap.parse_args()
    asyncio.run(seed(all_cities=args.all))
