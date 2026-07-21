"""AI Optimization API — LLM mentions (GEO/AEO), AI keyword volume, live LLM
responses. Covered by the account's LLM-mentions subscription."""
from __future__ import annotations

import re
from typing import Any

from app.integrations.dataforseo.client import DfsResult, dfs_client

PATH_MENTIONS_METRICS = "/v3/ai_optimization/llm_mentions/target_metrics/live"
PATH_AI_VOLUME = "/v3/ai_optimization/ai_keyword_data/keywords_search_volume/live"
# LLM responses are namespaced per provider; ChatGPT is the stable one.
PATH_LLM_RESPONSE = "/v3/ai_optimization/chat_gpt/llm_responses/live"


async def target_metrics(domain: str) -> DfsResult:
    # `target` must be an array of {"domain": …} (or {"keyword": …}) objects.
    return await dfs_client.post(PATH_MENTIONS_METRICS, {"target": [{"domain": domain}]})


def parse_target_metrics(result: list[dict[str, Any]]) -> dict:
    """result[0] = {total_count, items, aggregated_metrics: {dimension:
    [{key, mentions, ai_search_volume}, …]}}. Totals + per-dimension breakdowns.
    Dimensions include location, language, platform (google/chat_gpt/…) and
    sources_domain (what LLMs cite when mentioning the target)."""
    res = result[0] if result else {}
    agg = res.get("aggregated_metrics") or {}
    dimensions: dict[str, list[dict]] = {}
    total_mentions = 0
    total_volume = 0
    for dim, rows in agg.items():
        if not isinstance(rows, list):
            continue
        parsed = [
            {
                "key": r.get("key"),
                "mentions": int(r.get("mentions") or 0),
                "ai_search_volume": int(r.get("ai_search_volume") or 0),
            }
            for r in rows
            if isinstance(r, dict)
        ]
        if dim == "total":  # the API's own grand total — don't ship as a table
            if parsed:
                total_mentions = parsed[0]["mentions"]
                total_volume = parsed[0]["ai_search_volume"]
            continue
        dimensions[dim] = parsed[:20]
    if not total_mentions:  # older responses without a total block
        total_mentions = sum(p["mentions"] for p in dimensions.get("location", []))
        total_volume = sum(p["ai_search_volume"] for p in dimensions.get("location", []))
    return {
        "mentions": total_mentions,
        "ai_search_volume": total_volume,
        "dimensions": dimensions,
    }


async def ai_keyword_volume(
    keywords: list[str],
    location_name: str = "United States",
    language_name: str = "English",
) -> DfsResult:
    payload = {
        "keywords": keywords[:20],
        "location_name": location_name,
        "language_name": language_name,
    }
    return await dfs_client.post(PATH_AI_VOLUME, payload)


def parse_ai_keyword_volume(result: list[dict[str, Any]]) -> list[dict]:
    items = (result[0].get("items") if result else None) or []
    return [
        {
            "keyword": it.get("keyword"),
            "ai_search_volume": it.get("ai_search_volume"),
            "monthly": [
                {"year": m.get("year"), "month": m.get("month"), "volume": m.get("ai_search_volume")}
                for m in (it.get("ai_monthly_searches") or [])
            ],
        }
        for it in items
    ]


async def llm_response(prompt: str, model_name: str = "gpt-4o-mini") -> DfsResult:
    payload = {"user_prompt": prompt[:500], "model_name": model_name, "max_output_tokens": 500}
    return await dfs_client.post(PATH_LLM_RESPONSE, payload)


def parse_llm_response(result: list[dict[str, Any]]) -> dict:
    """result[0] = {model_name, input/output_tokens, items: [{type: "message",
    sections: [{text}]}]}."""
    res = result[0] if result else {}
    items = res.get("items") or []
    parts: list[str] = []
    for it in items:
        for s in it.get("sections") or []:
            if isinstance(s, dict) and s.get("text"):
                parts.append(s["text"])
    return {
        "model": res.get("model_name"),
        "answer": "\n".join(parts),
        "input_tokens": res.get("input_tokens"),
        "output_tokens": res.get("output_tokens"),
    }


PATH_MENTION_SEARCH = "/v3/ai_optimization/llm_mentions/search/live"


async def domain_ai_keywords(domain: str, limit: int = 100) -> DfsResult:
    """The questions people ask AI engines that surface this domain.

    The reverse of /ai-visibility/check: that one tests keywords you already
    suspect, this one discovers the ones you would never have guessed. Verified
    live against ahrefs.com — 15,938 matching questions, including "9xmovies
    into" and "digitalconnectmag com", which no amount of brainstorming would
    have produced.

    `target` is a list of OBJECTS, not strings: the API rejects
    ["ahrefs.com"] with "Each 'target' item must be an object".
    """
    return await dfs_client.post(
        PATH_MENTION_SEARCH,
        {"target": [{"domain": domain}], "limit": min(max(limit, 1), 100)},
    )


# Questions differing only by word order, filler or a plural come back as
# separate rows — the live sample had "keyword research", "keyword keyword
# research" AND "research keywords", all the same intent, eating three of the
# top ten slots. Collapsing on a sorted word-SET handles order and repetition;
# the naive plural strip handles the rest.
#
# Deliberately crude: proper stemming would need a dependency for a cosmetic
# gain, and merging "seo tool"/"seo tools" is right anyway. The 4-char floor
# stops it mangling short words ("ads" -> "ad" is fine, "is" -> "i" is not).
def _singular(word: str) -> str:
    return word[:-1] if len(word) > 3 and word.endswith("s") and not word.endswith("ss") else word


def _dedupe_key(question: str) -> str:
    words = re.findall(r"[a-z0-9]+", (question or "").lower())
    return " ".join(sorted({_singular(w) for w in words}))


def parse_domain_ai_keywords(result: list[dict[str, Any]]) -> dict:
    block = (result[0] if result else {}) or {}
    items = block.get("items") or []

    best: dict[str, dict] = {}
    for it in items:
        q = (it.get("question") or "").strip()
        if not q:
            continue
        key = _dedupe_key(q)
        vol = it.get("ai_search_volume") or 0
        prev = best.get(key)
        # Keep the highest-volume phrasing, but remember every platform the
        # question surfaced on — the same prompt can appear on several.
        if prev is None or vol > (prev.get("ai_search_volume") or 0):
            sources = it.get("sources") or []
            best[key] = {
                "question": q,
                "ai_search_volume": vol,
                "platform": it.get("model_name") or it.get("platform") or "",
                # The answer is long-form markdown with inline citations; the UI
                # shows a snippet, so trim rather than ship kilobytes per row.
                "answer_snippet": (it.get("answer") or "")[:400],
                "source_count": len(sources) if isinstance(sources, list) else 0,
                "location_code": it.get("location_code"),
                "platforms": sorted({*(prev or {}).get("platforms", []), it.get("model_name") or ""} - {""}),
            }
        elif prev is not None:
            plat = it.get("model_name") or ""
            if plat and plat not in prev["platforms"]:
                prev["platforms"] = sorted([*prev["platforms"], plat])

    rows = sorted(best.values(), key=lambda r: r["ai_search_volume"] or 0, reverse=True)
    return {
        "rows": rows,
        # total_count is the FULL match count upstream, not len(rows) — worth
        # surfacing so "10 of 15,938" is honest about what was fetched.
        "total_count": block.get("total_count") or len(items),
        "returned": len(items),
    }
