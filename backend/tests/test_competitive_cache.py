from __future__ import annotations

import pytest

from app.db.models import Organization, User
from app.integrations.dataforseo.client import DfsResult
from app.services import competitive, density


async def _seed_user(db) -> User:
    org = Organization(name="Acme", monthly_quota_cents=5000)
    db.add(org)
    await db.flush()
    user = User(email="seo@acme.test", hashed_password="x", org_id=org.id, role="owner")
    db.add(user)
    await db.commit()
    return user


@pytest.mark.asyncio
async def test_benchmark_corpus_is_cached(db, monkeypatch):
    """Repeat benchmarks for the same keyword must reuse the cached corpus —
    no second SERP call, no re-fetching competitor pages."""
    user = await _seed_user(db)
    urls = ["https://c1.com/p", "https://c2.com/p", "https://c3.com/p"]

    serp_calls = {"n": 0}
    fetch_calls = {"n": 0}

    async def fake_organic(*args, **kwargs):
        serp_calls["n"] += 1
        items = [
            {"type": "organic", "rank_absolute": i + 1, "title": "t", "description": "d",
             "url": u, "domain": u.split("/")[2]}
            for i, u in enumerate(urls)
        ]
        return DfsResult(result=[{"items": items}], cost_cents=2)

    async def fake_fetch(url: str) -> str:
        fetch_calls["n"] += 1
        return "<html><body><h1>x</h1>" + ("trail marathon shoes running guide. " * 40) + "</body></html>"

    monkeypatch.setattr(competitive.serp_api, "organic", fake_organic)
    monkeypatch.setattr(density, "fetch_html", fake_fetch)

    args = (db, user, "running shoes", 2840, "en")
    first = await competitive.benchmark(*args, page_terms={"running": 5}, page_word_count=300, page_heading_count=2)
    assert first["competitors_analyzed"] == 3
    assert serp_calls["n"] == 1
    assert fetch_calls["n"] == 3  # three competitor pages fetched once

    # Second call (e.g. analyzing a different URL for the same keyword) → cached.
    second = await competitive.benchmark(*args, page_terms={"running": 9}, page_word_count=900, page_heading_count=5)
    assert serp_calls["n"] == 1   # no new SERP call
    assert fetch_calls["n"] == 3  # no new page fetches
    # Page-specific comparison still reflects the new page's numbers.
    assert second["word_count"]["you"] == 900
    assert second["headings"]["you"] == 5
