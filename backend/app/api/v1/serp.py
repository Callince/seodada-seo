import asyncio

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, get_db_session
from app.core.logging import log
from app.db.models import User
from app.integrations.dataforseo import serp as serp_api
from app.schemas.serp import (
    BulkRankRequest, BulkRankResponse, BulkRankRow, ComparisonRow, EngineRun,
    SerpRankingRequest, SerpResponse,
)
from app.services import brand, engine, usage
# Imported as a bare function, not `from app.services import ranking`: the
# /ranking route below is itself named `ranking`, which would shadow the module
# at import time and make `ranking.find_position` an AttributeError.
from app.services.ranking import find_position

router = APIRouter()

ENDPOINT = "serp.organic"

# usage_log endpoint label per engine. Google keeps the original `serp.organic`
# so its cost history stays one continuous series; the others get their own
# rows rather than being folded into it.
_ENDPOINT_BY_ENGINE = {
    "google": ENDPOINT,
    "bing": "serp.bing",
    "yahoo": "serp.yahoo",
}


def _build_comparison(runs: list[EngineRun]) -> list[ComparisonRow]:
    """Fold per-engine result lists into one row per URL.

    Keyed by URL, not domain: a domain can hold several positions on the same
    SERP and merging them would report a rank it does not hold.

    A URL missing from an engine is simply absent from `ranks` — that means "not
    in the top N fetched", which is genuinely different from a bad rank, and the
    UI has to be able to tell them apart.
    """
    rows: dict[str, ComparisonRow] = {}
    for run in runs:
        for r in run.results:
            if not r.url or r.position is None:
                continue
            row = rows.get(r.url)
            if row is None:
                row = rows[r.url] = ComparisonRow(url=r.url, domain=r.domain, title=r.title)
            # Keep the first non-empty title: engines word the same page
            # differently and a blank one would overwrite a good one.
            if not row.title and r.title:
                row.title = r.title
            row.ranks[run.engine] = r.position

    out = list(rows.values())
    for row in out:
        row.best_rank = min(row.ranks.values())
        row.engine_count = len(row.ranks)
    # Best position first; ties broken by how many engines agree, so a URL every
    # engine ranks outranks one that only a single engine does.
    out.sort(key=lambda r: (r.best_rank, -r.engine_count))
    return out


@router.post("/ranking", response_model=SerpResponse)
async def ranking(
    body: SerpRankingRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> SerpResponse:
    keyword = body.keyword.strip().lower()
    # Preserve request order but drop duplicates. Singleflight would already
    # collapse the upstream call, but each pass still writes its own usage_log
    # row, so ["google","google"] would otherwise log the same lookup twice.
    engines: list[str] = list(dict.fromkeys(body.engines))

    # One quota check for the whole request. Each engine is a separate billed
    # call, but they run concurrently on their own sessions, so gating each one
    # would race and could 402 halfway through a run the user already paid part
    # of. Same rationale as usage.metered_parallel.
    await usage.assert_within_quota(db, user)

    # `_run` yields raw dicts rather than EngineRun models on purpose: brand
    # enrichment mutates the row dicts in place, and pydantic validation would
    # have already copied them into SerpResult objects, so the enrichment would
    # land on throwaway copies. Models are built at the end, after enriching.
    async def _run(eng: str) -> dict:
        fetch_fn = lambda: serp_api.organic(  # noqa: E731
            keyword, body.location_code, body.language_code,
            body.depth, body.device, eng,
        )

        # `engine` is in the cache key. It is belt-and-braces rather than the
        # thing doing the work: params_hash hashes endpoint + params, and each
        # engine already has its own endpoint label, so the keys are distinct
        # either way. It stays because the key should name everything the
        # response varies by — if the labels are ever collapsed into one, this
        # is what keeps Bing from being served Google's cached rows.
        params = {
            "keyword": keyword,
            "location_code": body.location_code,
            "language_code": body.language_code,
            "depth": body.depth,
            "device": body.device,
            "engine": eng,
        }
        try:
            async with usage.engine_session() as own:
                resolved = await usage.metered(
                    own, user, _ENDPOINT_BY_ENGINE[eng], params,
                    ttl_seconds=engine.TTL["serp"],
                    fetch_fn=fetch_fn,
                    force_live=body.force_live,
                    check_quota=False,  # gated once above
                )
        except Exception as exc:
            # One engine failing must not take the others down with it — the
            # user paid for each, so a hiccup on one still returns the rest.
            log.warning("serp_engine_failed", engine=eng, keyword=keyword, error=str(exc))
            return {"engine": eng, "error": str(exc)[:200]}

        return {
            "engine": eng,
            "results": serp_api.parse_organic(resolved.data),
            # Only Google carries PAA; Bing and Yahoo return organic items only,
            # so an empty list here is the true answer, not a parse failure.
            "paa": serp_api.parse_paa(resolved.data),
            "cost_cents": resolved.cost_cents,
            "from_cache": resolved.from_cache,
            "source": resolved.source,
            "latency_ms": resolved.latency_ms,
            "fetched_at": resolved.fetched_at,
        }

    raw = list(await asyncio.gather(*(_run(e) for e in engines)))
    ok = [r for r in raw if not r.get("error")]

    # The first *successful* engine drives the flat fields, so a single-engine
    # request looks exactly as it did before, and a multi-engine one still shows
    # a table when the engine the user listed first is the one that failed.
    primary = ok[0] if ok else {"engine": engines[0]}

    # Brand *volume* bills per brand on the page, so it runs once against the
    # primary engine only — enriching every engine would multiply the most
    # expensive part of this request by the number of engines picked.
    brand_cost = await brand.enrich(
        db, user, primary.get("results") or [], body.location_code, body.language_code,
        with_volume=body.with_brand_volume,
    )

    runs = [EngineRun(**r) for r in raw]
    meta = {
        "cost_cents": sum(r.get("cost_cents", 0) for r in raw) + brand_cost,
        # Cached only when every engine that ran was cached — one live call
        # means the user was billed, and the badge must not claim otherwise.
        "from_cache": bool(ok) and all(r["from_cache"] for r in ok),
        "source": primary.get("source", ""),
        # Engines run concurrently, so the request took as long as the slowest
        # one, not the sum.
        "latency_ms": max((r["latency_ms"] for r in ok), default=0),
        "fetched_at": primary.get("fetched_at"),
    }
    return SerpResponse(
        keyword=body.keyword,
        results=primary.get("results") or [],
        paa=primary.get("paa") or [],
        meta=meta,
        engines=runs,
        comparison=_build_comparison([r for r in runs if not r.error]) if len(ok) > 1 else [],
    )


# Bulk fans out keywords x engines, so a 50-keyword two-engine run is 100
# upstream calls. Unbounded that would stampede DataForSEO and open 100 DB
# sessions at once; this keeps it to a steady, polite stream.
_BULK_CONCURRENCY = 6


@router.post("/bulk-rank", response_model=BulkRankResponse)
async def bulk_rank(
    body: BulkRankRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> BulkRankResponse:
    """Where does `domain` rank for each of many keywords?

    The inverse of /ranking: rather than the full SERP for one keyword, this
    returns only *your* row per keyword — the position and the URL that is
    actually indexed. Keywords where you do not appear come back with an empty
    `ranks`, which the UI shows as "not ranking"; they are deliberately kept,
    because a keyword you are missing from is the actionable result and you
    were billed for the lookup either way.
    """
    keywords = list(dict.fromkeys(k.strip().lower() for k in body.keywords if k.strip()))
    engines: list[str] = list(dict.fromkeys(body.engines))
    if not keywords:
        return BulkRankResponse(
            domain=body.domain, rows=[], engines=engines, ranked=0, checked=0,
            meta={"from_cache": True, "cost_cents": 0, "source": "none", "latency_ms": 0, "fetched_at": None},
        )

    # One quota check for the whole batch: the lookups run concurrently on their
    # own sessions, so gating each would race and could 402 midway through a run
    # the user has already partly paid for. Same rationale as metered_parallel.
    await usage.assert_within_quota(db, user)

    sem = asyncio.Semaphore(_BULK_CONCURRENCY)
    totals = {"cost": 0.0, "live": 0, "latency": 0}

    async def _one(keyword: str, eng: str) -> tuple[str, str, int | None, str | None, str | None]:
        """-> (keyword, engine, position, url, error)"""
        params = {
            "keyword": keyword,
            "location_code": body.location_code,
            "language_code": body.language_code,
            "depth": body.depth,
            "device": body.device,
            "engine": eng,
        }
        async with sem:
            try:
                async with usage.engine_session() as own:
                    resolved = await usage.metered(
                        own, user, _ENDPOINT_BY_ENGINE[eng], params,
                        ttl_seconds=engine.TTL["serp"],
                        fetch_fn=lambda: serp_api.organic(
                            keyword, body.location_code, body.language_code,
                            body.depth, body.device, eng,
                        ),
                        force_live=body.force_live,
                        check_quota=False,  # gated once above
                    )
            except Exception as exc:
                # One keyword failing must not sink the batch — the other 49
                # lookups already cost money.
                log.warning("bulk_rank_failed", keyword=keyword, engine=eng, error=str(exc))
                return keyword, eng, None, None, str(exc)[:160]

        totals["cost"] += resolved.cost_cents
        totals["latency"] = max(totals["latency"], resolved.latency_ms)
        if not resolved.from_cache:
            totals["live"] += 1
        rows = serp_api.parse_organic(resolved.data)
        position, url = find_position(rows, body.domain)
        return keyword, eng, position, url, None

    results = await asyncio.gather(*(_one(k, e) for k in keywords for e in engines))

    by_keyword: dict[str, BulkRankRow] = {k: BulkRankRow(keyword=k) for k in keywords}
    errors: dict[str, list[str]] = {k: [] for k in keywords}
    for keyword, eng, position, url, error in results:
        row = by_keyword[keyword]
        if error:
            errors[keyword].append(error)
            continue
        if position is not None:
            row.ranks[eng] = position
            if url:
                row.urls[eng] = url

    for k, row in by_keyword.items():
        row.best = min(row.ranks.values()) if row.ranks else None
        # Only an error when *every* engine failed; a partial failure still has
        # usable data and must not be shown as a dead row.
        if errors[k] and not row.ranks and len(errors[k]) == len(engines):
            row.error = errors[k][0]

    # Ranked first (best position ascending), then unranked, then errors — the
    # table's job is "where am I", so found beats not-found.
    ordered = sorted(
        by_keyword.values(),
        key=lambda r: (r.best is None, r.error is not None, r.best or 0, r.keyword),
    )
    return BulkRankResponse(
        domain=body.domain,
        rows=ordered,
        engines=engines,
        ranked=sum(1 for r in ordered if r.best is not None),
        checked=len(keywords),
        meta={
            "from_cache": totals["live"] == 0,
            "cost_cents": totals["cost"],
            "source": "live" if totals["live"] else "cache",
            # Calls run concurrently, so the batch took as long as its slowest
            # member, not the sum.
            "latency_ms": totals["latency"],
            "fetched_at": None,
        },
    )
