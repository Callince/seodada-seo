from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, get_db_session
from app.db.models import User
from app.integrations.dataforseo import content as content_api
from app.integrations.dataforseo import serp as serp_api
from app.integrations.free import brave
from app.schemas.content import ContentRequest, ContentResponse, PhraseTrendsResponse, SentimentResponse
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
            force_live=body.force_live,
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
        force_live=body.force_live,
    )
    citations = await usage.metered(
        db, user, "content.search",
        {"keyword": keyword, "limit": body.citation_limit},
        engine.TTL["content"],
        lambda: content_api.search(keyword, body.citation_limit),
        force_live=body.force_live,
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


@router.post("/sentiment", response_model=SentimentResponse)
async def keyword_sentiment(
    body: ContentRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> SentimentResponse:
    """How the web talks about a keyword/brand — citation sentiment breakdown."""
    resolved = await usage.metered(
        db, user, "content.sentiment",
        {"keyword": body.keyword},
        engine.TTL["content"],
        lambda: content_api.sentiment(body.keyword),
        force_live=body.force_live,
    )
    parsed = content_api.parse_sentiment(resolved.data)
    return SentimentResponse(
        keyword=body.keyword,
        total_citations=parsed["total_citations"],
        connotations=parsed["connotations"],
        types=parsed["types"],
        meta=resolved.meta(),
    )


@router.post("/phrase-trends", response_model=PhraseTrendsResponse)
async def keyword_phrase_trends(
    body: ContentRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> PhraseTrendsResponse:
    """Citation volume over the last 12 months (monthly buckets)."""
    from datetime import date

    d_to = date.today().isoformat()
    d_from = date.today().replace(year=date.today().year - 1).isoformat()
    resolved = await usage.metered(
        db, user, "content.phrase_trends",
        {"keyword": body.keyword, "from": d_from, "to": d_to},
        engine.TTL["content"],
        lambda: content_api.phrase_trends(body.keyword, d_from, d_to),
        force_live=body.force_live,
    )
    return PhraseTrendsResponse(
        keyword=body.keyword, rows=content_api.parse_phrase_trends(resolved.data), meta=resolved.meta()
    )
