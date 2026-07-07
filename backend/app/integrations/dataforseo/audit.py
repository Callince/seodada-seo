"""DataForSEO OnPage API — task-based full-site crawl (the "Site Audit").

Unlike the live endpoints, a crawl is asynchronous on DataForSEO's side:
  1. task_post  — start crawling up to N pages of a domain (billed per page)
  2. summary    — poll crawl progress; when finished it carries domain info,
                  the aggregate onpage_score, and per-check issue counts
  3. pages      — the crawled pages with their individual scores and checks

Issue severity tiers mirror the Ahrefs model: errors / warnings / notices.
"""
from __future__ import annotations

from typing import Any

from app.integrations.dataforseo.client import OK, DataForSEOError, _to_cents, dfs_client

PATH_TASK_POST = "/v3/on_page/task_post"
PATH_SUMMARY = "/v3/on_page/summary"
PATH_PAGES = "/v3/on_page/pages"


async def start_crawl(target: str, max_crawl_pages: int = 50) -> tuple[str, int]:
    """Start a crawl; returns (task_id, cost_cents)."""
    payload = [{
        "target": target,
        "max_crawl_pages": max_crawl_pages,
        "load_resources": False,
        "enable_javascript": False,
        "store_raw_html": False,
    }]
    data = await dfs_client._raw_post(PATH_TASK_POST, payload)  # noqa: SLF001
    if data.get("status_code") != OK:
        raise DataForSEOError(data.get("status_code", 0), data.get("status_message", "task_post failed"))
    task = (data.get("tasks") or [{}])[0]
    # 20100 = "Task Created" — the expected status for task_post.
    if task.get("status_code") not in (OK, 20100):
        raise DataForSEOError(task.get("status_code", 0), task.get("status_message", "task error"))
    task_id = task.get("id")
    if not task_id:
        raise DataForSEOError(0, "task_post returned no task id")
    return task_id, _to_cents(data.get("cost", task.get("cost", 0)))


async def summary(task_id: str) -> dict:
    res = await dfs_client.post(PATH_SUMMARY, {"id": task_id})
    return res.result[0] if res.result else {}


async def pages(task_id: str, limit: int = 100) -> list[dict]:
    res = await dfs_client.post(PATH_PAGES, {"id": task_id, "limit": limit, "order_by": ["onpage_score,asc"]})
    items = (res.result[0].get("items") if res.result else None) or []
    return items


# ------------------------------------------------------------- severity model

# Check names from OnPage `page_metrics.checks` grouped Ahrefs-style.
ERROR_CHECKS = {
    "is_4xx_code", "is_5xx_code", "is_broken", "no_title", "duplicate_title",
    "duplicate_content", "duplicate_description", "no_h1_tag", "canonical_to_broken",
    "canonical_to_redirect", "recursive_canonical", "is_redirect_loop", "no_doctype",
    "broken_links", "broken_resources", "is_link_relation_conflict",
}
WARNING_CHECKS = {
    "no_description", "title_too_long", "title_too_short", "low_content_rate",
    "small_page_size", "large_page_size", "low_character_count", "high_character_count",
    "low_readability_rate", "irrelevant_description", "irrelevant_title",
    "no_image_alt", "no_image_title", "seo_friendly_url", "seo_friendly_url_characters_check",
    "seo_friendly_url_dynamic_check", "seo_friendly_url_keywords_check",
    "seo_friendly_url_relative_length_check", "no_content_encoding", "high_loading_time",
    "is_http", "frame", "flash", "lorem_ipsum", "has_misspelling",
}
# Everything else observed in `checks` counts as a notice.

_LABELS = {
    "is_4xx_code": "Pages returning 4xx errors",
    "is_5xx_code": "Pages returning 5xx errors",
    "is_broken": "Broken pages",
    "no_title": "Missing title tag",
    "duplicate_title": "Duplicate title tags",
    "duplicate_description": "Duplicate meta descriptions",
    "duplicate_content": "Duplicate content",
    "no_h1_tag": "Missing H1 tag",
    "no_description": "Missing meta description",
    "title_too_long": "Title too long",
    "title_too_short": "Title too short",
    "low_content_rate": "Thin content",
    "no_image_alt": "Images missing alt text",
    "is_http": "Served over HTTP (not HTTPS)",
    "high_loading_time": "Slow-loading pages",
    "broken_links": "Pages with broken links",
    "broken_resources": "Pages with broken resources",
    "low_readability_rate": "Poor readability",
    "seo_friendly_url": "Non-SEO-friendly URLs",
    "canonical_to_broken": "Canonical points to broken page",
    "canonical_to_redirect": "Canonical points to redirect",
    "no_favicon": "Missing favicon",
    "no_doctype": "Missing doctype",
}


def label_for(check: str) -> str:
    return _LABELS.get(check, check.replace("_", " ").capitalize())


def severity_for(check: str) -> str:
    if check in ERROR_CHECKS:
        return "error"
    if check in WARNING_CHECKS:
        return "warning"
    return "notice"


def build_issues(checks: dict[str, Any]) -> list[dict]:
    """Turn the summary's per-check counters into a severity-sorted issue list."""
    order = {"error": 0, "warning": 1, "notice": 2}
    issues = [
        {"check": name, "label": label_for(name), "severity": severity_for(name), "count": int(count)}
        for name, count in (checks or {}).items()
        if isinstance(count, (int, float)) and count and int(count) > 0
    ]
    issues.sort(key=lambda i: (order[i["severity"]], -i["count"]))
    return issues


def parse_summary(raw: dict) -> dict:
    crawl_status = raw.get("crawl_status") or {}
    domain_info = raw.get("domain_info") or {}
    page_metrics = raw.get("page_metrics") or {}
    checks = page_metrics.get("checks") or {}
    issues = build_issues(checks)
    sev_totals = {"error": 0, "warning": 0, "notice": 0}
    for i in issues:
        sev_totals[i["severity"]] += i["count"]
    return {
        "progress": raw.get("crawl_progress") or "unknown",  # in_progress | finished
        "pages_crawled": crawl_status.get("pages_crawled"),
        "pages_in_queue": crawl_status.get("pages_in_queue"),
        "max_crawl_pages": crawl_status.get("max_crawl_pages"),
        "onpage_score": page_metrics.get("onpage_score"),
        "total_pages": domain_info.get("total_pages"),
        "ssl": domain_info.get("checks", {}).get("ssl"),
        "cms": domain_info.get("cms"),
        "server": domain_info.get("server"),
        "errors": sev_totals["error"],
        "warnings": sev_totals["warning"],
        "notices": sev_totals["notice"],
        "issues": issues,
    }


def parse_pages(items: list[dict]) -> list[dict]:
    rows = []
    for i in items:
        checks = i.get("checks") or {}
        failed = [label_for(c) for c, v in checks.items() if v is True and severity_for(c) != "notice"]
        meta = i.get("meta") or {}
        rows.append({
            "url": i.get("url"),
            "status_code": i.get("status_code"),
            "onpage_score": i.get("onpage_score"),
            "title": meta.get("title"),
            "word_count": (meta.get("content") or {}).get("plain_text_word_count"),
            "internal_links": meta.get("internal_links_count"),
            "external_links": meta.get("external_links_count"),
            "load_time_ms": (i.get("page_timing") or {}).get("duration_time"),
            "failed_checks": failed[:6],
        })
    return rows
