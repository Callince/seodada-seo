from __future__ import annotations

import asyncio

import pytest

from app.integrations.dataforseo.client import DfsResult
from app.services import coalescer as coalescer_mod
from app.services.coalescer import SearchVolumeCoalescer


@pytest.mark.asyncio
async def test_concurrent_search_volume_fires_one_call(monkeypatch):
    calls = {"n": 0, "unions": []}

    async def fake_search_volume(union, loc, lang):
        calls["n"] += 1
        calls["unions"].append(list(union))
        return DfsResult(
            result=[{"keyword": t, "search_volume": len(t)} for t in union],
            cost_cents=10,
        )

    monkeypatch.setattr(coalescer_mod.kw, "search_volume", fake_search_volume)

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

    async def fake_search_volume(union, loc, lang):
        calls["n"] += 1
        return DfsResult(result=[{"keyword": t, "search_volume": 1} for t in union], cost_cents=4)

    monkeypatch.setattr(coalescer_mod.kw, "search_volume", fake_search_volume)

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

    monkeypatch.setattr(coalescer_mod.kw, "search_volume", boom)
    c = SearchVolumeCoalescer(window=0.02)
    out = await c.fetch(["  "], 2840, "en")
    assert out.result == [] and out.cost_cents == 0
