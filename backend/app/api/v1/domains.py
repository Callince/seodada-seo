from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, get_db_session
from app.db.models import User
from app.integrations.dataforseo import labs
from app.schemas.domains import (
    CompetitorsResponse,
    IntersectionRequest,
    IntersectionResponse,
    OverviewResponse,
    RankedKeywordsResponse,
    TargetRequest,
)
from app.services import engine, usage

router = APIRouter()


def _clean(target: str) -> str:
    t = target.strip().lower()
    for prefix in ("https://", "http://", "www."):
        if t.startswith(prefix):
            t = t[len(prefix):]
    return t.rstrip("/")


@router.post("/ranked-keywords", response_model=RankedKeywordsResponse)
async def ranked_keywords(
    body: TargetRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> RankedKeywordsResponse:
    target = _clean(body.target)
    resolved = await usage.metered(
        db, user, "labs.ranked_keywords",
        {"target": target, "location_code": body.location_code,
         "language_code": body.language_code, "limit": body.limit},
        engine.TTL["labs"],
        lambda: labs.ranked_keywords(target, body.location_code, body.language_code, body.limit),
    )
    return RankedKeywordsResponse(
        target=target, rows=labs.parse_ranked_keywords(resolved.data), meta=resolved.meta()
    )


@router.post("/competitors", response_model=CompetitorsResponse)
async def competitors(
    body: TargetRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> CompetitorsResponse:
    target = _clean(body.target)
    resolved = await usage.metered(
        db, user, "labs.competitors_domain",
        {"target": target, "location_code": body.location_code,
         "language_code": body.language_code, "limit": body.limit},
        engine.TTL["labs"],
        lambda: labs.competitors_domain(target, body.location_code, body.language_code, body.limit),
    )
    return CompetitorsResponse(
        target=target, rows=labs.parse_competitors(resolved.data), meta=resolved.meta()
    )


@router.post("/overview", response_model=OverviewResponse)
async def overview(
    body: TargetRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> OverviewResponse:
    target = _clean(body.target)
    resolved = await usage.metered(
        db, user, "labs.domain_rank_overview",
        {"target": target, "location_code": body.location_code, "language_code": body.language_code},
        engine.TTL["labs"],
        lambda: labs.domain_rank_overview(target, body.location_code, body.language_code),
    )
    parsed = labs.parse_domain_overview(resolved.data)
    return OverviewResponse(
        target=target, organic=parsed["organic"], paid=parsed["paid"], meta=resolved.meta()
    )


@router.post("/intersection", response_model=IntersectionResponse)
async def intersection(
    body: IntersectionRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> IntersectionResponse:
    t1, t2 = _clean(body.target1), _clean(body.target2)
    resolved = await usage.metered(
        db, user, "labs.domain_intersection",
        {"target1": t1, "target2": t2, "location_code": body.location_code,
         "language_code": body.language_code, "limit": body.limit},
        engine.TTL["labs"],
        lambda: labs.domain_intersection(t1, t2, body.location_code, body.language_code, body.limit),
    )
    return IntersectionResponse(
        target1=t1, target2=t2, rows=labs.parse_intersection(resolved.data), meta=resolved.meta()
    )
