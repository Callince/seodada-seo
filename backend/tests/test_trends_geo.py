from __future__ import annotations

from app.integrations.free.trends import _CITY_TO_COUNTRY_GEO, _GEO_BY_LOCATION, _geo

# Every location code the frontend's picker offers
# (frontend/src/components/shared/LocationLanguagePicker.tsx). If a code is
# added there, this list must grow with it — that is the point of the test.
UI_COUNTRY_CODES = [
    2032, 2036, 2040, 2050, 2056, 2076, 2124, 2144, 2152, 2170, 2203, 2208,
    2246, 2250, 2276, 2300, 2344, 2348, 2356, 2360, 2372, 2376, 2380, 2392,
    2404, 2410, 2458, 2484, 2524, 2528, 2554, 2566, 2586, 2604, 2608, 2616,
    2620, 2642, 2682, 2702, 2704, 2710, 2724, 2752, 2756, 2764, 2784, 2792,
    2804, 2818, 2826, 2840,
]
UI_CITY_CODES = [1007809, 1007785, 9075215, 1007768, 1007740, 1007828, 1007788, 1007753]


def test_every_ui_country_maps_to_its_own_country():
    """The bug this guards: the table held 15 entries while the picker offered
    52 countries, and the fallback was "US" — so a Brazil query returned United
    States interest, presented as Brazil's. Silent and unfalsifiable from the
    chart."""
    for code in UI_COUNTRY_CODES:
        geo = _geo(code)
        assert geo, f"location {code} resolves to worldwide — add it to _GEO_BY_LOCATION"
        assert len(geo) == 2 and geo.isupper(), f"location {code} → {geo!r} is not an alpha-2 code"
        # Only the US location may resolve to US.
        if code != 2840:
            assert geo != "US", f"location {code} silently resolves to US"


def test_ui_cities_resolve_to_their_country_not_a_foreign_one():
    """Google Trends has no metro geo for these, so India is the honest coarser
    answer; the old default made them United States."""
    for code in UI_CITY_CODES:
        assert _geo(code) == "IN", f"city {code} → {_geo(code)!r}, expected IN"


def test_unknown_location_falls_back_to_worldwide_not_a_country():
    """A wrong country is indistinguishable from a right one in the rendered
    chart. Worldwide is at least a true answer to a broader question."""
    assert _geo(999999) == ""
    assert _geo(0) == ""


def test_no_duplicate_geo_targets_among_countries():
    """Two DataForSEO codes mapping to one alpha-2 means one of them is wrong —
    the codes are ISO-3166 numeric + 2000, so the mapping is one-to-one."""
    seen: dict[str, int] = {}
    for code, geo in _GEO_BY_LOCATION.items():
        assert geo not in seen, f"{code} and {seen[geo]} both map to {geo}"
        seen[geo] = code


def test_city_codes_do_not_collide_with_country_codes():
    assert not set(_CITY_TO_COUNTRY_GEO) & set(_GEO_BY_LOCATION)
