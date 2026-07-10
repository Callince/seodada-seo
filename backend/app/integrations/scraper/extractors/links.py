"""Link graph extraction — anchors only, fetch/canonicalization deferred."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List
from urllib.parse import urlparse

from app.integrations.scraper.frontier import normalize_url
from app.integrations.scraper.parser import ParsedDoc


@dataclass
class LinkRef:
    url: str                 # canonicalized
    anchor_text: str         # stripped, collapsed whitespace
    rel: str                 # "nofollow", "sponsored", etc. (may be empty)
    is_internal: bool        # same registrable host as the page
    raw_href: str            # as it appeared in the HTML


def _same_host(a: str, b: str) -> bool:
    ha = urlparse(a).netloc.lower()
    hb = urlparse(b).netloc.lower()
    if not ha or not hb:
        return False
    # Strip leading "www." so "example.com" and "www.example.com" match
    if ha.startswith("www."):
        ha = ha[4:]
    if hb.startswith("www."):
        hb = hb[4:]
    return ha == hb


def extract_links(doc: ParsedDoc) -> List[LinkRef]:
    """Return every ``<a href>`` on the page, canonicalized and classified."""
    results: List[LinkRef] = []
    seen: set[str] = set()
    base = doc.final_url or doc.url
    for a in doc.tree.css("a[href]"):
        raw = a.attributes.get("href") or ""
        canonical = normalize_url(raw, base_url=base)
        if not canonical or canonical in seen:
            continue
        seen.add(canonical)
        anchor_text = " ".join((a.text() or "").split())
        rel = (a.attributes.get("rel") or "").strip()
        results.append(
            LinkRef(
                url=canonical,
                anchor_text=anchor_text,
                rel=rel,
                is_internal=_same_host(canonical, base),
                raw_href=raw,
            )
        )
    return results
