import asyncio
from urllib.parse import urlparse

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, get_db_session
from app.core.logging import log
from app.db.models import User
from app.integrations.dataforseo import onpage as onpage_api
from app.integrations.free import local_onpage
from app.schemas.onpage import LighthouseResponse, OnPageResponse, OnPageRequest
from app.services import competitive, density, engine, providers, scoring, usage

router = APIRouter()


async def _maybe_benchmark(
    db: AsyncSession,
    user: User,
    body: OnPageRequest,
    url: str,
    page_terms: dict,
    word_count: int | None,
    heading_count: int,
) -> dict | None:
    """Run SERP benchmarking when a target keyword is set. Never fatal: a
    benchmarking failure (SERP error, quota, slow competitors) just omits the
    section rather than failing the whole On-Page analysis.
    """
    if not (body.target_keyword and body.target_keyword.strip()):
        return None
    try:
        return await competitive.benchmark(
            db, user, body.target_keyword,
            body.location_code, body.language_code,
            page_terms=page_terms or {},
            page_word_count=word_count,
            page_heading_count=heading_count,
            exclude_domain=urlparse(url).hostname,
        )
    except Exception as exc:  # noqa: BLE001 — benchmarking is best-effort
        log.info("benchmark_skip", url=url, reason=str(exc))
        return None


@router.post("/analyze", response_model=OnPageResponse)
async def analyze(
    body: OnPageRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> OnPageResponse:
    url = body.url.strip()
    # Forgive bare domains — DataForSEO requires a full URL with a scheme.
    if url and not url.lower().startswith(("http://", "https://")):
        url = f"https://{url}"

    if providers.onpage_provider() == "local":
        # Fully local, $0: fetch + parse the page in-process. One fetch covers
        # meta/headings, readability, the scoring rubric AND keyword density.
        resolved = await usage.metered(
            db, user, "onpage.local",
            {"url": url, "target_keyword": body.target_keyword},
            engine.TTL["on_page"],
            lambda: local_onpage.analyze(url, body.target_keyword),
            force_live=body.force_live,
        )
        p = resolved.data[0] if resolved.data else {}
        benchmark = await _maybe_benchmark(
            db, user, body, url,
            p.get("page_terms") or {}, p.get("word_count"), p.get("heading_count") or 0,
        )
        return OnPageResponse(
            url=url,
            content_score=p.get("content_score"),
            technical_score=p.get("technical_score"),
            word_count=p.get("word_count"),
            readability=p.get("readability") or {},
            keyword_density=p.get("keyword_density") or [],
            keyword_analysis=p.get("keyword_analysis"),
            subscores=p.get("subscores") or [],
            title=p.get("title"),
            meta_description=p.get("meta_description"),
            h1=p.get("h1") or [],
            h2=p.get("h2") or [],
            issues=p.get("issues") or [],
            recommendations=p.get("recommendations") or [],
            snippet=p.get("snippet"),
            images=p.get("images"),
            indexability=p.get("indexability"),
            links=p.get("links"),
            benchmark=benchmark,
            meta=resolved.meta(),
        )

    # DataForSEO path: instant_pages gives the technical score + meta; we fetch
    # the HTML once locally to run the SAME scoring rubric + density model, so
    # the On-Page score and recommendations are consistent across providers.
    # The two fetches are independent — run them concurrently (only the metered
    # call touches the request session, so a plain gather is safe).
    async def _local_page() -> dict | None:
        try:
            raw = await density.fetch_html(url)
            return local_onpage.extract_page(raw, url, body.target_keyword)
        except density.FetchError as exc:
            log.info("density_skip", url=url, reason=str(exc))
            return None

    resolved, page = await asyncio.gather(
        usage.metered(
            db, user, "onpage.instant_pages",
            {"url": url},
            engine.TTL["on_page"],
            lambda: onpage_api.instant_pages(url),
            force_live=body.force_live,
        ),
        _local_page(),
    )
    parsed = onpage_api.parse_instant_pages(resolved.data)

    content_score = parsed["content_score"]
    word_count = parsed["word_count"]
    readability = parsed["readability"]
    title = parsed["title"]
    meta_description = parsed["meta_description"]
    h1 = parsed["h1"]
    h2: list[str] = []
    density_rows: list[dict] = []
    subscores: list[dict] = []
    recommendations: list[str] = []
    keyword_analysis = None
    snippet = images = indexability = links = None
    page_terms: dict = {}
    heading_count = 0
    issues = list(parsed["issues"])

    if page is not None:
        ev = scoring.evaluate(page["signals"])
        # Our rubric is the headline content score; DataForSEO's is technical.
        content_score = ev["score"]
        word_count = page["word_count"] or word_count
        readability = page["readability"] or readability
        title = title or page["title"]
        meta_description = meta_description or page["meta_description"]
        h1 = h1 or page["h1"]
        h2 = page["h2"]
        density_rows = page["keyword_density"]
        subscores = ev["subscores"]
        recommendations = ev["recommendations"]
        keyword_analysis = ev["keyword_analysis"]
        snippet = page["snippet"]
        images = page["images"]
        indexability = page["indexability"]
        links = page["links"]
        page_terms = page["page_terms"]
        heading_count = page["heading_count"]
        # Merge: rubric issues first, then any DataForSEO technical checks.
        issues = ev["issues"] + [i for i in issues if i not in ev["issues"]]

    benchmark = await _maybe_benchmark(
        db, user, body, url, page_terms, word_count, heading_count
    )

    return OnPageResponse(
        url=url,
        content_score=content_score,
        technical_score=parsed["content_score"],
        word_count=word_count,
        readability=readability,
        keyword_density=density_rows,
        keyword_analysis=keyword_analysis,
        subscores=subscores,
        title=title,
        meta_description=meta_description,
        h1=h1,
        h2=h2,
        issues=issues[:25],
        recommendations=recommendations,
        snippet=snippet,
        images=images,
        indexability=indexability,
        links=links,
        benchmark=benchmark,
        meta=resolved.meta(),
    )


@router.post("/lighthouse", response_model=LighthouseResponse)
async def lighthouse(
    body: OnPageRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> LighthouseResponse:
    """Google Lighthouse category scores + Core Web Vitals (mobile)."""
    resolved = await usage.metered(
        db, user, "onpage.lighthouse",
        {"url": body.url},
        engine.TTL["on_page"],
        lambda: onpage_api.lighthouse(body.url),
        force_live=body.force_live,
    )
    parsed = onpage_api.parse_lighthouse(resolved.data)
    return LighthouseResponse(
        url=body.url, categories=parsed["categories"], vitals=parsed["vitals"], meta=resolved.meta()
    )
