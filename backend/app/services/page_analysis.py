"""On-page analysis tools — URL, Keyword, Heading, Image, Meta, Sitemap.

The six seodada analysis tools, powered by the ported Phase-2 scraper: one
curl_cffi fetch + selectolax parse + the extractors produce every breakdown, so
these run in-process at $0 (no DataForSEO). `analyze_page` returns all sections
at once; the six frontend tools each render their slice.
"""
from __future__ import annotations

import re
from urllib.parse import urljoin, urlparse

from app.integrations.scraper import Persona, get_config
from app.integrations.scraper.blocking import block_message, detect_block
from app.integrations.scraper.extractors import (
    extract_headings,
    extract_images,
    extract_links,
    extract_meta,
    extract_text,
)
from app.integrations.scraper.fetcher import AsyncFetcher
from app.integrations.scraper.parser import parse_html
from app.services import density


class AnalyzeError(Exception):
    pass


def _normalize(url: str) -> str:
    url = (url or "").strip()
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    return url


async def _fetch_doc(url: str):
    cfg = get_config()
    async with AsyncFetcher(persona=Persona.random(cfg), config=cfg) as f:
        # Always fetch a full body — the ETag cache only stores a content hash
        # (for the crawler's change-detection), so it can't serve a body on 304.
        # Repeat-view speed comes from result-caching at the endpoint instead.
        fetch = await f.fetch(url, use_cache=False)
    blocked = detect_block(fetch.status, fetch.headers, fetch.body)
    if blocked:
        raise AnalyzeError(block_message(urlparse(url).hostname or url, blocked, fetch.status))
    if fetch.error or not (fetch.body or "").strip():
        raise AnalyzeError(f"Could not fetch the page (status {fetch.status}).")
    doc = parse_html(
        fetch.body, url=url, final_url=fetch.final_url, status=fetch.status, headers=fetch.headers
    )
    return doc, fetch


def _schema_types(blocks: list) -> list[str]:
    """Flatten every @type across the JSON-LD blocks (handles @graph and lists)."""
    types: list[str] = []

    def collect(obj) -> None:
        if isinstance(obj, dict):
            graph = obj.get("@graph")
            if isinstance(graph, list):
                for g in graph:
                    collect(g)
            t = obj.get("@type")
            if isinstance(t, str):
                types.append(t)
            elif isinstance(t, list):
                types.extend(x for x in t if isinstance(x, str))

    for b in blocks:
        collect(b)
    # de-dupe, keep order
    seen: set[str] = set()
    return [t for t in types if not (t in seen or seen.add(t))]


def _len_check(value: str | None, lo: int, hi: int) -> str:
    n = len(value or "")
    if n == 0:
        return "missing"
    if n < lo:
        return "too_short"
    if n > hi:
        return "too_long"
    return "ok"


async def analyze_page(raw_url: str, refresh: bool = False) -> dict:
    """Fetch one URL and return the full on-page analysis (all six sections).
    `refresh=True` bypasses the fetch cache and pulls the page live."""
    url = _normalize(raw_url)
    host = urlparse(url).hostname or ""
    if not await density._is_public_host(host):  # noqa: SLF001 — SSRF guard
        raise AnalyzeError("That domain could not be resolved. Check the URL.")

    doc, fetch = await _fetch_doc(url)
    meta = extract_meta(doc)
    headings = extract_headings(doc)
    images = extract_images(doc)
    links = extract_links(doc)
    text = extract_text(doc)
    body_text = (getattr(text, "main_text", "") or getattr(text, "full_text", "") or "")
    words = density.word_count(body_text)
    final = fetch.final_url or url
    parsed = urlparse(final)

    # --- URL section ---
    depth = len([p for p in parsed.path.split("/") if p])
    slug = (parsed.path.rstrip("/").split("/")[-1]) if parsed.path.strip("/") else ""
    robots_lc = (meta.robots or "").lower()
    internal_links = [l for l in links if getattr(l, "is_internal", False)]
    external_links = [l for l in links if not getattr(l, "is_internal", False)]
    nofollow_links = [l for l in links if "nofollow" in (getattr(l, "rel", "") or "").lower()]

    def _chk(label: str, status: str, detail: str) -> dict:
        return {"label": label, "status": status, "detail": detail}

    url_checks = [
        _chk("HTTPS", "ok" if parsed.scheme == "https" else "danger",
             "Served over HTTPS." if parsed.scheme == "https" else "Not secure — page is served over HTTP."),
        _chk("URL length", "ok" if len(final) <= 90 else "warning",
             f"{len(final)} characters." + ("" if len(final) <= 90 else " Long URLs are harder to share and read.")),
        _chk("Lowercase", "ok" if parsed.path == parsed.path.lower() else "warning",
             "Path is lowercase." if parsed.path == parsed.path.lower() else "Path has uppercase letters — prefer all-lowercase URLs."),
        _chk("Word separators", "ok" if "_" not in parsed.path else "warning",
             "Uses hyphens." if "_" not in parsed.path else "Uses underscores — Google prefers hyphens between words."),
        _chk("Depth", "ok" if depth <= 4 else "warning",
             f"{depth} levels deep." + ("" if depth <= 4 else " Deep pages get crawled less often.")),
        _chk("Clean URL", "ok" if not parsed.query else "warning",
             "No query parameters." if not parsed.query else "Has query parameters — prefer clean, static paths."),
        _chk("Canonical", "ok" if meta.canonical else "warning",
             "Canonical tag present." if meta.canonical else "No canonical tag — add one to avoid duplicate-content issues."),
        _chk("Indexable", "danger" if "noindex" in robots_lc else "ok",
             "Blocked by a noindex robots directive." if "noindex" in robots_lc else "Page is indexable."),
    ]

    url_section = {
        "input_url": url,
        "final_url": final,
        "status_code": fetch.status,
        "redirected": final.rstrip("/") != url.rstrip("/"),
        "https": parsed.scheme == "https",
        "path_depth": depth,
        "slug": slug,
        "length": len(final),
        "has_query": bool(parsed.query),
        "robots_meta": meta.robots or "",
        "canonical": meta.canonical or "",
        "internal_links": len(internal_links),
        "external_links": len(external_links),
        "checks": url_checks,
    }

    # --- Links section ---
    # Sample so the UI's type filters always have rows: external + nofollow links
    # are the interesting minority and often sit near the end of the page (footer,
    # socials), so include them all first, then fill with internal up to the cap.
    _seen_urls: set[str] = set()
    _sample_links: list = []
    for _group in (external_links, nofollow_links, internal_links):
        for _l in _group:
            if _l.url in _seen_urls:
                continue
            _seen_urls.add(_l.url)
            _sample_links.append(_l)
            if len(_sample_links) >= 400:
                break
        if len(_sample_links) >= 400:
            break

    links_section = {
        "internal_count": len(internal_links),
        "external_count": len(external_links),
        "nofollow_count": len(nofollow_links),
        "total": len(links),
        "samples": [
            {
                "url": l.url,
                "anchor": (l.anchor_text or "")[:100],
                "rel": l.rel or "",
                "internal": l.is_internal,
                "nofollow": "nofollow" in (l.rel or "").lower(),
            }
            for l in _sample_links
        ],
    }

    # --- Heading (H-tag) section ---
    h_items = [{"level": h.level, "text": h.text} for h in headings]
    counts = {f"h{n}": sum(1 for h in headings if h.level == n) for n in range(1, 7)}
    h_issues = []
    if counts["h1"] == 0:
        h_issues.append("No H1 tag on the page.")
    elif counts["h1"] > 1:
        h_issues.append(f"{counts['h1']} H1 tags — a page should have exactly one.")
    levels = [h.level for h in headings]
    for i in range(1, len(levels)):
        if levels[i] - levels[i - 1] > 1:
            h_issues.append("Heading levels skip (e.g. H2 → H4) — keep the hierarchy sequential.")
            break
    h1_text = next((h.text for h in headings if h.level == 1), "")
    heading_section = {"counts": counts, "items": h_items[:100], "issues": h_issues, "h1_text": h1_text}

    # --- Image section ---
    img_items = [
        {
            "src": (im.url or im.raw_src or "")[:300],
            "alt": im.alt or "",
            "title": im.title or "",
            "width": im.width,
            "height": im.height,
            "loading": im.loading or "",
            "has_alt": bool((im.alt or "").strip()),
            "has_dimensions": bool(im.width and im.height),
            "lazy": (im.loading or "").lower() == "lazy",
        }
        for im in images
    ]
    missing_alt = sum(1 for im in img_items if not im["has_alt"])
    image_section = {
        "total": len(img_items),
        "missing_alt": missing_alt,
        "with_alt": len(img_items) - missing_alt,
        "lazy_count": sum(1 for im in img_items if im["lazy"]),
        "dimensioned_count": sum(1 for im in img_items if im["has_dimensions"]),
        "items": img_items[:100],
    }

    # --- Meta section ---
    meta_section = {
        "title": meta.title or "",
        "title_length": len(meta.title or ""),
        "title_check": _len_check(meta.title, 10, 60),
        "description": meta.description or "",
        "description_length": len(meta.description or ""),
        "description_check": _len_check(meta.description, 70, 160),
        "canonical": meta.canonical or "",
        "robots": meta.robots or "",
        "viewport": meta.viewport or "",
        "charset": meta.charset or "",
        "language": meta.language or "",
        "open_graph": dict(meta.open_graph or {}),
        "twitter": dict(meta.twitter or {}),
        "schema_types": _schema_types(meta.json_ld or []),
        "schema_blocks": (meta.json_ld or [])[:10],  # cap payload
    }

    # --- Keyword section ---
    # density() returns {keyword, frequency, density}; normalise to the shape the
    # UI renders and split single words from multi-word phrases.
    rows = density.density(body_text, None, top_n=15)
    def _kw(r: dict) -> dict:
        return {"phrase": r["keyword"], "count": r["frequency"], "density": r["density"]}
    top_keywords = [_kw(r) for r in rows if " " not in r["keyword"]]
    top_phrases = [_kw(r) for r in rows if " " in r["keyword"]]
    unique_words = len(set(re.findall(r"[a-z0-9']+", body_text.lower())))
    keyword_section = {
        "word_count": words,
        "unique_words": unique_words,
        "reading_time_min": max(1, round(words / 200)) if words else 0,
        "top_keywords": top_keywords,
        "top_phrases": top_phrases,
    }

    return {
        "url": url_section,
        "links": links_section,
        "headings": heading_section,
        "images": image_section,
        "meta": meta_section,
        "keywords": keyword_section,
        # `from_cache` = the page body was served from the (revalidated) fetch cache.
        "fetch": {"from_cache": bool(getattr(fetch, "from_cache", False)), "status": fetch.status},
    }


_LOC_RE = re.compile(r"<loc>\s*([^<\s]+)\s*</loc>", re.I)


async def analyze_sitemap(raw_url: str, refresh: bool = False) -> dict:
    """Discover and summarise a site's XML sitemap(s). `refresh=True` bypasses cache."""
    url = _normalize(raw_url)
    host = urlparse(url).hostname or ""
    if not await density._is_public_host(host):  # noqa: SLF001
        raise AnalyzeError("That domain could not be resolved. Check the URL.")
    origin = f"{urlparse(url).scheme}://{host}"
    use_cache = False  # sitemap XML fetched fresh; endpoint result-caches the summary

    cfg = get_config()
    sitemaps: list[str] = []
    async with AsyncFetcher(persona=Persona.random(cfg), config=cfg) as f:
        # robots.txt Sitemap: directives first, then the conventional path.
        robots = await f.fetch(urljoin(origin, "/robots.txt"), use_cache=use_cache)
        blocked = detect_block(robots.status, robots.headers, robots.body)
        if blocked:
            raise AnalyzeError(block_message(host, blocked, robots.status))
        for line in (robots.body or "").splitlines():
            if line.lower().startswith("sitemap:"):
                sitemaps.append(line.split(":", 1)[1].strip())
        if not sitemaps:
            sitemaps = [urljoin(origin, "/sitemap.xml")]

        seen: set[str] = set()
        page_urls: list[str] = []
        child_sitemaps: list[str] = []
        for sm in sitemaps[:5]:
            if sm in seen:
                continue
            seen.add(sm)
            resp = await f.fetch(sm, use_cache=use_cache)
            if resp.error or "<loc" not in (resp.body or "").lower():
                continue
            locs = _LOC_RE.findall(resp.body)
            is_index = "<sitemapindex" in resp.body.lower()
            if is_index:
                child_sitemaps.extend(locs)
                # Expand one level of the index.
                for child in locs[:5]:
                    if child in seen:
                        continue
                    seen.add(child)
                    cr = await f.fetch(child, use_cache=use_cache)
                    if not cr.error:
                        page_urls.extend(_LOC_RE.findall(cr.body))
            else:
                page_urls.extend(locs)

    return {
        "sitemaps_found": sitemaps,
        "is_index": bool(child_sitemaps),
        "child_sitemaps": child_sitemaps[:50],
        "total_urls": len(page_urls),
        # Feed the whole set to the structure graph. Capped only to protect the
        # browser on pathologically huge sitemaps (tens of thousands of URLs);
        # the graph shows a "showing N of M" note when it trims.
        "sample_urls": page_urls[:20000],
    }
