from __future__ import annotations

import asyncio

import pytest

from app.integrations.dataforseo import keywords as kw
from app.integrations.dataforseo.client import DfsResult
from app.services import coalescer as coalescer_mod
from app.services.coalescer import SearchVolumeCoalescer, _flatten


def _labs_result(keywords, volume=lambda t: len(t)):
    """The nested shape Labs keyword_overview actually returns."""
    return [
        {
            "items": [
                {"keyword": t, "keyword_info": {"search_volume": volume(t)}}
                for t in keywords
            ]
        }
    ]


@pytest.mark.asyncio
async def test_concurrent_search_volume_fires_one_call(monkeypatch):
    calls = {"n": 0, "unions": []}

    async def fake(union, loc, lang):
        calls["n"] += 1
        calls["unions"].append(list(union))
        return DfsResult(result=_labs_result(union), cost_cents=10)

    monkeypatch.setattr(coalescer_mod.labs, "keywords_overview", fake)

    c = SearchVolumeCoalescer(window=0.03)
    r0, r1, r2 = await asyncio.gather(
        c.fetch(["nike"], 2840, "en"),
        c.fetch(["adidas", "puma"], 2840, "en"),
        c.fetch(["nike", "reebok"], 2840, "en"),
    )

    # One coalesced upstream call for the union of all keywords.
    assert calls["n"] == 1
    assert sorted(calls["unions"][0]) == ["adidas", "nike", "puma", "reebok"]

    # Each waiter only receives the rows it asked for.
    assert {it["keyword"] for it in r0.result} == {"nike"}
    assert {it["keyword"] for it in r1.result} == {"adidas", "puma"}
    assert {it["keyword"] for it in r2.result} == {"nike", "reebok"}

    # Cost is split across waiters and sums exactly to the upstream cost.
    assert r0.cost_cents + r1.cost_cents + r2.cost_cents == 10


@pytest.mark.asyncio
async def test_different_locations_are_not_merged(monkeypatch):
    calls = {"n": 0}

    async def fake(union, loc, lang):
        calls["n"] += 1
        return DfsResult(result=_labs_result(union, lambda t: 1), cost_cents=4)

    monkeypatch.setattr(coalescer_mod.labs, "keywords_overview", fake)

    c = SearchVolumeCoalescer(window=0.03)
    await asyncio.gather(
        c.fetch(["nike"], 2840, "en"),
        c.fetch(["nike"], 2826, "en"),  # different location → separate batch
    )
    assert calls["n"] == 2


@pytest.mark.asyncio
async def test_empty_terms_short_circuit(monkeypatch):
    async def boom(*a, **k):
        raise AssertionError("should not call upstream for empty terms")

    monkeypatch.setattr(coalescer_mod.labs, "keywords_overview", boom)
    c = SearchVolumeCoalescer(window=0.02)
    out = await c.fetch(["  "], 2840, "en")
    assert out.result == [] and out.cost_cents == 0


@pytest.mark.asyncio
async def test_union_over_the_ceiling_is_chunked_not_truncated(monkeypatch):
    """keyword_overview takes at most 700 keywords and slices silently. No single
    request reaches that, but the union of concurrent waiters can — waiters would
    get a partial set with no error."""
    seen = []

    async def fake(union, loc, lang):
        seen.append(len(union))
        return DfsResult(result=_labs_result(union, lambda t: 1), cost_cents=1.0)

    monkeypatch.setattr(coalescer_mod.labs, "keywords_overview", fake)

    c = SearchVolumeCoalescer(window=0.03)
    a, b = await asyncio.gather(
        c.fetch([f"a{i}" for i in range(500)], 2840, "en"),
        c.fetch([f"b{i}" for i in range(400)], 2840, "en"),
    )
    assert seen == [700, 200], seen  # 900 unique terms, chunked
    assert all(n <= coalescer_mod.CHUNK for n in seen)
    # every waiter still gets all of its own keywords back
    assert len(a.result) == 500 and len(b.result) == 400


# --- Labs -> google_ads row shape ----------------------------------------
# Upstream moved to Labs keyword_overview (see docs/PROVIDER_STRATEGY.md) but
# every consumer still speaks the flat google_ads row shape, so this pins the
# contract between them.

SAMPLE = {
    "keyword": "x",
    "keyword_info": {
        "search_volume": 10,
        "cpc": 1.5,
        "competition": 0.06,
        "competition_level": "LOW",
        "monthly_searches": [{"year": 2026, "month": 6, "search_volume": 9}],
    },
}


def test_flatten_feeds_parse_volume_rows():
    assert kw.parse_volume_rows([_flatten(SAMPLE)]) == [
        {
            "keyword": "x",
            "search_volume": 10,
            "cpc": 1.5,
            "competition": 6,
            "competition_level": "LOW",
            "monthly_searches": [{"year": 2026, "month": 6, "volume": 9}],
        }
    ]


def test_competition_is_rescaled_not_floored():
    # Labs reports competition on 0-1, google_ads on 0-100, and the table
    # renders "{competition}/100". Without the x100 every keyword under 0.5
    # competition renders as "0/100".
    assert _flatten(SAMPLE)["competition_index"] == 6
    assert _flatten(SAMPLE)["competition"] == "LOW"  # the label, not the number


def test_flatten_feeds_parse_search_volume():
    assert kw.parse_search_volume([_flatten(SAMPLE)]) == {"x": 10}


def test_missing_keyword_info_survives():
    # Labs omits keyword_info for keywords it has no data on. Verified live:
    # google_ads returns a null volume for those same keywords, so this is
    # parity, not data loss — it just must not raise.
    row = _flatten({"keyword": "y"})
    assert row["competition_index"] is None and row["search_volume"] is None
    assert kw.parse_volume_rows([row])[0]["monthly_searches"] == []


# --- cost splitting -------------------------------------------------------
# cost_cents is a float (DataForSEO bills sub-cent). The Labs swap dropped the
# per-call cost from 9c to ~1.2c, which made integer rounding here charge one
# waiter 1.000c and another 0.236c for an equal share of the same call.


async def _split(monkeypatch, total, term_counts):
    async def fake(union, loc, lang):
        return DfsResult(result=_labs_result(union, lambda t: 1), cost_cents=total)

    monkeypatch.setattr(coalescer_mod.labs, "keywords_overview", fake)
    c = SearchVolumeCoalescer(window=0.02)
    sets = [[f"w{i}k{j}" for j in range(n)] for i, n in enumerate(term_counts)]
    res = await asyncio.gather(*(c.fetch(s, 2840, "en") for s in sets))
    return [r.cost_cents for r in res]


@pytest.mark.asyncio
async def test_split_is_proportional_not_rounded_to_whole_cents(monkeypatch):
    shares = await _split(monkeypatch, 1.236, [2, 2])
    assert sum(shares) == 1.236, shares
    # equal keyword counts -> equal shares. Integer rounding gave [1.0, 0.236].
    assert max(shares) - min(shares) < 0.01, shares


@pytest.mark.asyncio
async def test_split_tracks_unequal_keyword_counts(monkeypatch):
    shares = await _split(monkeypatch, 2.0, [1, 3])
    assert sum(shares) == 2.0, shares
    assert shares[0] < shares[1], shares


@pytest.mark.asyncio
async def test_split_absorbs_rounding_remainder_in_last_waiter(monkeypatch):
    # Three equal waiters over 1.0c: 1/3 each rounds to 0.3333, summing to
    # 0.9999 — a lost fraction of a cent on every coalesced call.
    shares = await _split(monkeypatch, 1.0, [1, 1, 1])
    assert sum(shares) == 1.0, shares
