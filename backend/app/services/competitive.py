"""SERP-competitive benchmarking + content-gap analysis.

For a target keyword we pull the top organic results, fetch the competing pages,
and compare them to the analyzed page:

  * benchmark   — competitor median/max word count and heading count vs. yours,
                  so "aim for more words" becomes "the top results average N".
  * content gap — terms most competitors use that your page is missing. This is
                  how modern ranking works: cover the topic, not just the keyword.

The expensive part — one SERP call plus fetching ~5 competitor pages — is built
once and cached through the cost engine keyed by the keyword, so repeat On-Page
analyses (of any URL) reuse the corpus for $0 and zero extra fetches. The cheap
page-specific comparison (your words/terms vs. the cached corpus) is recomputed
each time. Competitor fetches run concurrently and degrade gracefully.
"""
from __future__ import annotations

import asyncio
import re
import statistics
from collections import Counter

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import log
from app.db.models import User
from app.integrations.dataforseo import serp as serp_api
from app.integrations.dataforseo.client import DfsResult
from app.services import density, engine, usage

_MAX_COMPETITORS = 5
_FETCH_TIMEOUT = 8.0
_HEADING_RE = re.compile(r"<h[1-3][\s>]", re.IGNORECASE)


async def _fetch_metrics(url: str) -> dict | None:
    """Fetch one competitor page and reduce it to comparison metrics."""
    try:
        raw = await asyncio.wait_for(density.fetch_html(url), timeout=_FETCH_TIMEOUT)
    except Exception as exc:  # timeout, SSRF guard, HTTP error — just skip it
        log.info("competitor_fetch_skip", url=url, reason=str(exc))
        return None
    text = density.extract_text(raw)
    return {
        "word_count": density.word_count(text),
        "heading_count": len(_HEADING_RE.findall(raw)),
        "terms": density.doc_terms(text),
    }


async def _build_corpus(keyword: str, location_code: int, language_code: str) -> DfsResult:
    """SERP + competitor page fetches → a compact, cacheable corpus.

    Returned shape (single result row):
        {competitors_analyzed, word_counts[], heading_counts[], term_df{term:docs}}
    Cost is the SERP cost; the page fetches are free.
    """
    serp = await serp_api.organic(keyword, location_code, language_code, 10)

    rows = serp_api.parse_organic(serp.result)
    urls = [r["url"] for r in rows if r.get("url")][:_MAX_COMPETITORS]
    metrics = await asyncio.gather(*[_fetch_metrics(u) for u in urls]) if urls else []
    competitors = [m for m in metrics if m]

    term_df: Counter = Counter()
    for m in competitors:
        for term in m["terms"]:
            term_df[term] += 1

    corpus = {
        "competitors_analyzed": len(competitors),
        "word_counts": [m["word_count"] for m in competitors],
        "heading_counts": [m["heading_count"] for m in competitors],
        "term_df": dict(term_df.most_common(80)),
    }
    log.info("competitive_corpus", keyword=keyword, competitors=len(competitors))
    return DfsResult(result=[corpus], cost_cents=serp.cost_cents)


def _content_gap(term_df: dict[str, int], page_terms: dict[str, int], n: int) -> list[dict]:
    """Terms used by a majority of competitors but absent from the page."""
    threshold = max(2, (n + 1) // 2)
    page = page_terms or {}
    gap: list[dict] = []
    for term, used_by in sorted(term_df.items(), key=lambda kv: -kv[1]):
        if used_by < threshold or term in page:
            continue
        gap.append({"term": term, "competitors_using": used_by, "your_count": page.get(term, 0)})
        if len(gap) >= 15:
            break
    return gap


async def benchmark(
    db: AsyncSession,
    user: User,
    keyword: str,
    location_code: int,
    language_code: str,
    page_terms: dict[str, int],
    page_word_count: int | None,
    page_heading_count: int,
    exclude_domain: str | None = None,  # accepted for API stability; corpus is keyword-scoped
) -> dict | None:
    """Benchmark the analyzed page against the cached top-SERP corpus for `keyword`."""
    kw = keyword.strip().lower()
    resolved = await usage.metered(
        db, user, "onpage.benchmark",
        # "provider" is constant since Brave was removed; kept in the key so
        # existing cached corpora keep hashing the same rather than re-billing.
        {"keyword": kw, "location_code": location_code,
         "language_code": language_code, "provider": "dataforseo"},
        engine.TTL["serp"],
        lambda: _build_corpus(keyword, location_code, language_code),
    )
    corpus = resolved.data[0] if resolved.data else None
    if not corpus or not corpus.get("competitors_analyzed"):
        return None

    word_counts = corpus["word_counts"]
    heading_counts = corpus["heading_counts"]
    return {
        "keyword": keyword,
        "competitors_analyzed": corpus["competitors_analyzed"],
        "word_count": {
            "you": page_word_count or 0,
            "median": int(statistics.median(word_counts)) if word_counts else 0,
            "max": max(word_counts) if word_counts else 0,
        },
        "headings": {
            "you": page_heading_count,
            "median": int(statistics.median(heading_counts)) if heading_counts else 0,
        },
        "missing_terms": _content_gap(corpus["term_df"], page_terms, corpus["competitors_analyzed"]),
    }
