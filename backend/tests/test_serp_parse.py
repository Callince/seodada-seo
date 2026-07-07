"""SERP parser accuracy: organic rank numbering, featured snippets, dedupe."""
from __future__ import annotations

from app.integrations.dataforseo.serp import parse_organic


def _serp(items: list[dict]) -> list[dict]:
    return [{"items": items}]


def test_positions_are_gapless_organic_ranks():
    # AI overview / ads occupy absolute slots 1-2; organic listings sit at 3,5,8.
    rows = parse_organic(_serp([
        {"type": "ai_overview", "rank_absolute": 1},
        {"type": "paid", "rank_absolute": 2},
        {"type": "organic", "rank_absolute": 3, "title": "A", "url": "https://a.com/", "domain": "a.com"},
        {"type": "people_also_ask", "rank_absolute": 4},
        {"type": "organic", "rank_absolute": 5, "title": "B", "url": "https://b.com/", "domain": "b.com"},
        {"type": "organic", "rank_absolute": 8, "title": "C", "url": "https://c.com/", "domain": "c.com"},
    ]))
    assert [r["position"] for r in rows] == [1, 2, 3]
    assert [r["serp_slot"] for r in rows] == [3, 5, 8]
    assert all(not r["featured"] for r in rows)


def test_featured_snippet_counts_as_number_one():
    rows = parse_organic(_serp([
        {"type": "featured_snippet", "rank_absolute": 1, "title": "FS", "url": "https://fs.com/page", "domain": "fs.com"},
        {"type": "organic", "rank_absolute": 2, "title": "A", "url": "https://a.com/", "domain": "a.com"},
    ]))
    assert rows[0]["position"] == 1 and rows[0]["featured"] is True
    assert rows[1]["position"] == 2 and rows[1]["featured"] is False


def test_featured_snippet_source_not_double_counted():
    # The snippet's page also appears as a plain organic listing → count once.
    rows = parse_organic(_serp([
        {"type": "featured_snippet", "rank_absolute": 1, "title": "FS", "url": "https://a.com/p", "domain": "a.com"},
        {"type": "organic", "rank_absolute": 2, "title": "A", "url": "https://a.com/p", "domain": "a.com"},
        {"type": "organic", "rank_absolute": 3, "title": "B", "url": "https://b.com/", "domain": "b.com"},
    ]))
    assert len(rows) == 2
    assert rows[0]["url"] == "https://a.com/p" and rows[0]["position"] == 1
    assert rows[1]["domain"] == "b.com" and rows[1]["position"] == 2


def test_empty_result():
    assert parse_organic([]) == []
    assert parse_organic(_serp([])) == []
