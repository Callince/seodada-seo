"""Country/city geo-target lookup for the location pickers.

Reads the `locations` table seeded from DataForSEO's own list
(`scripts/seed_locations.py`), so every `code` returned is guaranteed valid for
the research endpoints.

Nothing here is billed or cached through the cost engine — it is a local table
read, so it deliberately does **not** go through `usage.metered`.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, get_db_session
from app.db.models import Location, User
from app.schemas.locations import LocationItem, LocationSearchResponse

router = APIRouter()

MAX_LIMIT = 50

# Countries sort ahead of cities wherever the ordering is otherwise tied.
_COUNTRY_FIRST = case((Location.kind == "country", 0), else_=1)


@router.get("/countries", response_model=LocationSearchResponse)
async def countries(
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> LocationSearchResponse:
    """All 213 countries, alphabetical — small enough to send in one go."""
    rows = (
        await db.scalars(
            select(Location).where(Location.kind == "country").order_by(Location.name)
        )
    ).all()
    return LocationSearchResponse(rows=[LocationItem.model_validate(r, from_attributes=True) for r in rows])


@router.get("/search", response_model=LocationSearchResponse)
async def search(
    q: str = Query("", max_length=100),
    country: str = Query("", max_length=2, description="ISO-2 filter, e.g. IN"),
    kind: str = Query("", pattern="^(country|city)?$"),
    limit: int = Query(20, ge=1, le=MAX_LIMIT),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> LocationSearchResponse:
    """Type-ahead over countries and cities.

    Matching runs against `search_blob` ("city region country", lowercased), so
    one query finds a city by its own name, its state, or its country without
    the caller choosing which field to search.
    """
    stmt = select(Location)
    if country:
        stmt = stmt.where(Location.country_iso == country.upper())
    if kind:
        stmt = stmt.where(Location.kind == kind)

    term = q.strip().lower()
    if term:
        # Prefix match first, then anywhere — "che" should surface Chennai
        # before Manchester, which a bare LIKE '%che%' would not do.
        stmt = stmt.where(
            or_(
                Location.search_blob.like(f"{term}%"),
                Location.search_blob.like(f"% {term}%"),
                Location.search_blob.like(f"%{term}%"),
            )
        ).order_by(
            # Rank by *where* the term matched, so "che" surfaces Chennai above
            # Manchester — a bare LIKE '%che%' would order them arbitrarily.
            case(
                (Location.name.ilike(f"{term}%"), 0),   # name starts with it
                (Location.search_blob.like(f"% {term}%"), 1),  # a later word does
                else_=2,                                 # matched mid-word
            ),
            _COUNTRY_FIRST,  # ties: "india" offers the country before Indianapolis
            Location.name,
        )
    else:
        # No query: countries first, alphabetical — a sensible cold-open list.
        stmt = stmt.order_by(_COUNTRY_FIRST, Location.name)

    # Fetch one extra to detect truncation without a second COUNT query.
    rows = (await db.scalars(stmt.limit(limit + 1))).all()
    truncated = len(rows) > limit
    return LocationSearchResponse(
        rows=[LocationItem.model_validate(r, from_attributes=True) for r in rows[:limit]],
        truncated=truncated,
    )


@router.get("/lookup", response_model=LocationSearchResponse)
async def lookup(
    codes: str = Query("", description="comma-separated location codes"),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> LocationSearchResponse:
    """Resolve saved codes back to labels.

    Saved analyses and persisted UI state store only the numeric code, so the
    picker needs this to render "Chennai, India" instead of "#1007809" when a
    page is reopened.
    """
    wanted: list[int] = []
    for part in codes.split(","):
        part = part.strip()
        if part.lstrip("-").isdigit():
            wanted.append(int(part))
    if not wanted:
        return LocationSearchResponse(rows=[])
    rows = (
        await db.scalars(select(Location).where(Location.code.in_(wanted[:MAX_LIMIT])))
    ).all()
    return LocationSearchResponse(rows=[LocationItem.model_validate(r, from_attributes=True) for r in rows])
