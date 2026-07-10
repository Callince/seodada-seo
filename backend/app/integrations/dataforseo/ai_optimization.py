"""AI Optimization API — LLM mentions (GEO/AEO), AI keyword volume, live LLM
responses. Covered by the account's LLM-mentions subscription."""
from __future__ import annotations

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
    [{key, mentions, ai_search_volume}, …]}}. Totals + per-dimension breakdowns."""
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
        dimensions[dim] = parsed[:20]
        if dim == "location":  # count each mention once — location covers all
            total_mentions = sum(p["mentions"] for p in parsed)
            total_volume = sum(p["ai_search_volume"] for p in parsed)
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
