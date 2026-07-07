"""Local, $0 On-Page analysis.

Fetches the page in-process (SSRF-guarded via `density`), extracts meta/heading
structure with the stdlib HTML parser, and computes readability + a heuristic
content score locally — no DataForSEO call. Returns a `DfsResult` (cost 0) whose
single result row matches the shape produced by `dataforseo.onpage.parse_*`.
"""
from __future__ import annotations

import json
import re
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

from app.core.logging import log
from app.integrations.dataforseo.client import DfsResult
from app.services import density, pixels, scoring

_VOWEL_GROUP = re.compile(r"[aeiouy]+")
_SENTENCE = re.compile(r"[.!?]+")


class _MetaParser(HTMLParser):
    """Extracts the SEO-relevant structure of a page: title, meta description,
    heading text, images/alt, links, indexability tags, social cards and
    JSON-LD structured-data types.
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title: str | None = None
        self.meta_description: str | None = None
        self.h1: list[str] = []
        self.h2: list[str] = []
        self.h3: list[str] = []
        self.lang: str | None = None
        self.canonical: str | None = None
        self.robots: str | None = None
        self.has_viewport: bool = False
        self.og: dict[str, str] = {}
        self.twitter: dict[str, str] = {}
        self.images: list[dict] = []  # {"src": str, "alt": str | None}
        self.hrefs: list[str] = []
        self.jsonld_raw: list[str] = []
        self._capture_tag: str | None = None
        self._capture_kind: str | None = None
        self._buf: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag == "html" and self.lang is None:
            self.lang = (a.get("lang") or "").strip() or None
        elif tag == "title" and self.title is None:
            self._start_capture("title", "title")
        elif tag in ("h1", "h2", "h3"):
            self._start_capture(tag, tag)
        elif tag == "img":
            alt = a.get("alt")
            src = (a.get("src") or a.get("data-src") or "").strip()
            self.images.append({"src": src, "alt": (alt.strip() if alt else None) or None})
        elif tag == "a" and a.get("href"):
            self.hrefs.append(a["href"].strip())
        elif tag == "link" and "canonical" in a.get("rel", "").lower():
            self.canonical = (a.get("href") or "").strip() or None
        elif tag == "script" and "ld+json" in a.get("type", "").lower():
            self._start_capture("jsonld", "script")
        elif tag == "meta":
            name = a.get("name", "").lower()
            prop = a.get("property", "").lower()
            content = (a.get("content") or "").strip()
            if name == "description" and self.meta_description is None:
                self.meta_description = content or None
            elif name == "robots":
                self.robots = content.lower() or None
            elif name == "viewport":
                self.has_viewport = True
            elif prop.startswith("og:"):
                self.og[prop] = content
            elif name.startswith("twitter:"):
                self.twitter[name] = content

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if self._capture_tag and tag == self._capture_tag:
            raw = "".join(self._buf)
            kind = self._capture_kind
            if kind == "jsonld":
                self.jsonld_raw.append(raw)
            else:
                text = " ".join(raw.split()).strip()
                if kind == "title":
                    self.title = text or None
                elif kind == "h1" and text:
                    self.h1.append(text)
                elif kind == "h2" and text:
                    self.h2.append(text)
                elif kind == "h3" and text:
                    self.h3.append(text)
            self._capture_tag = self._capture_kind = None
            self._buf = []

    def handle_data(self, data: str) -> None:
        if self._capture_tag:
            self._buf.append(data)

    def _start_capture(self, kind: str, tag: str) -> None:
        self._capture_kind = kind
        self._capture_tag = tag
        self._buf = []


def _syllables(word: str) -> int:
    groups = _VOWEL_GROUP.findall(word.lower())
    count = len(groups)
    if word.lower().endswith("e") and count > 1:
        count -= 1  # silent trailing 'e'
    return max(1, count)


def _readability(text: str) -> dict:
    words = density._tokens(text)  # noqa: SLF001 — shared tokenizer
    n_words = len(words)
    sentences = max(1, len([s for s in _SENTENCE.split(text) if s.strip()]))
    if n_words == 0:
        return {"ari": None, "flesch_kincaid": None}
    chars = sum(len(w) for w in words)
    syllables = sum(_syllables(w) for w in words)
    ari = 4.71 * (chars / n_words) + 0.5 * (n_words / sentences) - 21.43
    fk = 0.39 * (n_words / sentences) + 11.8 * (syllables / n_words) - 15.59
    return {"ari": round(ari, 1), "flesch_kincaid": round(fk, 1)}


def _jsonld_types(raw_list: list[str]) -> list[str]:
    """Collect schema.org @type values from JSON-LD blocks."""
    types: list[str] = []

    def walk(node: object) -> None:
        if isinstance(node, dict):
            t = node.get("@type")
            if isinstance(t, str):
                types.append(t)
            elif isinstance(t, list):
                types.extend(x for x in t if isinstance(x, str))
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    for raw in raw_list:
        try:
            walk(json.loads(raw))
        except (ValueError, TypeError):
            continue
    # De-duplicate, preserve order.
    seen: set[str] = set()
    return [t for t in types if not (t in seen or seen.add(t))]


def _classify_links(hrefs: list[str], base_url: str) -> tuple[int, int]:
    """Count internal vs external links relative to the page's host."""
    base_host = urlparse(base_url).hostname or ""
    internal = external = 0
    for href in hrefs:
        h = href.strip()
        if not h or h.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
            continue
        host = urlparse(urljoin(base_url, h)).hostname or ""
        if not host or host == base_host:
            internal += 1
        else:
            external += 1
    return internal, external


def _indexability(parser: _MetaParser, schema_types: list[str]) -> dict:
    robots = parser.robots or ""
    return {
        "canonical": parser.canonical,
        "noindex": "noindex" in robots,
        "nofollow": "nofollow" in robots,
        "robots": parser.robots,
        "has_viewport": parser.has_viewport,
        "lang": parser.lang,
        "open_graph": bool(parser.og),
        "twitter_card": bool(parser.twitter),
        "schema_types": schema_types,
    }


def _image_audit(parser: _MetaParser, base_url: str, target_keyword: str | None) -> dict:
    kw = (target_keyword or "").strip().lower()
    items: list[dict] = []
    missing = 0
    with_kw = False
    for img in parser.images:
        alt = img["alt"]
        src = img["src"]
        abs_src = urljoin(base_url, src) if src else ""
        has_alt = bool(alt)
        if not has_alt:
            missing += 1
        elif kw and kw in alt.lower():
            with_kw = True
        items.append({"src": abs_src, "alt": alt, "has_alt": has_alt})
    # Missing-alt images first so they're easy to spot; cap the list for payload size.
    items.sort(key=lambda x: x["has_alt"])
    return {
        "total": len(parser.images),
        "missing_alt": missing,
        "with_keyword_alt": with_kw,
        "items": items[:100],
    }


def extract_page(raw: str, url: str, target_keyword: str | None) -> dict:
    """Parse meta/headings, compute readability + density, and build the
    `scoring.PageSignals` for the rubric. Shared by the local provider and the
    DataForSEO overlay so both get the identical On-Page model.
    """
    parser = _MetaParser()
    try:
        parser.feed(raw)
    except Exception as exc:  # malformed HTML — keep whatever we parsed
        log.info("local_onpage_parse_warn", url=url, reason=str(exc))

    text = density.extract_text(raw)
    word_count = density.word_count(text)
    density_rows = density.density(text, target_keyword)
    readability = _readability(text)
    freq, dens = (
        density.keyword_frequency(text, target_keyword) if target_keyword else (0, 0.0)
    )

    schema_types = _jsonld_types(parser.jsonld_raw)
    indexability = _indexability(parser, schema_types)
    images = _image_audit(parser, url, target_keyword)
    internal_links, external_links = _classify_links(parser.hrefs, url)
    snippet = pixels.snippet_preview(parser.title, parser.meta_description, url)

    signals = scoring.PageSignals(
        url=url,
        title=parser.title,
        meta_description=parser.meta_description,
        h1=parser.h1,
        h2=parser.h2,
        word_count=word_count,
        readability_fk=readability.get("flesch_kincaid"),
        target_keyword=target_keyword,
        keyword_frequency=freq,
        keyword_density=dens,
        intro_text=density.first_words(text),
        noindex=indexability["noindex"],
        images_total=images["total"],
        images_missing_alt=images["missing_alt"],
        keyword_in_alt=images["with_keyword_alt"],
        internal_links=internal_links,
        external_links=external_links,
        has_schema=bool(schema_types),
        title_fits_px=not snippet["title"]["truncated"],
        meta_fits_px=not snippet["meta_description"]["truncated"],
    )
    return {
        "title": parser.title,
        "meta_description": parser.meta_description,
        "h1": parser.h1[:10],
        "h2": parser.h2[:15],
        "h3": parser.h3[:20],
        "word_count": word_count,
        "readability": readability,
        "keyword_density": density_rows,
        "signals": signals,
        "snippet": snippet,
        "images": images,
        "indexability": indexability,
        "links": {"internal": internal_links, "external": external_links},
        "text": text,
        "page_terms": density.doc_terms(text),
        "heading_count": len(parser.h1) + len(parser.h2) + len(parser.h3),
    }


def _degraded(reason: str) -> DfsResult:
    return DfsResult(
        result=[
            {
                "content_score": None,
                "technical_score": None,
                "word_count": None,
                "readability": {"ari": None, "flesch_kincaid": None},
                "keyword_density": [],
                "title": None,
                "meta_description": None,
                "h1": [],
                "h2": [],
                "h3": [],
                "subscores": [],
                "issues": [f"could not fetch page: {reason}"],
                "recommendations": [],
                "keyword_analysis": None,
                "snippet": None,
                "images": None,
                "indexability": None,
                "links": None,
                "page_terms": {},
                "heading_count": 0,
            }
        ],
        cost_cents=0,
    )


async def analyze(url: str, target_keyword: str | None) -> DfsResult:
    """Fetch + analyze the page locally. Never raises — degrades gracefully."""
    try:
        raw = await density.fetch_html(url)
    except density.FetchError as exc:
        log.info("local_onpage_fetch_failed", url=url, reason=str(exc))
        return _degraded(str(exc))

    page = extract_page(raw, url, target_keyword)
    ev = scoring.evaluate(page["signals"])
    log.info("local_onpage", url=url, words=page["word_count"], score=ev["score"])

    return DfsResult(
        result=[
            {
                "content_score": ev["score"],
                "technical_score": None,
                "word_count": page["word_count"],
                "readability": page["readability"],
                "keyword_density": page["keyword_density"],
                "title": page["title"],
                "meta_description": page["meta_description"],
                "h1": page["h1"],
                "h2": page["h2"],
                "h3": page["h3"],
                "subscores": ev["subscores"],
                "issues": ev["issues"],
                "recommendations": ev["recommendations"],
                "keyword_analysis": ev["keyword_analysis"],
                "snippet": page["snippet"],
                "images": page["images"],
                "indexability": page["indexability"],
                "links": page["links"],
                "page_terms": page["page_terms"],
                "heading_count": page["heading_count"],
            }
        ],
        cost_cents=0,
    )
