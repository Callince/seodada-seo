from __future__ import annotations

import json

import httpx
import pytest
import respx

from app.core.config import settings
from app.integrations.dataforseo import keywords as kw
from app.integrations.dataforseo import serp as serp_api
from app.integrations.free import brave, local_onpage
from app.integrations.free import trends as free_trends
from app.services import density, sentiment


@respx.mock
@pytest.mark.asyncio
async def test_brave_maps_to_serp_shape(monkeypatch):
    monkeypatch.setattr(settings, "brave_api_key", "test-key")
    respx.get("https://api.search.brave.com/res/v1/web/search").mock(
        return_value=httpx.Response(
            200,
            json={
                "web": {
                    "results": [
                        {
                            "title": "Nike Official",
                            "url": "https://www.nike.com/",
                            "description": "Shoes",
                            "meta_url": {"hostname": "www.nike.com"},
                        },
                        {
                            "title": "Adidas",
                            "url": "https://www.adidas.com/",
                            "description": "Sportswear",
                            "meta_url": {"hostname": "www.adidas.com"},
                        },
                    ]
                }
            },
        )
    )

    result = await brave.organic("running shoes", 2840, "en", 10)
    assert result.cost_cents == 0  # free provider is always $0

    rows = serp_api.parse_organic(result.result)  # existing DFS parser consumes it
    assert len(rows) == 2
    assert rows[0]["position"] == 1
    assert rows[0]["domain"] == "www.nike.com"
    # No People-Also-Ask on the free web endpoint.
    assert serp_api.parse_paa(result.result) == []


@respx.mock
@pytest.mark.asyncio
async def test_brave_requires_key(monkeypatch):
    monkeypatch.setattr(settings, "brave_api_key", "")
    with pytest.raises(brave.BraveError):
        await brave.organic("x", 2840, "en", 10)


@pytest.mark.asyncio
async def test_local_onpage_parses_and_scores(monkeypatch):
    html_doc = (
        "<html><head>"
        "<title>Best Running Shoes 2026 Reviews</title>"
        "<meta name='description' content='A complete guide to the best running "
        "shoes for road and trail runners in 2026, with hands-on reviews.'>"
        "</head><body><h1>Running Shoes</h1><p>"
        + ("running shoes are great for any runner. " * 80)
        + "</p></body></html>"
    )

    async def fake_fetch_html(url: str) -> str:
        return html_doc

    monkeypatch.setattr(density, "fetch_html", fake_fetch_html)

    result = await local_onpage.analyze("https://example.com/guide", "running shoes")
    assert result.cost_cents == 0
    page = result.result[0]
    assert page["title"] == "Best Running Shoes 2026 Reviews"
    assert "best running shoes for road" in (page["meta_description"] or "")
    assert page["h1"] == ["Running Shoes"]
    assert page["word_count"] > 300
    assert page["content_score"] is not None
    assert page["readability"]["flesch_kincaid"] is not None
    # Local keyword density picked up the target phrase.
    assert any(r["keyword"] == "running shoes" for r in page["keyword_density"])


@pytest.mark.asyncio
async def test_local_onpage_degrades_on_fetch_error(monkeypatch):
    async def boom(url: str) -> str:
        raise density.FetchError("blocked")

    monkeypatch.setattr(density, "fetch_html", boom)
    result = await local_onpage.analyze("https://example.com", None)
    assert result.cost_cents == 0
    assert result.result[0]["content_score"] is None
    assert result.result[0]["issues"]  # carries a friendly reason


def test_sentiment_corpus_classifies_and_cites():
    items = [
        {"title": "I love this amazing product", "description": "wonderful and great",
         "url": "https://a.com", "domain": "a.com"},
        {"title": "terrible awful experience", "description": "worst ever, I hate it",
         "url": "https://b.com", "domain": "b.com"},
        {"title": "product specifications", "description": "dimensions and weight",
         "url": "https://c.com", "domain": "c.com"},
    ]
    out = sentiment.analyze_corpus(items)
    assert out["total_count"] == 3
    assert out["sentiment"]["positive"] > 0
    assert out["sentiment"]["negative"] > 0
    assert len(out["citations"]) == 3
    # connotation fractions sum to ~1 when any emotion words are present
    # (each rounded to 3 dp, so allow small rounding slack).
    assert abs(sum(v for v in out["connotations"].values() if v) - 1.0) < 0.02


def test_sentiment_empty_corpus():
    out = sentiment.analyze_corpus([])
    assert out["total_count"] == 0
    assert out["sentiment"]["positive"] is None
    assert out["citations"] == []


@respx.mock
@pytest.mark.asyncio
async def test_google_trends_maps_to_trends_shape():
    prefix = ")]}',\n"
    explore = {"widgets": [{"id": "TIMESERIES", "token": "TOK", "request": {"x": 1}}]}
    multiline = {
        "default": {
            "timelineData": [
                {"time": "1700000000", "value": [50]},
                {"time": "1700086400", "value": [75]},
            ]
        }
    }
    respx.get("https://trends.google.com/trends/").mock(
        return_value=httpx.Response(200, text="ok")
    )
    respx.get("https://trends.google.com/trends/api/explore").mock(
        return_value=httpx.Response(200, text=prefix + json.dumps(explore))
    )
    respx.get("https://trends.google.com/trends/api/widgetdata/multiline").mock(
        return_value=httpx.Response(200, text=prefix + json.dumps(multiline))
    )

    result = await free_trends.google_trends(["bitcoin"], 2840, "en", "past_12_months")
    assert result.cost_cents == 0
    parsed = kw.parse_trends(result.result)  # existing DFS parser consumes it
    assert len(parsed["graph"]) == 2
    assert parsed["graph"][0]["values"] == [50]


@respx.mock
@pytest.mark.asyncio
async def test_google_trends_raises_when_google_is_unavailable(monkeypatch):
    """Contract CHANGED — this test previously asserted that any failure
    degrades to an empty graph, which was right while the provider was opt-in
    and wrong once it became the default.

    Google throttles this endpoint (429) intermittently, so "empty" made a
    rate-limited request indistinguishable from a keyword nobody searches: the
    chart rendered a confident absence that was really our own failed call.
    It now raises after exhausting retries, and the endpoint falls back to
    DataForSEO — slower and paid, but never a fabricated flat line.
    """
    monkeypatch.setattr(free_trends, "_BACKOFF_S", 0)
    respx.get("https://trends.google.com/trends/").mock(
        return_value=httpx.Response(200, text="ok")
    )
    respx.get("https://trends.google.com/trends/api/explore").mock(
        return_value=httpx.Response(500)
    )
    with pytest.raises(free_trends.TrendsUnavailable):
        await free_trends.google_trends(["bitcoin"], 2840, "en", "past_12_months")


@respx.mock
@pytest.mark.asyncio
async def test_google_trends_still_empty_when_google_reports_no_data():
    """The other half of the distinction: Google answering normally with no
    timeseries widget is a genuine 'no interest for this term'. That must stay
    an empty graph and must NOT trigger a paid fallback."""
    respx.get("https://trends.google.com/trends/").mock(
        return_value=httpx.Response(200, text="ok")
    )
    respx.get("https://trends.google.com/trends/api/explore").mock(
        return_value=httpx.Response(200, text=")]}',\n" + '{"widgets": []}')
    )
    result = await free_trends.google_trends(["bitcoin"], 2840, "en", "past_12_months")
    assert result.cost_cents == 0
    assert kw.parse_trends(result.result)["graph"] == []
