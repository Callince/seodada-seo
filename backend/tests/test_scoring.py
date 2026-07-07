from __future__ import annotations

from app.services import density, scoring


def _signals(**kw) -> scoring.PageSignals:
    base = dict(
        url="https://example.com/best-running-shoes",
        title="Best Running Shoes 2026 Reviews and Buying Guide",
        meta_description=(
            "A complete guide to the best running shoes for road and trail "
            "runners in 2026 with hands-on expert reviews."
        ),
        h1=["Best Running Shoes"],
        h2=["Road shoes", "Trail shoes"],
        word_count=1200,
        readability_fk=8.0,
        target_keyword="running shoes",
        keyword_frequency=18,
        keyword_density=1.5,
        intro_text="best running shoes for road and trail runners",
    )
    base.update(kw)
    return scoring.PageSignals(**base)


def test_well_optimized_page_scores_high():
    ev = scoring.evaluate(_signals())
    assert ev["score"] >= 85
    assert {s["label"] for s in ev["subscores"]} == {
        "Title", "Meta description", "Headings", "Content depth",
        "Readability", "Keyword optimization",
    }
    assert ev["keyword_analysis"]["health"] == "optimal"
    assert ev["keyword_analysis"]["placement_count"] == 5


def test_missing_essentials_drops_score_and_flags_issues():
    ev = scoring.evaluate(
        _signals(title=None, meta_description=None, h1=[], h2=[], word_count=120,
                 target_keyword="running shoes", keyword_frequency=0, keyword_density=0.0,
                 intro_text="")
    )
    assert ev["score"] < 45
    assert "missing title tag" in ev["issues"]
    assert "missing meta description" in ev["issues"]
    assert "missing h1 heading" in ev["issues"]
    assert any("thin content" in i for i in ev["issues"])
    assert any("target keyword" in r.lower() for r in ev["recommendations"])


def test_keyword_stuffing_is_penalized():
    ev = scoring.evaluate(_signals(keyword_density=6.0))
    assert ev["keyword_analysis"]["health"] == "stuffed"
    assert any("stuffing" in i for i in ev["issues"])


def test_no_target_keyword_is_neutral_not_punished():
    ev = scoring.evaluate(_signals(target_keyword=None, keyword_frequency=0, keyword_density=0.0))
    assert ev["keyword_analysis"] is None
    kw_sub = next(s for s in ev["subscores"] if s["label"] == "Keyword optimization")
    assert kw_sub["status"] == "n/a"
    # A solid page without a target keyword should still score well.
    assert ev["score"] >= 75


def test_density_extracts_multiword_phrases():
    text = ("Running shoes review. " + "the best running shoes for trail running help every runner. " * 30)
    rows = density.density(text, "running shoes")
    assert rows[0]["keyword"] == "running shoes"  # target keyword first
    phrases = [r["keyword"] for r in rows if " " in r["keyword"]]
    assert phrases, "expected at least one multi-word phrase"
