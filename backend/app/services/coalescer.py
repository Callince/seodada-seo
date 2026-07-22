"""Batch coalescer for keyword search volume.

Upstream is Labs `keyword_overview`, not `keywords_data/google_ads/search_volume`
— measured on identical keyword sets: same volumes to the number, but 1.26c
against 9.00c, and ~92 months of history instead of 12. google_ads bills a flat
9c per call whatever the keyword count, which made this the single largest line
in usage_log (37% of all spend). See docs/PROVIDER_STRATEGY.md.

The endpoint accepts up to 700 keywords in a single billed call (google_ads took
~1000; the UI sends at most 100, so the lower ceiling is not reachable). Within
one request we already batch, but *concurrent* requests
(e.g. brand-volume enrichment fired by several SERP lookups at once, or several
users) each issue their own call for different keyword sets.

This coalescer collects search-volume fetches over a short time window, fires
ONE upstream call for the union of all keywords, then fans the matching rows
back to each waiter. The upstream cost is split proportionally across waiters by
how many keywords each requested, with the remainder assigned to the last waiter
so the sum of attributed costs equals the real upstream cost exactly.

It sits *behind* the cost engine: the engine still caches each distinct keyword
set separately; the coalescer only fuses the upstream calls that miss cache
concurrently.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field

from app.core.logging import log
from app.integrations.dataforseo import labs
from app.integrations.dataforseo.client import DfsResult

DEFAULT_WINDOW = 0.06  # seconds to accumulate before firing
CHUNK = 700  # keyword_overview's documented per-call ceiling


def _flatten(it: dict) -> dict:
    """Labs' nested item -> the flat google_ads row shape.

    Keeps `kw.parse_volume_rows` and `kw.parse_search_volume` working unchanged,
    so swapping the upstream is contained to this file.

    `competition` differs in scale between the two: google_ads reports
    competition_index on 0-100, Labs reports competition on 0-1. Verified on the
    same keywords (Labs 0.06 x 100 == google_ads index 6), so the multiply keeps
    the rendered "{competition}/100" identical rather than flooring everything
    to 0. Same conversion as labs.parse_keywords_overview.
    """
    info = it.get("keyword_info") or {}
    comp = info.get("competition")
    return {
        "keyword": it.get("keyword"),
        "search_volume": info.get("search_volume"),
        "cpc": info.get("cpc"),
        "competition_index": None if comp is None else round(comp * 100),
        "competition": info.get("competition_level"),
        "monthly_searches": info.get("monthly_searches") or [],
    }


@dataclass
class _Reg:
    terms: list[str]
    future: asyncio.Future


@dataclass
class _Batch:
    regs: list[_Reg] = field(default_factory=list)
    flushing: bool = False


class SearchVolumeCoalescer:
    def __init__(self, window: float = DEFAULT_WINDOW) -> None:
        self._window = window
        self._pending: dict[tuple[int, str], _Batch] = {}
        self._lock = asyncio.Lock()

    async def fetch(self, terms: list[str], location_code: int, language_code: str) -> DfsResult:
        """Return search-volume rows for `terms`, coalescing concurrent calls."""
        norm = sorted({t.strip().lower() for t in terms if t.strip()})
        if not norm:
            return DfsResult(result=[], cost_cents=0)

        loop = asyncio.get_running_loop()
        reg = _Reg(terms=norm, future=loop.create_future())
        key = (location_code, language_code)

        async with self._lock:
            batch = self._pending.get(key)
            if batch is None:
                batch = _Batch()
                self._pending[key] = batch
                asyncio.create_task(self._flush_after(key, location_code, language_code))
            batch.regs.append(reg)

        return await reg.future

    async def _flush_after(self, key: tuple[int, str], location_code: int, language_code: str) -> None:
        await asyncio.sleep(self._window)
        async with self._lock:
            batch = self._pending.pop(key, None)
        if not batch or not batch.regs:
            return

        union = sorted({t for r in batch.regs for t in r.terms})
        # The union is the sum of every concurrent waiter's keywords, so it can
        # exceed the endpoint's 700 ceiling even though no single request does.
        # keywords_overview slices silently, which would hand waiters a partial
        # set with no error — chunk instead.
        chunks = [union[i : i + CHUNK] for i in range(0, len(union), CHUNK)]
        try:
            parts = await asyncio.gather(
                *(labs.keywords_overview(c, location_code, language_code) for c in chunks)
            )
        except Exception as exc:  # propagate to every waiter
            for r in batch.regs:
                if not r.future.done():
                    r.future.set_exception(exc)
            return

        by_kw: dict[str, dict] = {}
        for dfs in parts:
            for it in (dfs.result[0].get("items") if dfs.result else None) or []:
                key_kw = (it.get("keyword") or "").lower()
                if key_kw:
                    by_kw[key_kw] = _flatten(it)
        total_cost = sum(p.cost_cents for p in parts)
        total_requested = sum(len(r.terms) for r in batch.regs) or 1
        log.info(
            "search_volume_coalesced",
            waiters=len(batch.regs),
            union=len(union),
            cost_cents=total_cost,
        )

        allocated = 0.0
        last = len(batch.regs) - 1
        for i, r in enumerate(batch.regs):
            # 4dp, not whole cents: cost_cents is a float because DataForSEO
            # bills sub-cent amounts, and this call is ~1.2c total. Rounding to
            # integers charged one waiter 1c and another 0.236c for an equal
            # share of the same keywords. The last waiter still absorbs the
            # remainder so the attributed costs sum to the real upstream cost.
            share = (
                total_cost - allocated
                if i == last
                else round(total_cost * len(r.terms) / total_requested, 4)
            )
            allocated += share
            items = [by_kw[t] for t in r.terms if t in by_kw]
            if not r.future.done():
                r.future.set_result(DfsResult(result=items, cost_cents=share))


# Module-level singleton used by the volume route and brand enrichment.
search_volume_coalescer = SearchVolumeCoalescer()
