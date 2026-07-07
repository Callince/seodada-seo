"""AI Visibility — surface parsing + citation matching."""
from __future__ import annotations

from app.integrations.dataforseo import ai_visibility as aiv


def _serp(items):
    return [{"items": items}]


def test_parse_surface_extracts_references_and_strips_www():
    result = _serp([
        {"type": "organic", "rank_absolute": 1, "url": "https://x.com"},
        {"type": "ai_overview", "references": [
            {"domain": "www.komaki.in", "url": "https://komaki.in/scooters", "title": "Komaki", "source": "Komaki"},
            {"domain": "bikewale.com", "url": "https://bikewale.com/e", "title": "BikeWale", "source": "BikeWale"},
        ]},
    ])
    out = aiv.parse_surface(result)
    assert out["present"] is True
    assert [r["domain"] for r in out["references"]] == ["komaki.in", "bikewale.com"]


def test_parse_surface_absent_when_no_ai_overview():
    out = aiv.parse_surface(_serp([{"type": "organic", "url": "https://x.com"}]))
    assert out["present"] is False
    assert out["references"] == []


def test_parse_surface_empty_result():
    assert aiv.parse_surface([]) == {"present": False, "references": []}


def test_find_citation_hit_with_position():
    refs = [
        {"domain": "bikewale.com", "url": "https://bikewale.com/e"},
        {"domain": "komaki.in", "url": "https://komaki.in/scooters"},
    ]
    cit = aiv.find_citation(refs, "komaki.in")
    assert cit["cited"] is True
    assert cit["position"] == 2
    assert cit["url"] == "https://komaki.in/scooters"


def test_find_citation_matches_subdomain():
    refs = [{"domain": "blog.komaki.in", "url": "https://blog.komaki.in/p"}]
    assert aiv.find_citation(refs, "komaki.in")["cited"] is True


def test_find_citation_miss():
    refs = [{"domain": "bikewale.com", "url": "u"}]
    cit = aiv.find_citation(refs, "komaki.in")
    assert cit == {"cited": False, "url": None, "position": None}
