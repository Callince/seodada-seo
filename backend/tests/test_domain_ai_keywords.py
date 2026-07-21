from __future__ import annotations

from app.integrations.dataforseo.ai_optimization import (
    _dedupe_key,
    parse_domain_ai_keywords,
)


def _item(q: str, vol: int, model: str = "google_ai_overview", sources: int = 0) -> dict:
    return {
        "question": q,
        "ai_search_volume": vol,
        "model_name": model,
        "answer": "x" * 900,
        "sources": [{"u": i} for i in range(sources)],
        "location_code": 2840,
    }


def test_collapses_the_duplicate_phrasings_seen_live():
    """The live sample wasted three of its top ten slots on one intent:
    "keyword research", "keyword keyword research" and "research keywords"."""
    for a, b in [
        ("keyword research", "keyword keyword research"),
        ("keyword research", "research keywords"),
        ("seo tool", "seo tools"),
    ]:
        assert _dedupe_key(a) == _dedupe_key(b), (a, b)


def test_does_not_collapse_genuinely_different_questions():
    """Over-merging would hide real keywords, which is worse than a duplicate."""
    for a, b in [
        ("keyword research", "keyword difficulty"),
        ("best seo tools", "worst seo tools"),
        ("googlebot search", "google search"),
    ]:
        assert _dedupe_key(a) != _dedupe_key(b), (a, b)


def test_keeps_the_highest_volume_phrasing_and_unions_platforms():
    rows = parse_domain_ai_keywords([{ "total_count": 15941, "items": [
        _item("research keywords", 301000, "chatgpt"),
        _item("keyword research", 368000, "google_ai_overview"),
    ]}])["rows"]
    assert len(rows) == 1
    assert rows[0]["question"] == "keyword research"      # the bigger number wins
    assert rows[0]["ai_search_volume"] == 368000
    # The prompt really did appear on both engines — losing that would understate
    # reach for the sake of deduping a phrasing.
    assert set(rows[0]["platforms"]) == {"chatgpt", "google_ai_overview"}


def test_sorted_by_volume_desc():
    rows = parse_domain_ai_keywords([{ "items": [
        _item("low", 10), _item("high", 900), _item("mid", 100),
    ]}])["rows"]
    assert [r["question"] for r in rows] == ["high", "mid", "low"]


def test_reports_upstream_total_not_just_what_was_returned():
    """"16 results" would misrepresent a domain with 15,941 matches."""
    d = parse_domain_ai_keywords([{ "total_count": 15941, "items": [_item("a", 1), _item("b", 2)] }])
    assert d["total_count"] == 15941
    assert d["returned"] == 2


def test_answer_is_trimmed_not_shipped_whole():
    """Answers are long-form markdown; 100 rows of them is megabytes."""
    rows = parse_domain_ai_keywords([{ "items": [_item("q", 1)] }])["rows"]
    assert len(rows[0]["answer_snippet"]) <= 400


def test_empty_and_malformed_payloads():
    assert parse_domain_ai_keywords([])["rows"] == []
    assert parse_domain_ai_keywords([{"items": []}])["rows"] == []
    # A row with no question must be dropped, not rendered blank.
    assert parse_domain_ai_keywords([{"items": [{"ai_search_volume": 5}]}])["rows"] == []
