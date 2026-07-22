"""Location search — the country/city picker's data source.

Rows come from DataForSEO's own geo-target list (`scripts/seed_locations.py`),
so every `code` is one the research endpoints accept. These tests cover the
search *behaviour*; seeding is exercised separately by `to_rows`.
"""
from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1 import locations as loc_api
from app.db.models import Location, Organization, User
from scripts.seed_locations import to_rows


async def _user(db: AsyncSession) -> User:
    org = Organization(id="o1", name="T")
    db.add(org)
    user = User(email="a@b.c", hashed_password="x", org_id=org.id, role="owner")
    db.add(user)
    await db.commit()
    return user


def _loc(code, name, region, country, iso, kind="city", lang="en"):
    return Location(
        code=code, name=name, region=region, country_name=country, country_iso=iso,
        kind=kind, language_code=lang,
        search_blob=" ".join([name, region, country]).lower(),
    )


async def _search(db, user, q="", country="", kind="", limit=20):
    """Call the route with every parameter explicit.

    Invoking the function directly leaves FastAPI's `Query(...)` defaults as
    Query objects rather than values, so they have to be supplied here.
    """
    return await loc_api.search(q=q, country=country, kind=kind, limit=limit, db=db, user=user)


async def _seed(db: AsyncSession) -> None:
    db.add_all([
        _loc(2356, "India", "", "India", "IN", kind="country"),
        _loc(2840, "United States", "", "United States", "US", kind="country"),
        _loc(2826, "United Kingdom", "", "United Kingdom", "GB", kind="country"),
        _loc(1007809, "Chennai", "Tamil Nadu", "India", "IN"),
        _loc(1007768, "Bengaluru", "Karnataka", "India", "IN"),
        _loc(1006886, "London", "England", "United Kingdom", "GB"),
        _loc(1002325, "London", "Ontario", "Canada", "CA"),
        _loc(1015061, "Indialantic", "Florida", "United States", "US"),
        _loc(9999001, "Manchester", "England", "United Kingdom", "GB"),
        # Chad sorts *after* Chachoengsao alphabetically, so only the
        # country-first tiebreak puts the country on top for "cha".
        _loc(2148, "Chad", "", "Chad", "TD", kind="country"),
        _loc(9999002, "Chachoengsao", "Chachoengsao", "Thailand", "TH"),
    ])
    await db.commit()


@pytest.mark.asyncio
async def test_search_ranks_exact_prefix_above_midword(db):
    """Typing "che" must surface Chennai, not Manchester — a bare LIKE '%che%'
    orders these arbitrarily."""
    user = await _user(db)
    await _seed(db)
    res = await _search(db, user, q="che")
    assert res.rows[0].name == "Chennai", [r.name for r in res.rows]


@pytest.mark.asyncio
async def test_country_outranks_a_city_that_merely_contains_it(db):
    """"india" should offer the country before Indialantic, Florida."""
    user = await _user(db)
    await _seed(db)
    res = await _search(db, user, q="india")
    assert res.rows[0].kind == "country" and res.rows[0].name == "India"


@pytest.mark.asyncio
async def test_country_wins_ties_even_when_it_sorts_later(db):
    """Alphabetical order alone is not enough: "Chachoengsao" precedes "Chad",
    so without the country-first tiebreak a "cha" query buries the country."""
    user = await _user(db)
    await _seed(db)
    res = await _search(db, user, q="cha")
    assert res.rows[0].name == "Chad", [r.name for r in res.rows]


@pytest.mark.asyncio
async def test_search_matches_region_and_country_not_just_city(db):
    """The blob is "city region country", so a state name finds its cities."""
    user = await _user(db)
    await _seed(db)
    res = await _search(db, user, q="karnataka")
    assert "Bengaluru" in {r.name for r in res.rows}


@pytest.mark.asyncio
async def test_country_filter_scopes_the_search(db):
    user = await _user(db)
    await _seed(db)
    res = await _search(db, user, q="london", country="GB")
    assert [r.country_name for r in res.rows] == ["United Kingdom"]


@pytest.mark.asyncio
async def test_kind_filter_returns_only_cities(db):
    user = await _user(db)
    await _seed(db)
    res = await _search(db, user, kind="city")
    assert res.rows and all(r.kind == "city" for r in res.rows)


@pytest.mark.asyncio
async def test_empty_query_opens_on_countries(db):
    """An empty dropdown is useless; countries first is the sensible cold open."""
    user = await _user(db)
    await _seed(db)
    res = await _search(db, user)
    assert res.rows[0].kind == "country"


@pytest.mark.asyncio
async def test_truncated_flag_is_set_when_more_matched(db):
    """The UI says "keep typing" rather than implying it showed everything."""
    user = await _user(db)
    await _seed(db)
    res = await _search(db, user, limit=2)
    assert len(res.rows) == 2 and res.truncated is True

    res_all = await _search(db, user, q="chennai")
    assert res_all.truncated is False


@pytest.mark.asyncio
async def test_lookup_resolves_saved_codes(db):
    """Persisted UI state stores only the number; without this a reopened page
    renders "#1007809"."""
    user = await _user(db)
    await _seed(db)
    res = await loc_api.lookup(codes="1007809,2356", db=db, user=user)
    assert {r.code for r in res.rows} == {1007809, 2356}


@pytest.mark.asyncio
async def test_lookup_ignores_junk_codes(db):
    user = await _user(db)
    await _seed(db)
    assert (await loc_api.lookup(codes="abc,,", db=db, user=user)).rows == []


@pytest.mark.asyncio
async def test_countries_returns_only_countries_alphabetically(db):
    user = await _user(db)
    await _seed(db)
    res = await loc_api.countries(db=db, user=user)
    assert [r.name for r in res.rows] == ["Chad", "India", "United Kingdom", "United States"]


# --- seeding -------------------------------------------------------------

def test_to_rows_keeps_only_countries_and_cities():
    """The upstream list is 76% postal codes, municipalities and neighbourhoods
    that nobody picks from a dropdown."""
    items = [
        {"location_code": 1, "location_name": "India", "location_type": "Country", "country_iso_code": "IN"},
        {"location_code": 2, "location_name": "Chennai,Tamil Nadu,India", "location_type": "City", "country_iso_code": "IN"},
        {"location_code": 3, "location_name": "600001,Chennai,India", "location_type": "Postal Code", "country_iso_code": "IN"},
        {"location_code": 4, "location_name": "Some Hood,Chennai,India", "location_type": "Neighborhood", "country_iso_code": "IN"},
    ]
    rows = to_rows(items, all_cities=True)
    assert [r["code"] for r in rows] == [1, 2]


def test_to_rows_drops_the_city_echoed_as_its_own_district():
    """Upstream returns "Chennai,Chennai,Tamil Nadu,India", which would render
    as "Chennai, Chennai, Tamil Nadu"."""
    items = [{"location_code": 2, "location_name": "Chennai,Chennai,Tamil Nadu,India",
              "location_type": "City", "country_iso_code": "IN"}]
    row = to_rows(items, all_cities=True)[0]
    assert row["name"] == "Chennai"
    assert row["region"] == "Tamil Nadu"
    assert row["country_name"] == "India"


def test_to_rows_applies_the_market_language():
    items = [{"location_code": 9, "location_name": "Berlin,Berlin,Germany",
              "location_type": "City", "country_iso_code": "DE"}]
    assert to_rows(items, all_cities=True)[0]["language_code"] == "de"


def test_to_rows_market_filter_excludes_offmarket_cities_but_keeps_countries():
    """Every country stays selectable even when its cities are not seeded —
    otherwise a market silently disappears from the picker."""
    items = [
        {"location_code": 1, "location_name": "Tuvalu", "location_type": "Country", "country_iso_code": "TV"},
        {"location_code": 2, "location_name": "Funafuti,Tuvalu", "location_type": "City", "country_iso_code": "TV"},
        {"location_code": 3, "location_name": "Chennai,Tamil Nadu,India", "location_type": "City", "country_iso_code": "IN"},
    ]
    rows = to_rows(items, all_cities=False)
    kinds = {r["code"]: r["kind"] for r in rows}
    assert kinds == {1: "country", 3: "city"}, kinds


def test_to_rows_search_blob_is_lowercased_and_joined():
    items = [{"location_code": 2, "location_name": "Chennai,Tamil Nadu,India",
              "location_type": "City", "country_iso_code": "IN"}]
    assert to_rows(items, all_cities=True)[0]["search_blob"] == "chennai tamil nadu india"
