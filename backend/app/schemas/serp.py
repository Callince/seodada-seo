from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import Meta


# DataForSEO serves all three from an identical payload. Brave was removed once
# it stopped being free — see docs/PROVIDER_STRATEGY.md §7.1.
Engine = Literal["google", "bing", "yahoo"]


class SerpRankingRequest(BaseModel):
    keyword: str = Field(min_length=1, max_length=300)
    location_code: int = 2840  # United States
    language_code: str = "en"
    depth: int = Field(default=10, ge=1, le=100)
    device: Literal["desktop", "mobile"] = "desktop"
    # One billed call per engine — Google and Bing 0.200c each at depth 10,
    # Yahoo 0.350c. Defaults to Google alone so the cost of an unchanged request
    # does not move.
    engines: list[Engine] = Field(default=["google"], min_length=1, max_length=4)
    # True bypasses every cache read and fetches fresh (billed) data upstream.
    force_live: bool = False
    # Brand *volume* is a second billed lookup that typically costs several times
    # the SERP itself (it bills per brand on the page), so it is opt-in. Brand
    # *names* are always derived locally and free.
    with_brand_volume: bool = False


class SerpResult(BaseModel):
    position: int | None = None  # organic rank (1..N, gapless)
    serp_slot: int | None = None  # absolute slot among all SERP elements
    featured: bool = False  # True when this is the featured snippet
    title: str = ""
    description: str | None = None
    url: str = ""
    domain: str = ""
    brand_name: str = ""
    brand_volume: int | None = None


class PaaItem(BaseModel):
    question: str = ""
    answer: str | None = None
    url: str | None = None


class EngineRun(BaseModel):
    """One engine's own result set, plus whether it actually succeeded.

    A failing engine must not fail the whole request: an upstream hiccup on one
    has to leave the others' results standing, since the user paid for each.
    `error` carries why this one is empty.
    """

    engine: Engine
    results: list[SerpResult] = []
    paa: list[PaaItem] = []
    cost_cents: float = 0
    from_cache: bool = False
    source: str = ""
    latency_ms: int = 0
    fetched_at: str | None = None
    error: str | None = None


class ComparisonRow(BaseModel):
    """One URL, with its rank on each engine that returned it.

    Keyed by URL rather than domain: a domain can hold several positions on the
    same SERP, and collapsing them would invent a rank it does not have.
    `ranks` omits engines where the URL did not appear at all, which the UI
    renders as "not in top N" — distinct from rank 0.
    """

    url: str = ""
    domain: str = ""
    title: str = ""
    ranks: dict[str, int] = {}
    best_rank: int = 0  # sorts the table; the strongest position across engines
    engine_count: int = 0  # how many engines ranked it — the consensus signal


class SerpResponse(BaseModel):
    keyword: str
    # The first requested engine's rows, so a single-engine request is shaped
    # exactly as it was before engines existed.
    results: list[SerpResult]
    paa: list[PaaItem]
    meta: Meta
    engines: list[EngineRun] = []
    comparison: list[ComparisonRow] = []


class BulkRankRequest(BaseModel):
    """Bulk 'where does my page rank' across many keywords.

    The point is the inverse of /ranking: instead of the full SERP for one
    keyword, this returns just *your* row for each of many keywords.
    """

    keywords: list[str] = Field(min_length=1, max_length=50)
    domain: str = Field(min_length=1, max_length=255)
    location_code: int = 2840
    language_code: str = "en"
    # Depth 100 by default and deliberately: a rank check that only looks 10
    # deep reports "not ranking" for a page sitting at #40, which is the exact
    # question this tool exists to answer. It costs 1.55c per keyword per
    # engine against 0.200c at depth 10 — the UI shows a live estimate.
    depth: int = Field(default=100, ge=10, le=100)
    device: Literal["desktop", "mobile"] = "desktop"
    engines: list[Engine] = Field(default=["google"], min_length=1, max_length=4)
    force_live: bool = False


class BulkRankRow(BaseModel):
    keyword: str
    # engine -> position. An engine absent means the domain did not appear in
    # the crawled depth — rendered as "not ranking", never as 0.
    ranks: dict[str, int] = {}
    # engine -> the URL that actually ranks. This is the "page that is indexed"
    # for that keyword, which is the thing worth knowing when several of your
    # pages compete for one term.
    urls: dict[str, str] = {}
    best: int | None = None  # best position across engines; sorts the table
    error: str | None = None  # set when every engine failed for this keyword


class BulkRankResponse(BaseModel):
    domain: str
    rows: list[BulkRankRow]
    engines: list[Engine]
    # How many keywords placed at all — the headline the table is answering.
    ranked: int
    checked: int
    meta: Meta
