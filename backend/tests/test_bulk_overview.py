from __future__ import annotations

from app.integrations.dataforseo.labs import parse_keywords_overview


def _item(kw: str, *, competition=None, intent=None, volume=None, difficulty=None) -> dict:
    return {
        "keyword": kw,
        "keyword_info": {
            "search_volume": volume,
            "cpc": 1.5,
            "competition": competition,
            "competition_level": "HIGH" if (competition or 0) > 0.66 else "LOW",
        },
        "keyword_properties": {"keyword_difficulty": difficulty},
        "search_intent_info": {"main_intent": intent},
    }


def test_competition_is_rescaled_to_the_0_100_the_table_renders():
    """The two sources disagree on scale and the column renders "{n}/100":
    google_ads exposes competition_index 0-100, Labs exposes competition 0-1.
    Verified live on the same keywords — Labs 0.06 == google_ads index 6 — so
    without this the column would read "0/100" for everything."""
    rows = parse_keywords_overview([{"items": [
        _item("marathon training plan", competition=0.06),
        _item("running shoes", competition=1),
    ]}])
    assert [r["competition"] for r in rows] == [6, 100]


def test_intent_and_difficulty_are_carried_through():
    """The whole point of moving off google_ads/search_volume: it has no field
    for either."""
    rows = parse_keywords_overview([{"items": [
        _item("running shoes", intent="transactional", volume=368000, difficulty=46),
    ]}])
    assert rows[0]["intent"] == "transactional"
    assert rows[0]["keyword_difficulty"] == 46
    assert rows[0]["search_volume"] == 368000


def test_missing_fields_stay_none_rather_than_becoming_zero():
    """A keyword with no competition data must render "—", not a confident 0."""
    rows = parse_keywords_overview([{"items": [_item("obscure term")]}])
    assert rows[0]["competition"] is None
    assert rows[0]["intent"] is None
    assert rows[0]["keyword_difficulty"] is None


def test_empty_result_is_empty_list():
    assert parse_keywords_overview([]) == []
    assert parse_keywords_overview([{"items": []}]) == []
