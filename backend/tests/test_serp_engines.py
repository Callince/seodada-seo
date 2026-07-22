"""Multi-engine SERP ranking.

Google, Bing and Yahoo all come from DataForSEO — verified live: identical
payload, and `parse_organic` consumes all three unchanged. Google and Bing cost
0.200c each at depth 10; only Google carries AI Overview and People Also Ask.

Brave is deliberately not here: DataForSEO has no endpoint for it ("40402
Invalid Path"), and its own API stopped being free, so it was removed entirely.
See docs/PROVIDER_STRATEGY.md §7.1.
"""
from __future__ import annotations

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1 import serp as serp_route
from app.api.v1.serp import _build_comparison
from app.db.models import Organization, UsageLog, User
from app.integrations.dataforseo.client import DfsResult
from app.schemas.serp import BulkRankRequest, EngineRun, SerpRankingRequest, SerpResult


async def _user(db: AsyncSession) -> User:
    org = Organization(id="o1", name="T")
    db.add(org)
    user = User(email="a@b.c", hashed_password="x", org_id=org.id, role="owner")
    db.add(user)
    await db.commit()
    return user


def _serp(*urls) -> DfsResult:
    """A DataForSEO-shaped organic SERP for the given urls, in order."""
    return DfsResult(
        result=[
            {
                "items": [
                    {
                        "type": "organic", "rank_group": i, "rank_absolute": i,
                        "title": f"T{i}", "url": u, "domain": u.split("/")[2],
                        "description": "d",
                    }
                    for i, u in enumerate(urls, start=1)
                ]
            }
        ],
        cost_cents=0.2,
    )


# --- the comparison fold --------------------------------------------------

def _run(engine, urls_by_rank):
    return EngineRun(
        engine=engine,
        results=[
            SerpResult(position=i, url=u, domain=u.split("/")[2], title=f"{engine}-{i}")
            for i, u in enumerate(urls_by_rank, start=1)
        ],
    )


def test_comparison_puts_each_engines_rank_on_one_row():
    rows = _build_comparison([
        _run("google", ["https://a.com/", "https://b.com/"]),
        _run("bing", ["https://b.com/", "https://a.com/"]),
    ])
    by_url = {r.url: r for r in rows}
    assert by_url["https://a.com/"].ranks == {"google": 1, "bing": 2}
    assert by_url["https://b.com/"].ranks == {"google": 2, "bing": 1}


def test_url_missing_from_an_engine_is_absent_not_zero():
    # "not in the top N" is a different fact from "ranked 0" and the UI has to
    # be able to tell them apart.
    rows = _build_comparison([
        _run("google", ["https://only-google.com/"]),
        _run("bing", ["https://only-bing.com/"]),
    ])
    g = next(r for r in rows if r.url == "https://only-google.com/")
    assert "bing" not in g.ranks
    assert g.ranks == {"google": 1}
    assert g.engine_count == 1


def test_same_domain_at_two_positions_is_not_collapsed():
    # A domain can hold several slots on one SERP; merging by domain would
    # report a rank it does not hold.
    rows = _build_comparison([_run("google", ["https://a.com/x", "https://a.com/y"])])
    assert len(rows) == 2
    assert {r.ranks["google"] for r in rows} == {1, 2}


def test_sorted_by_best_rank_then_consensus():
    rows = _build_comparison([
        _run("google", ["https://solo.com/", "https://both.com/"]),
        _run("bing", ["https://both.com/"]),
    ])
    # both.com is #1 on bing so it leads on best_rank...
    assert rows[0].url == "https://both.com/"
    assert rows[0].best_rank == 1 and rows[0].engine_count == 2
    assert rows[1].url == "https://solo.com/"


def test_consensus_breaks_ties_on_equal_best_rank():
    rows = _build_comparison([
        _run("google", ["https://agreed.com/"]),
        _run("bing", ["https://agreed.com/"]),
        _run("yahoo", ["https://lone.com/"]),
    ])
    assert [r.url for r in rows] == ["https://agreed.com/", "https://lone.com/"]
    assert rows[0].engine_count == 2 and rows[1].engine_count == 1


# --- the route ------------------------------------------------------------

@pytest.mark.asyncio
async def test_each_engine_hits_its_own_path_and_cache_key(db, monkeypatch):
    user = await _user(db)
    seen = []

    async def fake_organic(kw, loc, lang, depth=10, device="desktop", engine="google"):
        seen.append(engine)
        return _serp(f"https://{engine}.com/")

    monkeypatch.setattr(serp_route.serp_api, "organic", fake_organic)
    body = SerpRankingRequest(keyword="seo tools", engines=["google", "bing"])
    resp = await serp_route.ranking(body, db=db, user=user)

    assert sorted(seen) == ["bing", "google"]
    # Distinct cache keys: if `engine` were missing from the params hash, bing
    # would be served google's cached rows and only one call would fire.
    assert {e.engine for e in resp.engines} == {"google", "bing"}
    got = {e.engine: e.results[0].domain for e in resp.engines}
    assert got == {"google": "google.com", "bing": "bing.com"}


@pytest.mark.asyncio
async def test_cost_is_the_sum_of_every_engine(db, monkeypatch):
    user = await _user(db)

    async def fake_organic(kw, loc, lang, depth=10, device="desktop", engine="google"):
        return _serp(f"https://{engine}.com/")

    monkeypatch.setattr(serp_route.serp_api, "organic", fake_organic)
    body = SerpRankingRequest(keyword="k", engines=["google", "bing"])
    resp = await serp_route.ranking(body, db=db, user=user)
    assert resp.meta.cost_cents == pytest.approx(0.4)  # 0.2 + 0.2, not 0.2


@pytest.mark.asyncio
async def test_one_engine_failing_leaves_the_others_standing(db, monkeypatch):
    user = await _user(db)

    async def fake_organic(kw, loc, lang, depth=10, device="desktop", engine="google"):
        if engine == "bing":
            raise RuntimeError("bing exploded")
        return _serp("https://a.com/")

    monkeypatch.setattr(serp_route.serp_api, "organic", fake_organic)
    body = SerpRankingRequest(keyword="k", engines=["google", "bing"])
    resp = await serp_route.ranking(body, db=db, user=user)

    runs = {e.engine: e for e in resp.engines}
    assert runs["bing"].error and "exploded" in runs["bing"].error
    assert runs["google"].error is None and runs["google"].results
    assert resp.results, "the surviving engine must still drive the flat table"


@pytest.mark.asyncio
async def test_primary_falls_through_to_a_surviving_engine(db, monkeypatch):
    """The first *listed* engine failing must not blank the table when another
    engine returned perfectly good rows."""
    user = await _user(db)

    async def fake_organic(kw, loc, lang, depth=10, device="desktop", engine="google"):
        if engine == "google":
            raise RuntimeError("down")
        return _serp("https://b.com/")

    monkeypatch.setattr(serp_route.serp_api, "organic", fake_organic)
    body = SerpRankingRequest(keyword="k", engines=["google", "bing"])
    resp = await serp_route.ranking(body, db=db, user=user)
    assert resp.results and resp.results[0].domain == "b.com"


@pytest.mark.asyncio
async def test_duplicate_engines_are_not_logged_twice(db, monkeypatch):
    """Singleflight already collapses the upstream *call* for an identical key,
    but each pass still records its own usage_log row — so the dedupe is what
    stops one lookup being logged as two."""
    user = await _user(db)
    calls = []

    async def fake_organic(kw, loc, lang, depth=10, device="desktop", engine="google"):
        calls.append(engine)
        return _serp("https://a.com/")

    monkeypatch.setattr(serp_route.serp_api, "organic", fake_organic)
    body = SerpRankingRequest(keyword="k", engines=["google", "google"])
    resp = await serp_route.ranking(body, db=db, user=user)

    assert calls == ["google"]
    assert resp.meta.cost_cents == pytest.approx(0.2)
    assert len(resp.engines) == 1
    logged = await db.scalar(
        select(func.count()).select_from(UsageLog).where(UsageLog.org_id == user.org_id)
    )
    assert logged == 1, f"one lookup should log one row, got {logged}"


@pytest.mark.asyncio
async def test_each_engine_gets_its_own_usage_log_label(db, monkeypatch):
    """The endpoint label is what actually separates the engines in the cache
    (params_hash hashes endpoint + params) and in cost reporting — Google keeps
    `serp.organic` so its history stays one continuous series."""
    user = await _user(db)

    async def fake_organic(kw, loc, lang, depth=10, device="desktop", engine="google"):
        return _serp(f"https://{engine}.com/")

    monkeypatch.setattr(serp_route.serp_api, "organic", fake_organic)
    body = SerpRankingRequest(keyword="k", engines=["google", "bing"])
    await serp_route.ranking(body, db=db, user=user)

    rows = (await db.scalars(select(UsageLog.endpoint).where(UsageLog.org_id == user.org_id))).all()
    assert sorted(rows) == ["serp.bing", "serp.organic"]


@pytest.mark.asyncio
async def test_single_engine_response_is_shaped_as_before(db, monkeypatch):
    """A default request must look exactly like it did before engines existed —
    flat results, and no comparison table for one engine."""
    user = await _user(db)

    async def fake_organic(kw, loc, lang, depth=10, device="desktop", engine="google"):
        return _serp("https://a.com/", "https://b.com/")

    monkeypatch.setattr(serp_route.serp_api, "organic", fake_organic)
    resp = await serp_route.ranking(SerpRankingRequest(keyword="k"), db=db, user=user)
    assert [r.domain for r in resp.results] == ["a.com", "b.com"]
    assert resp.comparison == []
    assert resp.meta.cost_cents == pytest.approx(0.2)


# --- bulk rank ------------------------------------------------------------
# "Where does my page rank for each of these keywords, and which URL is the one
# that's indexed" — the inverse of /ranking, which returns a whole SERP.

def _serp_at(position: int | None, domain: str, url: str, total: int = 10) -> DfsResult:
    """A SERP of `total` filler results with `domain` planted at `position`.

    Filler matters: `parse_organic` derives `position` from the *order* of the
    rows it keeps (`len(out) + 1`), not from `rank_group`, so a one-item SERP
    always reports position 1 no matter what rank the item claims. Planting the
    target among real filler is the only way to assert a rank of 5.
    """
    items = []
    for i in range(1, total + 1):
        if position is not None and i == position:
            d, u = domain, url
        else:
            d, u = f"filler{i}.com", f"https://filler{i}.com/p"
        items.append({"type": "organic", "rank_group": i, "rank_absolute": i,
                      "title": f"T{i}", "url": u, "domain": d, "description": "d"})
    return DfsResult(result=[{"items": items}], cost_cents=1.55)


async def _bulk(db, user, monkeypatch, serp_for, **kw):
    async def fake_organic(keyword, loc, lang, depth=10, device="desktop", engine="google"):
        return serp_for(keyword, engine)

    monkeypatch.setattr(serp_route.serp_api, "organic", fake_organic)
    body = BulkRankRequest(domain="nike.com", **kw)
    return await serp_route.bulk_rank(body, db=db, user=user)


@pytest.mark.asyncio
async def test_bulk_reports_position_and_the_indexed_url(db, monkeypatch):
    """The URL matters as much as the rank: when several of your pages compete
    for a term, you need to know which one Google actually chose."""
    user = await _user(db)
    resp = await _bulk(
        db, user, monkeypatch,
        lambda k, e: _serp_at(2, "www.nike.com", "https://nike.com/air-max"),
        keywords=["running shoes"],
    )
    row = resp.rows[0]
    assert row.ranks == {"google": 2}
    assert row.urls == {"google": "https://nike.com/air-max"}
    assert row.best == 2
    assert resp.ranked == 1 and resp.checked == 1


@pytest.mark.asyncio
async def test_unranked_keywords_are_kept_not_dropped(db, monkeypatch):
    """A keyword you are missing from is the actionable result — and it was
    billed either way, so silently dropping it hides paid-for information."""
    user = await _user(db)
    resp = await _bulk(
        db, user, monkeypatch,
        lambda k, e: (_serp_at(1, "www.nike.com", "https://nike.com/a")
                      if k == "hit" else _serp_at(None, "", "")),
        keywords=["hit", "miss"],
    )
    by = {r.keyword: r for r in resp.rows}
    assert by["miss"].ranks == {} and by["miss"].best is None
    assert by["miss"].error is None, "not ranking is not an error"
    assert resp.ranked == 1 and resp.checked == 2


@pytest.mark.asyncio
async def test_ranked_keywords_sort_above_unranked(db, monkeypatch):
    user = await _user(db)
    resp = await _bulk(
        db, user, monkeypatch,
        lambda k, e: (_serp_at(9, "www.nike.com", "https://nike.com/x") if k == "deep"
                      else _serp_at(1, "www.nike.com", "https://nike.com/y") if k == "top"
                      else _serp_at(None, "", "")),
        keywords=["deep", "none", "top"],
    )
    assert [r.keyword for r in resp.rows] == ["top", "deep", "none"]


@pytest.mark.asyncio
async def test_subdomain_counts_as_the_domain(db, monkeypatch):
    """shop.nike.com is still nike.com ranking — find_position handles this and
    bulk must not reimplement matching."""
    user = await _user(db)
    resp = await _bulk(
        db, user, monkeypatch,
        lambda k, e: _serp_at(4, "shop.nike.com", "https://shop.nike.com/p"),
        keywords=["sneakers"],
    )
    assert resp.rows[0].ranks == {"google": 4}


@pytest.mark.asyncio
async def test_per_engine_positions_land_in_one_row(db, monkeypatch):
    user = await _user(db)
    resp = await _bulk(
        db, user, monkeypatch,
        lambda k, e: _serp_at(3 if e == "google" else 7, "www.nike.com", f"https://nike.com/{e}"),
        keywords=["shoes"], engines=["google", "bing"],
    )
    row = resp.rows[0]
    assert row.ranks == {"google": 3, "bing": 7}
    assert row.urls["bing"].endswith("/bing")
    assert row.best == 3, "best is the strongest position across engines"


@pytest.mark.asyncio
async def test_one_keyword_failing_does_not_sink_the_batch(db, monkeypatch):
    """The other lookups already cost money — they must still come back."""
    user = await _user(db)

    async def fake_organic(keyword, loc, lang, depth=10, device="desktop", engine="google"):
        if keyword == "boom":
            raise RuntimeError("upstream exploded")
        return _serp_at(1, "www.nike.com", "https://nike.com/ok")

    monkeypatch.setattr(serp_route.serp_api, "organic", fake_organic)
    resp = await serp_route.bulk_rank(
        BulkRankRequest(domain="nike.com", keywords=["boom", "fine"]), db=db, user=user,
    )
    by = {r.keyword: r for r in resp.rows}
    assert by["boom"].error and "exploded" in by["boom"].error
    assert by["fine"].ranks == {"google": 1}


@pytest.mark.asyncio
async def test_partial_engine_failure_is_not_an_error_row(db, monkeypatch):
    """Bing failing while Google returned a rank still leaves usable data."""
    user = await _user(db)

    async def fake_organic(keyword, loc, lang, depth=10, device="desktop", engine="google"):
        if engine == "bing":
            raise RuntimeError("bing down")
        return _serp_at(5, "www.nike.com", "https://nike.com/x")

    monkeypatch.setattr(serp_route.serp_api, "organic", fake_organic)
    resp = await serp_route.bulk_rank(
        BulkRankRequest(domain="nike.com", keywords=["k"], engines=["google", "bing"]),
        db=db, user=user,
    )
    assert resp.rows[0].ranks == {"google": 5}
    assert resp.rows[0].error is None


@pytest.mark.asyncio
async def test_duplicate_keywords_are_billed_once(db, monkeypatch):
    user = await _user(db)
    calls = []

    async def fake_organic(keyword, loc, lang, depth=10, device="desktop", engine="google"):
        calls.append(keyword)
        return _serp_at(1, "www.nike.com", "https://nike.com/x")

    monkeypatch.setattr(serp_route.serp_api, "organic", fake_organic)
    resp = await serp_route.bulk_rank(
        BulkRankRequest(domain="nike.com", keywords=["shoes", "Shoes", " shoes "]),
        db=db, user=user,
    )
    assert calls == ["shoes"], calls
    assert resp.checked == 1


@pytest.mark.asyncio
async def test_cost_is_the_sum_across_keywords_and_engines(db, monkeypatch):
    user = await _user(db)
    resp = await _bulk(
        db, user, monkeypatch,
        lambda k, e: _serp_at(1, "www.nike.com", "https://nike.com/x"),
        keywords=["a", "b"], engines=["google", "bing"],
    )
    # 4 lookups x 1.55c
    assert resp.meta.cost_cents == pytest.approx(6.2)
