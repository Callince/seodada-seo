"""Meta tag extractor — title, description, canonical, OpenGraph, Twitter, JSON-LD."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from app.integrations.scraper.parser import ParsedDoc


@dataclass
class MetaData:
    title: Optional[str] = None
    description: Optional[str] = None
    canonical: Optional[str] = None
    robots: Optional[str] = None
    viewport: Optional[str] = None
    language: Optional[str] = None
    charset: Optional[str] = None
    open_graph: Dict[str, str] = field(default_factory=dict)
    twitter: Dict[str, str] = field(default_factory=dict)
    other: Dict[str, str] = field(default_factory=dict)
    # Parsed Schema.org JSON-LD blocks (<script type="application/ld+json">).
    json_ld: List[Any] = field(default_factory=list)


def _text_of(node) -> Optional[str]:
    if node is None:
        return None
    t = node.text(strip=True) if hasattr(node, "text") else None
    return t or None


def extract_meta(doc: ParsedDoc) -> MetaData:
    tree = doc.tree
    md = MetaData()

    md.title = _text_of(tree.css_first("title"))

    html = tree.css_first("html")
    if html is not None:
        md.language = html.attributes.get("lang")

    for meta in tree.css("meta"):
        attrs = meta.attributes
        name = (attrs.get("name") or "").lower()
        prop = (attrs.get("property") or "").lower()
        content = attrs.get("content") or ""
        if not content and not attrs.get("charset"):
            continue

        if attrs.get("charset"):
            md.charset = attrs.get("charset")
            continue
        if name == "description":
            md.description = content
        elif name == "robots":
            md.robots = content
        elif name == "viewport":
            md.viewport = content
        elif prop.startswith("og:"):
            md.open_graph[prop[3:]] = content
        elif name.startswith("twitter:"):
            md.twitter[name[8:]] = content
        elif name:
            md.other[name] = content

    canonical_link = tree.css_first('link[rel="canonical"]')
    if canonical_link is not None:
        md.canonical = canonical_link.attributes.get("href")

    # Schema.org structured data — parse each JSON-LD script block.
    for script in tree.css('script[type="application/ld+json"]'):
        raw = (script.text(deep=True) or "").strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except (ValueError, TypeError):
            continue  # malformed JSON-LD — skip it
        if isinstance(data, list):
            md.json_ld.extend(data)
        else:
            md.json_ld.append(data)

    return md
