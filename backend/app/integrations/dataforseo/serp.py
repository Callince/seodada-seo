"""SERP API wrappers + parsers."""
from __future__ import annotations

from typing import Any

from app.integrations.dataforseo.client import DfsResult, dfs_client

PATH_ORGANIC = "/v3/serp/google/organic/live/advanced"

# Search engines DataForSEO serves organic results for, verified live: all take
# the identical payload (device, depth and non-US location_code included) and
# `parse_organic` consumes every one of them unchanged.
#
# Google and Bing both bill 0.200c at depth 10; Yahoo bills 0.350c. Brave and
# DuckDuckGo are NOT here — DataForSEO answers "40402 Invalid Path" for both.
# Brave had its own API integration until it stopped being free; it was removed
# rather than kept at 2.5x the DataForSEO price. See docs/PROVIDER_STRATEGY.md.
#
# Only Google carries SERP features: it returned ai_overview, people_also_ask,
# video and related_searches alongside the organic block, where Bing returned
# organic and nothing else. An empty PAA panel on Bing is correct, not a bug.
ENGINE_PATHS = {
    "google": PATH_ORGANIC,
    "bing": "/v3/serp/bing/organic/live/advanced",
    "yahoo": "/v3/serp/yahoo/organic/live/advanced",
}


def build_payload(
    keyword: str, location_code: int, language_code: str, depth: int = 10,
    device: str = "desktop",
) -> dict:
    return {
        "keyword": keyword,
        "location_code": location_code,
        "language_code": language_code,
        "depth": depth,
        "device": device,
    }


async def organic(
    keyword: str, location_code: int, language_code: str, depth: int = 10,
    device: str = "desktop", engine: str = "google",
) -> DfsResult:
    return await dfs_client.post(
        ENGINE_PATHS[engine],
        build_payload(keyword, location_code, language_code, depth, device),
    )


def parse_organic(result: list[dict[str, Any]]) -> list[dict]:
    """Extract Top-N organic results from a SERP advanced result.

    `position` is the *organic rank* (1..N, gapless) — the number every SEO tool
    reports and what users count in a results page. A featured snippet is the
    true #1, so it participates in the numbering. `serp_slot` keeps the raw
    absolute slot among all SERP elements (ads, PAA, packs, ...) for context.
    """
    if not result:
        return []
    items = result[0].get("items") or []
    picked = [it for it in items if it.get("type") in ("organic", "featured_snippet")]
    picked.sort(key=lambda it: it.get("rank_absolute") or 1_000_000)
    out: list[dict] = []
    seen_urls: set[str] = set()
    for it in picked:
        url = it.get("url") or ""
        # The featured-snippet source sometimes repeats as a plain organic
        # listing — count the page once, at its best slot.
        if url and url in seen_urls:
            continue
        seen_urls.add(url)
        out.append(
            {
                "position": len(out) + 1,
                "serp_slot": it.get("rank_absolute"),
                "featured": it.get("type") == "featured_snippet",
                "title": it.get("title") or "",
                "description": it.get("description"),
                "url": url,
                "domain": it.get("domain") or "",
            }
        )
    return out


def _paa_answer(expanded: list[dict[str, Any]] | None) -> tuple[str | None, str | None]:
    """Best-effort (answer, source_url) from a PAA `expanded_element` list.

    Google/DataForSEO return two shapes:
      * classic  -> the element carries `description` + `url` directly.
      * ai_overview -> the answer text lives in nested `items[].text/description`
        and the source in `references[].url`. These are often delivered
        asynchronously, so the content can legitimately be empty.
    """
    for el in expanded or []:
        # Classic expanded element.
        desc = el.get("description")
        url = el.get("url")
        if desc or url:
            return desc, url
        # AI-overview expanded element: stitch text from nested items.
        parts = [
            sub.get("text") or sub.get("description")
            for sub in (el.get("items") or [])
            if sub.get("text") or sub.get("description")
        ]
        refs = el.get("references") or []
        ref_url = refs[0].get("url") if refs else None
        if parts:
            return " ".join(parts).strip(), ref_url or url
    return None, None


def parse_paa(result: list[dict[str, Any]]) -> list[dict]:
    """Extract People-Also-Ask questions and their first answer snippet."""
    if not result:
        return []
    items = result[0].get("items") or []
    out: list[dict] = []
    for it in items:
        if it.get("type") != "people_also_ask":
            continue
        for q in it.get("items") or []:
            question = q.get("title") or q.get("seed_question") or ""
            answer, url = _paa_answer(q.get("expanded_element"))
            out.append({"question": question, "answer": answer, "url": url})
    return out
