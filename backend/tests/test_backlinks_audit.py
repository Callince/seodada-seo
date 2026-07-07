from __future__ import annotations

from app.integrations.dataforseo import audit, backlinks


# ---------------------------------------------------------------- backlinks

def test_authority_maps_rank_to_0_100():
    assert backlinks.authority_from_rank(None) is None
    assert backlinks.authority_from_rank(0) == 0
    assert backlinks.authority_from_rank(473) == 47
    assert backlinks.authority_from_rank(1000) == 100
    assert backlinks.authority_from_rank(2000) == 100  # clamped


def test_parse_summary_extracts_authority_and_dofollow_split():
    result = [{
        "rank": 312, "backlinks": 1000, "referring_domains": 240,
        "referring_main_domains": 200, "broken_backlinks": 12, "referring_ips": 180,
        "first_seen": "2019-04-01 00:00:00 +00:00",
        "referring_links_attributes": {"nofollow": 300},
    }]
    s = backlinks.parse_summary(result)
    assert s["authority"] == 31
    assert s["dofollow"] == 700 and s["nofollow"] == 300
    assert s["referring_domains"] == 240


def test_parse_backlinks_rows():
    result = [{"items": [
        {"type": "backlink", "domain_from": "blog.example.com", "url_from": "https://blog.example.com/a",
         "url_to": "https://target.com/", "anchor": "great tool", "dofollow": True,
         "domain_from_rank": 540, "page_from_rank": 120,
         "first_seen": "2024-01-01", "last_seen": "2026-05-01"},
    ]}]
    rows = backlinks.parse_backlinks(result)
    assert rows[0]["domain_from"] == "blog.example.com"
    assert rows[0]["dofollow"] is True


def test_clean_target_strips_scheme_and_www():
    assert backlinks._clean("https://www.Example.com/") == "example.com"


# ---------------------------------------------------------------- site audit

def test_severity_tiers():
    assert audit.severity_for("no_title") == "error"
    assert audit.severity_for("no_description") == "warning"
    assert audit.severity_for("has_render_blocking_resources") == "notice"


def test_build_issues_sorted_by_severity_then_count():
    checks = {"no_description": 8, "no_title": 2, "no_favicon": 1, "duplicate_title": 5, "zero_count": 0}
    issues = audit.build_issues(checks)
    assert [i["check"] for i in issues[:2]] == ["duplicate_title", "no_title"]  # errors first, by count
    assert issues[2]["check"] == "no_description"  # then warnings
    assert all(i["count"] > 0 for i in issues)  # zero-count checks dropped


def test_parse_summary_progress_and_totals():
    raw = {
        "crawl_progress": "finished",
        "crawl_status": {"pages_crawled": 50, "pages_in_queue": 0, "max_crawl_pages": 50},
        "domain_info": {"total_pages": 120, "cms": "wordpress", "server": "nginx", "checks": {"ssl": True}},
        "page_metrics": {"onpage_score": 87.4, "checks": {"no_title": 2, "no_description": 8, "no_favicon": 1}},
    }
    s = audit.parse_summary(raw)
    assert s["progress"] == "finished" and s["onpage_score"] == 87.4
    assert s["errors"] == 2 and s["warnings"] == 8 and s["notices"] == 1
    assert s["ssl"] is True and s["cms"] == "wordpress"


def test_parse_pages_extracts_failed_checks():
    items = [{
        "url": "https://x.com/a", "status_code": 200, "onpage_score": 61.2,
        "meta": {"title": "A", "content": {"plain_text_word_count": 180},
                 "internal_links_count": 4, "external_links_count": 2},
        "page_timing": {"duration_time": 1234},
        "checks": {"no_description": True, "no_title": False, "no_favicon": True, "low_content_rate": True},
    }]
    rows = audit.parse_pages(items)
    assert rows[0]["word_count"] == 180
    # notice-tier checks (favicon) excluded from the failed list
    assert "Missing meta description" in rows[0]["failed_checks"]
    assert "Missing favicon" not in rows[0]["failed_checks"]
    assert "Thin content" in rows[0]["failed_checks"]
