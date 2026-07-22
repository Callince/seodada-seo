"""Public content API — the migrated seodada blog + web stories (read-only).

Global content (not org-scoped). No auth. Only published items are exposed.
"""
from __future__ import annotations

from datetime import datetime
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session
from app.api.limiter import enforce_public_demo_rate_limit
from app.core.config import settings
from app.db.models import Blog, BlogCategory, ContactSubmission, WebsiteSettings, WebStory
from app.services import fx, page_analysis
from app.services.cache_backend import cache_backend

router = APIRouter()


# ------------------------------------------------------- public demo analyzer

class PublicAnalyzeRequest(BaseModel):
    url: str = Field(min_length=3, max_length=2000)


# Cached longer than the authed analyzer: the landing page is the highest-traffic
# surface, and everyone pasting the same popular domain should hit the cache.
_DEMO_TTL = 1800  # 30 minutes
# Per-list cap on the anonymous tool detail. A real page can carry thousands of
# links or images; this keeps an unauthenticated response to a few KB while
# still showing enough to be a useful free tool.
_DETAIL_CAP = 50


@router.post("/analyze", dependencies=[Depends(enforce_public_demo_rate_limit)])
async def public_analyze(body: PublicAnalyzeRequest) -> dict:
    """Anonymous on-page analysis for the landing page — real results, no login.

    Safe to expose: the analysis runs in-process ($0, no billed API), the fetch
    is SSRF-guarded (`density._is_public_host` rejects private/loopback/reserved
    hosts), and the route is per-IP rate limited.

    Deliberately a *teaser*: headline checks only, with the per-item detail
    (every heading, image, link, keyword density) reserved for the real tool.
    """
    url = body.url.strip()
    key = f"public-analyze:{url.lower()}"
    cached = await cache_backend.get(key)
    if cached is not None:
        return {**cached, "cached": True}

    try:
        full = await page_analysis.analyze_page(url, refresh=False)
    except page_analysis.AnalyzeError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 — never leak a stack trace publicly
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "Couldn't fetch that page — check the URL and try again."
        ) from exc

    u, meta = full.get("url") or {}, full.get("meta") or {}
    headings, images, links = full.get("headings") or {}, full.get("images") or {}, full.get("links") or {}
    counts = headings.get("counts") or {}

    # Headline checks only — enough to prove the tool works and show real gaps.
    checks = [
        {"label": "HTTPS", "ok": bool(u.get("https"))},
        {"label": "Title tag", "ok": bool(meta.get("title")), "detail": meta.get("title") or "Missing"},
        {"label": "Meta description", "ok": bool(meta.get("description")),
         "detail": "Present" if meta.get("description") else "Missing"},
        {"label": "H1 heading", "ok": bool(counts.get("h1")),
         "detail": headings.get("h1_text") or "Missing"},
        {"label": "Canonical URL", "ok": bool(meta.get("canonical"))},
        {"label": "Viewport (mobile)", "ok": bool(meta.get("viewport"))},
        {"label": "Image alt text", "ok": not images.get("missing_alt"),
         "detail": f"{images.get('missing_alt') or 0} of {images.get('total') or 0} missing"},
    ]
    passed = sum(1 for c in checks if c["ok"])

    # Per-tool detail for the public /free-tools page. Capped hard: this is an
    # unauthenticated endpoint, and an uncapped page could return thousands of
    # links or images. The caps are generous enough to be genuinely useful and
    # small enough that the response stays a handful of KB.
    kw = full.get("keywords") or {}
    detail = {
        "url": {
            "final_url": u.get("final_url"),
            "status_code": u.get("status_code"),
            "redirected": u.get("redirected"),
            "https": u.get("https"),
            "path_depth": u.get("path_depth"),
            "slug": u.get("slug"),
            "canonical": u.get("canonical"),
            "robots_meta": u.get("robots_meta"),
            "checks": (u.get("checks") or [])[:20],
        },
        "meta": {
            "title": meta.get("title"),
            "title_length": meta.get("title_length"),
            "title_check": meta.get("title_check"),
            "description": meta.get("description"),
            "description_length": meta.get("description_length"),
            "description_check": meta.get("description_check"),
            "canonical": meta.get("canonical"),
            "robots": meta.get("robots"),
            "viewport": meta.get("viewport"),
            "language": meta.get("language"),
            "open_graph": meta.get("open_graph") or {},
            "twitter": meta.get("twitter") or {},
            "schema_types": (meta.get("schema_types") or [])[:20],
        },
        "headings": {
            "counts": counts,
            "h1_text": headings.get("h1_text"),
            "issues": (headings.get("issues") or [])[:20],
            "items": (headings.get("items") or [])[:_DETAIL_CAP],
            "truncated": len(headings.get("items") or []) > _DETAIL_CAP,
        },
        "keywords": {
            "word_count": kw.get("word_count"),
            "unique_words": kw.get("unique_words"),
            "reading_time_min": kw.get("reading_time_min"),
            "top_keywords": (kw.get("top_keywords") or [])[:25],
            "top_phrases": (kw.get("top_phrases") or [])[:15],
        },
        "images": {
            "total": images.get("total"),
            "missing_alt": images.get("missing_alt"),
            "with_alt": images.get("with_alt"),
            "lazy_count": images.get("lazy_count"),
            "items": (images.get("items") or [])[:_DETAIL_CAP],
            "truncated": len(images.get("items") or []) > _DETAIL_CAP,
        },
        "links": {
            "internal_count": links.get("internal_count"),
            "external_count": links.get("external_count"),
            "nofollow_count": links.get("nofollow_count"),
            "total": links.get("total"),
            "samples": (links.get("samples") or [])[:_DETAIL_CAP],
        },
    }

    result = {
        "url": u.get("final_url") or url,
        "status_code": u.get("status_code"),
        "score": round(passed / len(checks) * 100),
        "passed": passed,
        "total": len(checks),
        "checks": checks,
        "summary": {
            "title_length": meta.get("title_length"),
            "headings": sum(int(v or 0) for v in counts.values()),
            "images": images.get("total"),
            "internal_links": links.get("internal_count"),
            "external_links": links.get("external_count"),
        },
        "detail": detail,
        "cached": False,
    }
    await cache_backend.set(key, result, _DEMO_TTL)
    return result


class ContactCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    message: str = Field(min_length=10, max_length=5000)


@router.post("/contact", status_code=status.HTTP_201_CREATED)
async def submit_contact(
    body: ContactCreate, request: Request, db: AsyncSession = Depends(get_db_session)
):
    """Public contact form → an admin-inbox submission (no auth)."""
    db.add(ContactSubmission(
        name=body.name.strip(), email=str(body.email).lower(), message=body.message.strip(),
        ip=(request.client.host if request.client else ""),
    ))
    await db.commit()
    return {"ok": True}


class BlogSummary(BaseModel):
    title: str
    slug: str
    excerpt: str
    cover_image_url: str
    author: str
    meta_description: str
    published_at: datetime | None = None


class FaqItem(BaseModel):
    question: str
    answer: str


class BlogDetail(BlogSummary):
    meta_title: str
    body_html: str
    faqs: list[FaqItem] = []


class CategoryOut(BaseModel):
    name: str
    slug: str


class WebStorySummary(BaseModel):
    title: str
    slug: str
    cover_image_url: str
    published_at: datetime | None = None


class WebStoryDetail(WebStorySummary):
    meta_description: str
    slides: list = []


@router.get("/blog", response_model=list[BlogSummary])
async def list_blogs(db: AsyncSession = Depends(get_db_session)):
    rows = await db.scalars(
        select(Blog).where(Blog.status == "published").order_by(Blog.published_at.desc().nullslast()).limit(200)
    )
    return list(rows)


@router.get("/blog-categories", response_model=list[CategoryOut])
async def list_categories(db: AsyncSession = Depends(get_db_session)):
    rows = await db.scalars(select(BlogCategory).order_by(BlogCategory.sort_order, BlogCategory.name))
    return list(rows)


@router.get("/blog/{slug}", response_model=BlogDetail)
async def get_blog(slug: str, db: AsyncSession = Depends(get_db_session)):
    blog = await db.scalar(select(Blog).where(Blog.slug == slug, Blog.status == "published"))
    if not blog:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    return blog


@router.get("/webstories", response_model=list[WebStorySummary])
async def list_webstories(db: AsyncSession = Depends(get_db_session)):
    rows = await db.scalars(
        select(WebStory).where(WebStory.status == "published").order_by(WebStory.published_at.desc().nullslast())
    )
    return list(rows)


@router.get("/webstories/{slug}", response_model=WebStoryDetail)
async def get_webstory(slug: str, db: AsyncSession = Depends(get_db_session)):
    story = await db.scalar(select(WebStory).where(WebStory.slug == slug, WebStory.status == "published"))
    if not story:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Story not found")
    return story


# ------------------------------------------------------------------- sitemap

# Static public routes. Kept here rather than in the frontend's public/ folder
# because the old hand-maintained sitemap.xml listed 12 URLs and had silently
# fallen behind the router: /free-tools and all six free tools were missing
# entirely, as was every blog post and web story. Generating it means a new
# post is discoverable the moment it is published rather than whenever someone
# remembers to edit an XML file.
_STATIC_ROUTES: list[tuple[str, str, str]] = [
    # (path, changefreq, priority)
    ("/", "weekly", "1.0"),
    ("/features", "weekly", "1.0"),
    # /free-tools is public and needs no account — the tools run off one
    # in-process page fetch via /public/analyze.
    #
    # The in-app tool screens (/tools/url, /tools/keyword, …) stay absent: those
    # sit inside RequireAuth and redirect anonymous visitors to /login. Listing
    # auth-gated URLs earns "Submitted URL requires authentication" in Search
    # Console and spends crawl budget on redirects.
    ("/free-tools", "weekly", "1.0"),
    ("/blog-title-generator", "monthly", "0.8"),
    ("/content-checker", "monthly", "0.8"),
    ("/pricing", "monthly", "0.9"),
    ("/blog", "daily", "0.8"),
    ("/guides/technical-seo", "monthly", "0.8"),
    ("/glossary", "monthly", "0.7"),
    ("/webstories", "weekly", "0.6"),
    ("/about", "yearly", "0.5"),
    ("/help", "monthly", "0.5"),
    ("/contact", "yearly", "0.5"),
    ("/privacy", "yearly", "0.3"),
    ("/terms", "yearly", "0.3"),
    ("/cookies", "yearly", "0.3"),
]


def _url_entry(loc: str, lastmod: datetime | None, changefreq: str, priority: str) -> str:
    parts = [f"<loc>{escape(loc)}</loc>"]
    if lastmod is not None:
        # W3C datetime; date alone is valid and avoids implying more precision
        # than "the post was edited that day".
        parts.append(f"<lastmod>{lastmod.date().isoformat()}</lastmod>")
    parts.append(f"<changefreq>{changefreq}</changefreq>")
    parts.append(f"<priority>{priority}</priority>")
    return "  <url>" + "".join(parts) + "</url>"


@router.get("/sitemap.xml", include_in_schema=False)
async def sitemap(db: AsyncSession = Depends(get_db_session)) -> Response:
    """XML sitemap covering the static public routes plus all published content.

    Served at the site root via an nginx exact-match location, because a
    sitemap only covers URLs at or below its own path — one living under
    /api/v1/public/ would be considered out of scope for the whole site.
    """
    base = settings.site_url.rstrip("/")
    entries = [_url_entry(f"{base}{path}", None, freq, pri) for path, freq, pri in _STATIC_ROUTES]

    posts = await db.scalars(
        select(Blog).where(Blog.status == "published").order_by(Blog.published_at.desc().nullslast())
    )
    for post in posts:
        entries.append(
            _url_entry(f"{base}/blog/{post.slug}", post.updated_at or post.published_at, "monthly", "0.7")
        )

    stories = await db.scalars(
        select(WebStory).where(WebStory.status == "published").order_by(WebStory.published_at.desc().nullslast())
    )
    for story in stories:
        # WebStory has no updated_at column, so published_at is the best signal.
        entries.append(_url_entry(f"{base}/webstories/{story.slug}", story.published_at, "monthly", "0.6"))

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(entries)
        + "\n</urlset>\n"
    )
    return Response(
        content=xml,
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=3600"},
    )


# ------------------------------------------------------------------- currency

@router.get("/currency")
async def public_currency(db: AsyncSession = Depends(get_db_session)) -> dict:
    """The site's display currency and the rates needed to convert to it.

    PUBLIC because the marketing pages price things too — /pricing and the
    landing page are the surfaces most visitors see, and an authed-only
    endpoint would have left them stuck on the base currency while the rest of
    the app followed the admin's choice.

    `base` is always the billing currency. Anything the UI renders in `code` is
    a conversion for reading; Razorpay charges `base`, which is why every
    caller also gets what it needs to show the real figure.
    """
    row = await db.scalar(select(WebsiteSettings).limit(1))
    code = (getattr(row, "display_currency", "") or "").upper()

    if not code or code == fx.BASE:
        return {"code": fx.BASE, "base": fx.BASE, "rates": {fx.BASE: 1}, "converted": False, "available": True}

    try:
        data = await fx.get_rates()
    except fx.RatesUnavailable:
        # Fall back to the billing currency rather than showing the admin's
        # chosen symbol over unconverted numbers.
        return {"code": fx.BASE, "base": fx.BASE, "rates": {fx.BASE: 1}, "converted": False, "available": False}

    rate = data["rates"].get(code)
    if not rate:
        return {"code": fx.BASE, "base": fx.BASE, "rates": {fx.BASE: 1}, "converted": False, "available": False}

    return {
        "code": code,
        "base": fx.BASE,
        "rates": {fx.BASE: 1, code: rate},
        "converted": True,
        "available": True,
        "date": data.get("date", ""),
        "stale": data.get("stale", False),
    }


@router.get("/currencies")
async def public_currencies() -> dict:
    """Every currency the admin may choose, with live rates — for the picker."""
    try:
        data = await fx.get_rates()
    except fx.RatesUnavailable:
        return {"currencies": fx.SUPPORTED_CURRENCIES, "base": fx.BASE, "rates": {}, "available": False}
    return {
        "currencies": fx.SUPPORTED_CURRENCIES,
        "base": fx.BASE,
        "rates": {
            c["code"]: data["rates"].get(c["code"])
            for c in fx.SUPPORTED_CURRENCIES
            if data["rates"].get(c["code"]) or c["code"] == fx.BASE
        },
        "date": data.get("date", ""),
        "stale": data.get("stale", False),
        "available": True,
    }
