from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, get_db_session
from app.db.models import User
from app.integrations.dataforseo import serp as serp_api
from app.integrations.free import brave
from app.schemas.serp import SerpRankingRequest, SerpResponse
from app.services import brand, engine, providers, usage

router = APIRouter()

ENDPOINT = "serp.organic"


@router.post("/ranking", response_model=SerpResponse)
async def ranking(
    body: SerpRankingRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> SerpResponse:
    await usage.assert_within_quota(db, user)

    provider = providers.serp_provider()
    params = {
        "keyword": body.keyword.strip().lower(),
        "location_code": body.location_code,
        "language_code": body.language_code,
        "depth": body.depth,
        "device": body.device,
        "provider": provider,
    }
    if provider == "brave":
        endpoint = "serp.brave"
        fetch_fn = lambda: brave.organic(  # noqa: E731
            body.keyword, body.location_code, body.language_code, body.depth
        )
    else:
        endpoint = ENDPOINT
        fetch_fn = lambda: serp_api.organic(  # noqa: E731
            body.keyword, body.location_code, body.language_code, body.depth, body.device
        )

    resolved = await engine.resolve(
        db,
        endpoint=endpoint,
        params=params,
        ttl_seconds=engine.TTL["serp"],
        fetch_fn=fetch_fn,
        force_live=body.force_live,
    )
    await usage.record(db, user, endpoint, resolved.cost_cents, resolved.from_cache)

    results = serp_api.parse_organic(resolved.data)
    paa = serp_api.parse_paa(resolved.data)  # empty for Brave (no PAA on free tier)
    # Brand name is free/local; brand *volume* is a billed DataForSEO lookup, so
    # skip it when the SERP itself came from a free provider.
    brand_cost = await brand.enrich(
        db, user, results, body.location_code, body.language_code,
        with_volume=(provider == "dataforseo"),
    )

    meta = resolved.meta()
    meta["cost_cents"] += brand_cost
    return SerpResponse(keyword=body.keyword, results=results, paa=paa, meta=meta)
