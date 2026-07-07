"""Batch coalescer for `search_volume`.

DataForSEO's search-volume endpoint accepts up to ~1000 keywords in a single
billed call. Within one request we already batch, but *concurrent* requests
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
from app.integrations.dataforseo import keywords as kw
from app.integrations.dataforseo.client import DfsResult

DEFAULT_WINDOW = 0.06  # seconds to accumulate before firing


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
        try:
            dfs = await kw.search_volume(union, location_code, language_code)
        except Exception as exc:  # propagate to every waiter
            for r in batch.regs:
                if not r.future.done():
                    r.future.set_exception(exc)
            return

        by_kw = {(it.get("keyword") or "").lower(): it for it in (dfs.result or [])}
        total_cost = dfs.cost_cents
        total_requested = sum(len(r.terms) for r in batch.regs) or 1
        log.info(
            "search_volume_coalesced",
            waiters=len(batch.regs),
            union=len(union),
            cost_cents=total_cost,
        )

        allocated = 0
        last = len(batch.regs) - 1
        for i, r in enumerate(batch.regs):
            share = total_cost - allocated if i == last else round(total_cost * len(r.terms) / total_requested)
            allocated += share
            items = [by_kw[t] for t in r.terms if t in by_kw]
            if not r.future.done():
                r.future.set_result(DfsResult(result=items, cost_cents=share))


# Module-level singleton used by the volume route and brand enrichment.
search_volume_coalescer = SearchVolumeCoalescer()
