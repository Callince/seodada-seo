from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, get_db_session
from app.db.models import User
from app.integrations.dataforseo import content as content_api
from app.integrations.dataforseo import serp as serp_api
from app.integrations.free import brave
from app.schemas.content import ContentRequest, ContentResponse
from app.services import engine, providers, sentiment, usage

router = APIRouter()


@router.post("/analyze", response_model=ContentResponse)
async def analyze(
    body: ContentRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> ContentResponse:
    keyword = body.keyword.strip().lower()

    if providers.content_provider() == "local":
        # Gather a corpus from the SERP (Brave if configured, else DataForSEO),
        # then score sentiment + connotations locally with VADER ($0 analysis).
        serp_provider = providers.serp_provider()
        depth = min(body.citation_limit, 20 if serp_provider == "brave" else 100)
        if serp_provider == "brave":
            endpoint = "serp.brave"
            fetch_fn = lambda: brave.organic(keyword, 2840, "en", depth)  # noqa: E731
        else:
            endpoint = "serp.organic"
            fetch_fn = lambda: serp_api.organic(keyword, 2840, "en", depth)  # noqa: E731

        resolved = await usage.metered(
            db, user, endpoint,
            {"keyword": keyword, "location_code": 2840, "language_code": "en",
             "depth": depth, "provider": serp_provider},
            engine.TTL["serp"],
            fetch_fn,
        )
        items = serp_api.parse_organic(resolved.data)
        analysis = sentiment.analyze_corpus(items)
        return ContentResponse(
            keyword=body.keyword,
            total_count=analysis["total_count"],
            sentiment=analysis["sentiment"],
            connotations=analysis["connotations"],
            top_citations=analysis["citations"][: body.citation_limit],
            meta=resolved.meta(),
        )

    # DataForSEO Content Analysis path.
    summary = await usage.metered(
        db, user, "content.summary",
        {"keyword": keyword},
        engine.TTL["content"],
        lambda: content_api.summary(keyword),
    )
    citations = await usage.metered(
        db, user, "content.search",
        {"keyword": keyword, "limit": body.citation_limit},
        engine.TTL["content"],
        lambda: content_api.search(keyword, body.citation_limit),
    )

    parsed = content_api.parse_summary(summary.data)
    meta = summary.meta()
    meta["cost_cents"] += citations.cost_cents
    if not citations.from_cache:
        meta["from_cache"] = False

    return ContentResponse(
        keyword=body.keyword,
        total_count=parsed["total_count"],
        sentiment=parsed["sentiment"],
        connotations=parsed["connotations"],
        top_citations=content_api.parse_citations(citations.data),
        meta=meta,
    )
