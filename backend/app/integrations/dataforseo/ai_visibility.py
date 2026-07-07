"""Google AI Visibility — is a domain cited in AI Overview / AI Mode answers?

Two surfaces, both returned by DataForSEO as an `ai_overview` element carrying a
`references[]` list of cited sources ({domain, url, title, source}):

* **AI Overview** — the generative answer box on the normal results page. It is
  only present for some queries, and must be force-loaded with
  `load_async_ai_overview` on the organic *advanced* endpoint.
* **AI Mode** — Google's dedicated conversational answer (the "AI Mode" tab),
  fetched from its own endpoint. It always returns an answer + citations.

A domain "ranks in AI" for a keyword when it appears among those references.
"""
from __future__ import annotations

from typing import Any

from app.integrations.dataforseo.client import DfsResult, dfs_client
from app.services.ranking import normalize_domain

PATH_ORGANIC = "/v3/serp/google/organic/live/advanced"
PATH_AI_MODE = "/v3/serp/google/ai_mode/live/advanced"


async def ai_overview(
    keyword: str, location_code: int, language_code: str, device: str = "desktop"
) -> DfsResult:
    return await dfs_client.post(PATH_ORGANIC, {
        "keyword": keyword,
        "location_code": location_code,
        "language_code": language_code,
        "device": device,
        "load_async_ai_overview": True,
    })


async def ai_mode(
    keyword: str, location_code: int, language_code: str, device: str = "desktop"
) -> DfsResult:
    return await dfs_client.post(PATH_AI_MODE, {
        "keyword": keyword,
        "location_code": location_code,
        "language_code": language_code,
        "device": device,
    })


def parse_surface(result: list[dict[str, Any]]) -> dict:
    """Return {present, references[]} for the AI element in a SERP result.

    `present` is True when Google rendered an AI answer for the query (always
    True for the AI Mode endpoint; query-dependent for AI Overview).
    """
    items = (result[0].get("items") if result else None) or []
    refs: list[dict] = []
    present = False
    for it in items:
        if it.get("type") != "ai_overview":
            continue
        present = True
        for r in it.get("references") or []:
            domain = (r.get("domain") or "").lower()
            if domain.startswith("www."):
                domain = domain[4:]
            refs.append({
                "domain": domain,
                "url": r.get("url"),
                "title": r.get("title"),
                "source": r.get("source"),
            })
        break
    return {"present": present, "references": refs}


def find_citation(references: list[dict], target_domain: str) -> dict:
    """Locate `target_domain` among the cited references → {cited, url, position}.

    Position is 1-based among the AI answer's sources. Matches the registrable
    domain, so a blog/subdomain citation still counts for the root domain.
    """
    target = normalize_domain(target_domain)
    for idx, r in enumerate(references):
        rd = normalize_domain(r.get("domain") or "")
        if rd == target or rd.endswith("." + target):
            return {"cited": True, "url": r.get("url"), "position": idx + 1}
    return {"cited": False, "url": None, "position": None}
