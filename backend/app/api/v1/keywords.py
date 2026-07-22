from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, get_db_session
from app.core.logging import log
from app.db.models import User
from app.integrations.dataforseo import keywords as kw
from app.integrations.dataforseo import labs
from app.integrations.dataforseo import serp as serp_api
from app.integrations.free import trends as free_trends
from app.services.coalescer import search_volume_coalescer
from app.schemas.keywords import (
    BulkOverviewResponse,
    KeywordOverviewResponse,
    OverviewRequest,
    IdeasRequest,
    KeywordListResponse,
    PaaRequest,
    PaaResponse,
    SeedRequest,
    TrendsRequest,
    TrendsResponse,
    VolumeRequest,
    VolumeResponse,
)
from app.services import engine, providers, usage

router = APIRouter()


@router.post("/volume", response_model=VolumeResponse)
async def volume(
    body: VolumeRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> VolumeResponse:
    terms = sorted({k.strip().lower() for k in body.keywords if k.strip()})
    resolved = await usage.metered(
        db, user, "keywords.search_volume",
        {"keywords": terms, "location_code": body.location_code, "language_code": body.language_code},
        engine.TTL["search_volume"],
        lambda: search_volume_coalescer.fetch(terms, body.location_code, body.language_code),
        force_live=body.force_live,
    )
    return VolumeResponse(rows=kw.parse_volume_rows(resolved.data), meta=resolved.meta())


@router.post("/bulk-overview", response_model=BulkOverviewResponse)
async def bulk_overview(
    body: VolumeRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> BulkOverviewResponse:
    """Volume, CPC, competition, difficulty AND intent for many keywords.

    Replaces the bulk pane's use of /volume (google_ads search_volume), which
    carries no intent field at all. Measured on identical keyword sets: same
    search volumes to the number, but 1.34c against 9.0c for 12 keywords —
    cheaper and richer, so there is no tradeoff to weigh here.
    """
    terms = sorted({k.strip().lower() for k in body.keywords if k.strip()})
    resolved = await usage.metered(
        db, user, "labs.keywords_overview",
        {"keywords": terms, "location_code": body.location_code,
         "language_code": body.language_code},
        engine.TTL["labs"],
        lambda: labs.keywords_overview(terms, body.location_code, body.language_code),
        force_live=body.force_live,
    )
    return BulkOverviewResponse(
        rows=labs.parse_keywords_overview(resolved.data), meta=resolved.meta()
    )


@router.post("/trends", response_model=TrendsResponse)
async def trends(
    body: TrendsRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> TrendsResponse:
    terms = [k.strip() for k in body.keywords if k.strip()]
    provider = providers.trends_provider()
    date_from, date_to = body.date_from, body.date_to
    if provider == "google":
        endpoint = "trends.google"

        async def fetch_fn():  # type: ignore[misc]
            """Google Trends, falling back to DataForSEO if Google is unavailable.

            Google is several times faster and free, but it throttles this
            endpoint intermittently. Without a fallback a 429 would surface as
            an empty chart — indistinguishable from a keyword with genuinely no
            interest, which is the one failure mode a trends view must not
            have. Same shape as the free-then-paid trends fallback: prefer the
            free source, never let it silently degrade the answer.
            """
            try:
                return await free_trends.google_trends(
                    terms, body.location_code, body.language_code, body.time_range,
                    date_from, date_to,
                )
            except free_trends.TrendsUnavailable as exc:
                log.info("trends_fallback_to_dataforseo", keywords=terms, reason=str(exc)[:200])
                return await kw.google_trends(
                    terms, body.location_code, body.language_code, body.time_range,
                    date_from, date_to,
                )
    else:
        endpoint = "keywords.google_trends"
        fetch_fn = lambda: kw.google_trends(  # noqa: E731
            terms, body.location_code, body.language_code, body.time_range, date_from, date_to
        )
    resolved = await usage.metered(
        db, user, endpoint,
        {"keywords": terms, "location_code": body.location_code,
         "language_code": body.language_code, "time_range": body.time_range,
         "date_from": date_from, "date_to": date_to, "provider": provider},
        engine.TTL["trends"],
        fetch_fn,
        force_live=body.force_live,
    )
    parsed = kw.parse_trends(resolved.data)
    return TrendsResponse(keywords=parsed["keywords"], graph=parsed["graph"], meta=resolved.meta())


@router.post("/suggestions", response_model=KeywordListResponse)
async def suggestions(
    body: SeedRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> KeywordListResponse:
    seed = body.seed.strip().lower()
    resolved = await usage.metered(
        db, user, "labs.keyword_suggestions",
        {"seed": seed, "location_code": body.location_code,
         "language_code": body.language_code, "limit": body.limit},
        engine.TTL["labs"],
        lambda: labs.keyword_suggestions(seed, body.location_code, body.language_code, body.limit),
        force_live=body.force_live,
    )
    return KeywordListResponse(rows=labs.parse_keyword_items(resolved.data), meta=resolved.meta())


@router.post("/related", response_model=KeywordListResponse)
async def related(
    body: SeedRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> KeywordListResponse:
    seed = body.seed.strip().lower()
    resolved = await usage.metered(
        db, user, "labs.related_keywords",
        {"seed": seed, "location_code": body.location_code,
         "language_code": body.language_code, "limit": body.limit},
        engine.TTL["labs"],
        lambda: labs.related_keywords(seed, body.location_code, body.language_code, body.limit),
        force_live=body.force_live,
    )
    return KeywordListResponse(rows=labs.parse_keyword_items(resolved.data), meta=resolved.meta())


@router.post("/ideas", response_model=KeywordListResponse)
async def ideas(
    body: IdeasRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> KeywordListResponse:
    terms = sorted({k.strip().lower() for k in body.keywords if k.strip()})
    resolved = await usage.metered(
        db, user, "labs.keyword_ideas",
        {"keywords": terms, "location_code": body.location_code,
         "language_code": body.language_code, "limit": body.limit},
        engine.TTL["labs"],
        lambda: labs.keyword_ideas(terms, body.location_code, body.language_code, body.limit),
        force_live=body.force_live,
    )
    return KeywordListResponse(rows=labs.parse_keyword_items(resolved.data), meta=resolved.meta())


@router.post("/paa", response_model=PaaResponse)
async def paa(
    body: PaaRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> PaaResponse:
    keyword = body.keyword.strip().lower()
    resolved = await usage.metered(
        db, user, "serp.organic",
        {"keyword": keyword, "location_code": body.location_code,
         "language_code": body.language_code, "depth": 10},
        engine.TTL["serp"],
        lambda: serp_api.organic(body.keyword, body.location_code, body.language_code, 10),
        force_live=body.force_live,
    )
    return PaaResponse(keyword=body.keyword, paa=serp_api.parse_paa(resolved.data), meta=resolved.meta())


@router.post("/overview", response_model=KeywordOverviewResponse)
async def overview(
    body: OverviewRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> KeywordOverviewResponse:
    """Intent, difficulty, CPC and volume for one keyword (Labs overview)."""
    resolved = await usage.metered(
        db, user, "keywords.overview",
        {"keyword": body.keyword, "loc": body.location_code, "lang": body.language_code},
        engine.TTL["labs"],
        lambda: labs.keyword_overview(body.keyword, body.location_code, body.language_code),
        force_live=body.force_live,
    )
    return KeywordOverviewResponse(
        overview=labs.parse_keyword_overview(resolved.data), meta=resolved.meta()
    )
