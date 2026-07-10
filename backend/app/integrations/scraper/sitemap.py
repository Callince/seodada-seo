"""Sitemap discovery and parsing for the spider crawler.

Uses the same ``AsyncFetcher`` (curl_cffi TLS spoofing, retries, conditional
GET) as everything else in the engine so sitemap requests are
indistinguishable from regular page requests.

Two layers:

* ``discover_sitemap_urls(domain)`` — returns the list of sitemap *file*
  URLs for a domain. Pulls from robots.txt ``Sitemap:`` directives and
  the standard well-known paths (``/sitemap.xml``, ``/sitemap_index.xml``,
  ``/wp-sitemap.xml``).
* ``parse_sitemap(url)`` / ``expand_all_urls(domain, max_urls)`` — fetches
  each sitemap, handles gzipped payloads + sitemap-index recursion, and
  returns the flat URL list with all metadata (lastmod, priority, changefreq).

The crawler can use ``expand_all_urls`` to seed itself with the site
owner's official URL list instead of guessing from anchor traversal.
"""

from __future__ import annotations

import gzip
import logging
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse

from app.integrations.scraper.fetcher import AsyncFetcher

log = logging.getLogger(__name__)


_NAMESPACES = {
    "sm": "http://www.sitemaps.org/schemas/sitemap/0.9",
    "image": "http://www.google.com/schemas/sitemap-image/1.1",
    "video": "http://www.google.com/schemas/sitemap-video/1.1",
    "xhtml": "http://www.w3.org/1999/xhtml",
    "news": "http://www.google.com/schemas/sitemap-news/0.9",
}

_COMMON_PATHS = (
    "/sitemap.xml",
    "/sitemap_index.xml",
    "/sitemap-index.xml",
    "/wp-sitemap.xml",
    "/sitemap.xml.gz",
)


@dataclass
class SitemapURL:
    loc: str
    lastmod: Optional[str] = None
    formatted_lastmod: Optional[str] = None
    changefreq: Optional[str] = None
    priority: Optional[str] = None
    image_count: int = 0
    video_count: int = 0
    alternates: list = field(default_factory=list)


@dataclass
class SitemapAnalysis:
    """Top-level result returned to the Flask route."""
    source_url: str
    is_index: bool
    sitemaps: List[dict] = field(default_factory=list)   # list of {loc, lastmod, ...}
    urls: List[SitemapURL] = field(default_factory=list) # flat URL list (after recursion)
    discovered_from: List[str] = field(default_factory=list)  # robots.txt / well-known
    errors: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Discovery
# ---------------------------------------------------------------------------


def _domain_root(url: str) -> str:
    p = urlparse(url)
    if not p.scheme or not p.netloc:
        # Allow bare hostnames like "atherenergy.com"
        if "://" not in url:
            return f"https://{url.rstrip('/')}"
        raise ValueError(f"Cannot parse domain from {url!r}")
    return f"{p.scheme}://{p.netloc}"


async def _fetch_text(fetcher: AsyncFetcher, url: str) -> Tuple[int, bytes, dict]:
    """Return ``(status, body_bytes, headers)`` for one URL."""
    r = await fetcher.fetch(url, use_cache=False)
    return r.status, (r.body_bytes or b""), r.headers


async def discover_sitemap_urls(
    domain_or_url: str,
    fetcher: Optional[AsyncFetcher] = None,
) -> Tuple[List[str], List[str]]:
    """Return ``(sitemap_urls, discovered_from)`` for a site.

    Looks at ``/robots.txt`` ``Sitemap:`` directives first (authoritative),
    then probes the well-known paths. Duplicates are removed.
    """
    root = _domain_root(domain_or_url)
    found: List[str] = []
    discovered_from: List[str] = []
    seen: Set[str] = set()

    own_fetcher = False
    if fetcher is None:
        fetcher = AsyncFetcher()
        await fetcher.open()
        own_fetcher = True

    try:
        # 1. robots.txt Sitemap: lines (authoritative)
        robots_url = f"{root}/robots.txt"
        try:
            status, body, _ = await _fetch_text(fetcher, robots_url)
            if 200 <= status < 300 and body:
                text = body.decode("utf-8", errors="replace")
                for match in re.findall(r"^\s*Sitemap:\s*(\S+)", text, flags=re.MULTILINE | re.IGNORECASE):
                    sm = match.strip()
                    # Filter non-sitemap entries: llms.txt and similar AI-crawler
                    # config files are sometimes listed as Sitemap: by sites
                    # following the new spec — they are not sitemap XML.
                    if not sm or sm in seen:
                        continue
                    lower = sm.lower()
                    if lower.endswith(".txt") and not lower.endswith(".xml.txt"):
                        log.debug("skipping non-sitemap entry from robots.txt: %s", sm)
                        continue
                    seen.add(sm)
                    found.append(sm)
                    discovered_from.append("robots.txt")
        except Exception as exc:
            log.debug("robots.txt fetch failed for %s: %s", root, exc)

        # 2. Common well-known paths — probe with HEAD-like fetches
        for path in _COMMON_PATHS:
            candidate = f"{root}{path}"
            if candidate in seen:
                continue
            try:
                status, body, _ = await _fetch_text(fetcher, candidate)
                if 200 <= status < 300 and body and (
                    b"<urlset" in body[:4096] or b"<sitemapindex" in body[:4096] or
                    candidate.endswith(".gz")
                ):
                    seen.add(candidate)
                    found.append(candidate)
                    discovered_from.append("well-known")
            except Exception:
                continue

    finally:
        if own_fetcher:
            await fetcher.close()

    return found, discovered_from


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------


def _maybe_decompress(url: str, body: bytes, headers: dict) -> bytes:
    """Decompress a sitemap if it's gzipped (by URL suffix or magic bytes)."""
    if not body:
        return body
    if body.startswith(b"\x1f\x8b"):
        try:
            return gzip.decompress(body)
        except Exception as exc:
            log.warning("Failed to gunzip sitemap %s: %s", url, exc)
            return body
    if url.endswith(".gz") or headers.get("content-encoding", "").lower() == "gzip":
        # Header lied — body wasn't actually compressed
        return body
    return body


def _format_lastmod(value: str) -> Optional[str]:
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%d", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            return datetime.strptime(value, fmt).strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            continue
    return None


def _find_first(elem, *xpaths: str):
    """Try each xpath in order, return the first non-None result.

    Avoids the ``Element`` truthiness gotcha (an element with no children
    evaluates to False, which breaks ``or`` chains).
    """
    for xp in xpaths:
        if ":" in xp:
            found = elem.find(xp, _NAMESPACES)
        else:
            found = elem.find(xp)
        if found is not None:
            return found
    return None


def _parse_url_element(elem) -> Optional[SitemapURL]:
    loc_elem = _find_first(elem, "./sm:loc", "./loc")
    if loc_elem is None or not (loc_elem.text or "").strip():
        return None

    url = SitemapURL(loc=loc_elem.text.strip())

    lastmod_elem = _find_first(elem, "./sm:lastmod", "./lastmod")
    if lastmod_elem is not None and (lastmod_elem.text or "").strip():
        url.lastmod = lastmod_elem.text.strip()
        url.formatted_lastmod = _format_lastmod(url.lastmod)

    cf = _find_first(elem, "./sm:changefreq", "./changefreq")
    if cf is not None and (cf.text or "").strip():
        url.changefreq = cf.text.strip()

    pr = _find_first(elem, "./sm:priority", "./priority")
    if pr is not None and (pr.text or "").strip():
        url.priority = pr.text.strip()

    url.image_count = len(elem.findall("./image:image", _NAMESPACES))
    url.video_count = len(elem.findall("./video:video", _NAMESPACES))

    for alt in elem.findall("./xhtml:link", _NAMESPACES):
        if alt.get("rel") == "alternate":
            url.alternates.append({"href": alt.get("href"), "hreflang": alt.get("hreflang")})

    return url


def _parse_sitemap_index(root) -> List[dict]:
    out = []
    sm_elems = root.findall(".//sm:sitemap", _NAMESPACES)
    if not sm_elems:
        sm_elems = root.findall(".//sitemap")
    for sm_elem in sm_elems:
        loc_elem = _find_first(sm_elem, "./sm:loc", "./loc")
        if loc_elem is None or not (loc_elem.text or "").strip():
            continue
        entry = {"loc": loc_elem.text.strip()}
        lastmod_elem = _find_first(sm_elem, "./sm:lastmod", "./lastmod")
        if lastmod_elem is not None and (lastmod_elem.text or "").strip():
            entry["lastmod"] = lastmod_elem.text.strip()
            entry["formatted_lastmod"] = _format_lastmod(entry["lastmod"])
        out.append(entry)
    return out


async def parse_sitemap(
    sitemap_url: str,
    fetcher: Optional[AsyncFetcher] = None,
) -> Tuple[bool, List[dict], List[SitemapURL]]:
    """Fetch and parse one sitemap.

    Returns ``(is_index, child_sitemaps, urls)``:

    * ``is_index`` — True if the sitemap is a ``<sitemapindex>`` (children
      are themselves sitemaps; recursion needed).
    * ``child_sitemaps`` — list of ``{loc, lastmod, ...}`` entries when
      ``is_index`` is True.
    * ``urls`` — flat list of ``SitemapURL`` when this is a regular
      ``<urlset>`` sitemap.
    """
    own_fetcher = False
    if fetcher is None:
        fetcher = AsyncFetcher()
        await fetcher.open()
        own_fetcher = True

    try:
        status, body, headers = await _fetch_text(fetcher, sitemap_url)
        if not (200 <= status < 300) or not body:
            raise ValueError(f"Failed to fetch sitemap {sitemap_url}: HTTP {status}")

        body = _maybe_decompress(sitemap_url, body, headers)
        text = body.decode("utf-8", errors="replace")
        text = re.sub(r"<\?xml[^>]+\?>", "", text).strip()

        try:
            root = ET.fromstring(text)
        except ET.ParseError as exc:
            raise ValueError(f"Sitemap XML parse error for {sitemap_url}: {exc}")

        tag = root.tag.split("}", 1)[-1].lower()
        if tag == "sitemapindex":
            return True, _parse_sitemap_index(root), []
        elif tag == "urlset":
            urls: List[SitemapURL] = []
            url_elems = root.findall(".//sm:url", _NAMESPACES)
            if not url_elems:
                url_elems = root.findall(".//url")
            for el in url_elems:
                parsed = _parse_url_element(el)
                if parsed is not None:
                    urls.append(parsed)
            return False, [], urls
        else:
            raise ValueError(f"Unrecognized sitemap root tag <{tag}> at {sitemap_url}")

    finally:
        if own_fetcher:
            await fetcher.close()


# ---------------------------------------------------------------------------
# Top-level: discover + parse + recurse
# ---------------------------------------------------------------------------


async def expand_all_urls(
    domain_or_url: str,
    *,
    max_urls: int = 5000,
    max_sitemap_recursion: int = 50,
    fetcher: Optional[AsyncFetcher] = None,
) -> SitemapAnalysis:
    """Discover, parse, and flatten every sitemap for ``domain``.

    Stops after ``max_urls`` URLs have been collected. Sitemap-index
    children are recursed up to ``max_sitemap_recursion`` total sitemap
    files (a small per-domain safety bound; most sites have <10).
    """
    own_fetcher = False
    if fetcher is None:
        fetcher = AsyncFetcher()
        await fetcher.open()
        own_fetcher = True

    analysis = SitemapAnalysis(source_url=_domain_root(domain_or_url), is_index=False)

    try:
        sitemap_urls, discovered_from = await discover_sitemap_urls(domain_or_url, fetcher=fetcher)
        analysis.sitemaps = [{"loc": u} for u in sitemap_urls]
        analysis.discovered_from = discovered_from

        if not sitemap_urls:
            analysis.errors.append("No sitemap found via robots.txt or well-known paths.")
            return analysis

        queue: List[str] = list(sitemap_urls)
        seen_sitemaps: Set[str] = set()
        sitemaps_processed = 0

        while queue and len(analysis.urls) < max_urls and sitemaps_processed < max_sitemap_recursion:
            sm_url = queue.pop(0)
            if sm_url in seen_sitemaps:
                continue
            seen_sitemaps.add(sm_url)
            sitemaps_processed += 1

            try:
                is_idx, children, urls = await parse_sitemap(sm_url, fetcher=fetcher)
            except Exception as exc:
                analysis.errors.append(f"{sm_url}: {exc}")
                continue

            if is_idx:
                analysis.is_index = True
                for child in children:
                    if child["loc"] not in seen_sitemaps:
                        queue.append(child["loc"])
            else:
                remaining = max_urls - len(analysis.urls)
                analysis.urls.extend(urls[:remaining])

        return analysis

    finally:
        if own_fetcher:
            await fetcher.close()
