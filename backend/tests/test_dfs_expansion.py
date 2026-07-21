"""Parsers for the DataForSEO expansion (backlinks history/gap, labs overview,
domain meta, lighthouse, AI optimization, local listings). Shapes mirror real
API responses captured during integration."""
from __future__ import annotations

from app.integrations.dataforseo import (
    ai_optimization as aio,
    backlinks as bl,
    content,
    domain_meta,
    labs,
    local,
    onpage,
)

# ---------------------------------------------------------------- backlinks


def test_parse_timeseries_maps_authority():
    res = [{"items": [{"date": "2025-07-31 00:00:00 +00:00", "rank": 243, "backlinks": 1401, "referring_domains": 620}]}]
    rows = bl.parse_timeseries(res)
    assert rows == [
        {"date": "2025-07-31", "rank": 243, "authority": 24, "backlinks": 1401, "referring_domains": 620}
    ]


def test_parse_new_lost():
    res = [{"items": [{"date": "2025-07-31", "new_backlinks": 82, "lost_backlinks": 80, "new_referring_domains": 51, "lost_referring_domains": 17}]}]
    assert bl.parse_new_lost(res)[0]["new_backlinks"] == 82


def test_parse_competitors_keeps_raw_rank():
    res = [{"items": [{"target": "indiamart.com", "rank": 30, "intersections": 4374}]}]
    rows = bl.parse_competitors(res)
    assert rows[0] == {"domain": "indiamart.com", "rank": 30, "intersections": 4374}


def test_parse_spam_score():
    assert bl.parse_spam_score([{"items": [{"spam_score": 14}]}]) == 14
    assert bl.parse_spam_score([{"items": []}]) is None


def test_parse_link_gap_flattens_domain_intersection():
    res = [{"items": [
        {"domain_intersection": {
            "1": {"target": "theaibull.com", "rank": 228, "backlinks": 314},
            "2": {"target": "theaibull.com", "rank": 228, "backlinks": 12},
        }},
        {"domain_intersection": {}},  # dropped
    ]}]
    rows = bl.parse_link_gap(res)
    assert len(rows) == 1
    assert rows[0]["domain"] == "theaibull.com"
    assert rows[0]["links_to_competitors"] == 326
    assert rows[0]["competitors_linked"] == 2
    assert rows[0]["authority"] == 23


# ---------------------------------------------------------------- labs


def test_parse_keyword_overview():
    res = [{"items": [{
        "keyword": "electric scooter",
        "keyword_info": {"search_volume": 450000, "cpc": 0.03, "competition": 0.27,
                         "monthly_searches": [{"year": 2026, "month": 5, "search_volume": 823000}]},
        "keyword_properties": {"keyword_difficulty": 42},
        "search_intent_info": {"main_intent": "transactional"},
    }]}]
    o = labs.parse_keyword_overview(res)
    assert o["difficulty"] == 42 and o["intent"] == "transactional"
    assert o["monthly_searches"][0]["volume"] == 823000


def test_parse_historical_rank_top3_sums_buckets():
    res = [{"items": [{"year": 2026, "month": 6, "metrics": {"organic": {"count": 2203, "etv": 1.5, "pos_1": 100, "pos_2_3": 59}}}]}]
    row = labs.parse_historical_rank(res)[0]
    assert row["keywords"] == 2203 and row["top3"] == 159


# ---------------------------------------------------------------- domain meta


def test_parse_technologies_result0_is_item():
    res = [{
        "domain": "www.example.com", "title": "T", "country_iso_code": "IN",
        "language_code": "en", "last_visited": "2026-06-15 00:00:00 +00:00",
        "emails": ["a@b.com"], "phone_numbers": [],
        "technologies": {"cms": {"content_management": ["WordPress"]}},
    }]
    p = domain_meta.parse_technologies(res)
    assert p["rows"] == [{"group": "cms", "category": "content_management", "name": "WordPress"}]
    assert p["last_visited"] == "2026-06-15"


def test_parse_whois():
    res = [{"items": [{"domain": "x.in", "created_datetime": "2019-02-25 05:57:24 +00:00", "registrar": "GoDaddy.com, LLC"}]}]
    w = domain_meta.parse_whois(res)
    assert w["created"] == "2019-02-25" and w["registrar"] == "GoDaddy.com, LLC"


# ---------------------------------------------------------------- lighthouse


def test_parse_lighthouse_scores_and_vitals():
    res = [{
        "categories": {"performance": {"score": 0.75}, "seo": {"score": 0.4}},
        "audits": {"largest-contentful-paint": {"displayValue": "2.9 s", "numericValue": 2907.1, "score": 0.8}},
        "finalUrl": "https://x.in/",
    }]
    p = onpage.parse_lighthouse(res)
    assert p["categories"] == {"performance": 75, "seo": 40}
    assert p["vitals"]["lcp"]["score"] == 80


# ---------------------------------------------------------------- AI optimization


def test_parse_target_metrics_sums_location_dimension():
    res = [{"aggregated_metrics": {"location": [
        {"key": 2356, "mentions": 627, "ai_search_volume": 1294880},
        {"key": 2840, "mentions": 98, "ai_search_volume": 14960},
    ]}}]
    p = aio.parse_target_metrics(res)
    assert p["mentions"] == 725 and p["ai_search_volume"] == 1309840
    assert p["dimensions"]["location"][0]["key"] == 2356


def test_parse_target_metrics_prefers_total_and_keeps_all_dimensions():
    res = [{"aggregated_metrics": {
        "total": [{"key": None, "mentions": 790, "ai_search_volume": 1996770}],
        "location": [{"key": 2356, "mentions": 661, "ai_search_volume": 1916470}],
        "platform": [
            {"key": "google", "mentions": 769, "ai_search_volume": 1996540},
            {"key": "chat_gpt", "mentions": 22, "ai_search_volume": 300},
        ],
        "sources_domain": [{"key": "www.bikedekho.com", "mentions": 414, "ai_search_volume": 674340}],
    }}]
    p = aio.parse_target_metrics(res)
    assert p["mentions"] == 790 and p["ai_search_volume"] == 1996770
    assert "total" not in p["dimensions"]
    assert p["dimensions"]["platform"][0]["key"] == "google"
    assert p["dimensions"]["sources_domain"][0]["mentions"] == 414


def test_parse_llm_response_joins_sections():
    res = [{"model_name": "gpt-4o-mini-2024-07-18", "input_tokens": 21, "output_tokens": 5,
            "items": [{"type": "message", "sections": [{"type": "text", "text": "Blue and yellow."}]}]}]
    p = aio.parse_llm_response(res)
    assert p["answer"] == "Blue and yellow." and p["model"].startswith("gpt-4o-mini")


def test_parse_ai_keyword_volume():
    res = [{"items": [{"keyword": "x", "ai_search_volume": 6474,
                       "ai_monthly_searches": [{"year": 2026, "month": 6, "ai_search_volume": 6474}]}]}]
    rows = aio.parse_ai_keyword_volume(res)
    assert rows[0]["ai_search_volume"] == 6474 and rows[0]["monthly"][0]["volume"] == 6474


# ---------------------------------------------------------------- content + local


def test_parse_sentiment_handles_empty():
    assert content.parse_sentiment([{"items": []}]) == {"total_citations": None, "connotations": {}, "types": {}}
    assert content.parse_sentiment([]) == {"total_citations": None, "connotations": {}, "types": {}}


def test_parse_sentiment_aggregates_polarity_distribution():
    """Real live shape: one block with a per-polarity summary under
    `positive_connotation_distribution` (no `items` wrapper)."""
    res = [{
        "type": "content_analysis_sentiment_analysis",
        "positive_connotation_distribution": {
            "positive": {"total_count": 100, "sentiment_connotations": {"happiness": 30, "love": 5}},
            "negative": {"total_count": 40, "sentiment_connotations": {"anger": 12, "sadness": 3}},
            "neutral": {"total_count": 60, "sentiment_connotations": {"happiness": 1}},
        },
    }]
    out = content.parse_sentiment(res)
    assert out["total_citations"] == 200
    assert out["types"] == {"positive": 100, "negative": 40, "neutral": 60}
    assert out["connotations"]["happiness"] == 31
    assert out["connotations"]["anger"] == 12


def test_parse_phrase_trends_reads_top_level_rows():
    """Real live shape: one `content_analysis_trends` block per period,
    directly in `result`."""
    res = [
        {"type": "content_analysis_trends", "date": "2026-06-01", "total_count": 38392},
        {"type": "content_analysis_trends", "date": "2026-07-01", "total_count": 40100},
    ]
    rows = content.parse_phrase_trends(res)
    assert rows == [
        {"date": "2026-06-01", "citations": 38392},
        {"date": "2026-07-01", "citations": 40100},
    ]
    assert content.parse_phrase_trends([]) == []


def test_parse_listings():
    res = [{"items": [{"title": "Shop", "category": "Dealer", "rating": {"value": 4.5, "votes_count": 120},
                       "address": "A", "url": "https://s.in", "domain": "s.in", "is_claimed": True}]}]
    rows = local.parse_listings(res)
    assert rows[0]["rating"] == 4.5 and rows[0]["reviews"] == 120 and rows[0]["is_claimed"] is True
