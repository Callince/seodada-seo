"""On-page analysis tools API — the six seodada analyzers, in-process ($0).

One fetch returns every section (`/page`); the sitemap tool uses `/sitemap`.
Free (scraper-powered) — recorded as a $0 usage row for history. Results are
cached briefly so repeat views are instant; `refresh=true` bypasses the cache
and re-fetches the page live.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, get_db_session
from app.db.models import User
from app.services import page_analysis, usage
from app.services.cache_backend import cache_backend

router = APIRouter()

# Short result cache — the analysis is $0 but re-fetching + parsing isn't free,
# so a repeat view within this window is served instantly from the hot tier.
_RESULT_TTL = 900  # 15 minutes


class AnalyzeRequest(BaseModel):
    url: str = Field(min_length=3, max_length=2000)
    refresh: bool = False  # bypass the result cache and pull the page live


async def _cached_analysis(
    body: AnalyzeRequest, db: AsyncSession, user: User, kind: str, endpoint: str, fn
) -> dict:
    key = f"analyze:{kind}:{body.url.strip().lower()}"
    if not body.refresh:
        cached = await cache_backend.get(key)
        if cached is not None:
            cached["fetch"] = {**cached.get("fetch", {}), "from_cache": True}
            await usage.record(db, user, endpoint, 0, from_cache=True)
            return cached
    try:
        result = await fn(body.url, refresh=body.refresh)
    except page_analysis.AnalyzeError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Analysis failed: {exc}") from exc
    await cache_backend.set(key, result, _RESULT_TTL)
    await usage.record(db, user, endpoint, 0, from_cache=False)
    return result


@router.post("/page")
async def analyze_page(
    body: AnalyzeRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> dict:
    await usage.assert_within_quota(db, user)
    return await _cached_analysis(body, db, user, "page", "onpage.analyze", page_analysis.analyze_page)


@router.post("/sitemap")
async def analyze_sitemap(
    body: AnalyzeRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> dict:
    await usage.assert_within_quota(db, user)
    return await _cached_analysis(body, db, user, "sitemap", "onpage.sitemap", page_analysis.analyze_sitemap)
