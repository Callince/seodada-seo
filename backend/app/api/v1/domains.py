from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, get_db_session
from app.db.models import User
from app.integrations.dataforseo import domain_meta, labs
from app.schemas.domains import (
    DomainHistoryResponse,
    TechnologiesResponse,
    WhoisResponse,
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
        force_live=body.force_live,
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
        force_live=body.force_live,
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
        force_live=body.force_live,
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
        force_live=body.force_live,
    )
    return IntersectionResponse(
        target1=t1, target2=t2, rows=labs.parse_intersection(resolved.data), meta=resolved.meta()
    )


@router.post("/history", response_model=DomainHistoryResponse)
async def history(
    body: TargetRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> DomainHistoryResponse:
    """Monthly ranked-keyword & traffic history (Labs historical rank overview)."""
    resolved = await usage.metered(
        db, user, "domains.history",
        {"target": body.target, "loc": body.location_code, "lang": body.language_code},
        engine.TTL["labs"],
        lambda: labs.historical_rank(body.target, body.location_code, body.language_code),
        force_live=body.force_live,
    )
    return DomainHistoryResponse(
        target=body.target, rows=labs.parse_historical_rank(resolved.data), meta=resolved.meta()
    )


@router.post("/whois", response_model=WhoisResponse)
async def whois(
    body: TargetRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> WhoisResponse:
    resolved = await usage.metered(
        db, user, "domains.whois",
        {"target": body.target},
        engine.TTL["domain_meta"],
        lambda: domain_meta.whois(body.target),
        force_live=body.force_live,
    )
    return WhoisResponse(
        target=body.target, whois=domain_meta.parse_whois(resolved.data), meta=resolved.meta()
    )


@router.post("/technologies", response_model=TechnologiesResponse)
async def technologies(
    body: TargetRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> TechnologiesResponse:
    resolved = await usage.metered(
        db, user, "domains.technologies",
        {"target": body.target},
        engine.TTL["domain_meta"],
        lambda: domain_meta.technologies(body.target),
        force_live=body.force_live,
    )
    return TechnologiesResponse(
        target=body.target, profile=domain_meta.parse_technologies(resolved.data), meta=resolved.meta()
    )
