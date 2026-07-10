"""Single-parse HTML wrapper using selectolax (lexbor backend).

The core rule of the tiered crawler: parse each page exactly once,
then hand the parsed tree to every extractor that needs it. This
replaces the pattern where link_analyzer, text_extractor, seo_analyzer,
etc. each fetched and parsed the same URL independently.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

try:
    from selectolax.lexbor import LexborHTMLParser as _HTMLParser
except ImportError:  # pragma: no cover — fall back to modest if lexbor unavailable
    from selectolax.parser import HTMLParser as _HTMLParser  # type: ignore

from app.integrations.scraper.config import CrawlerConfig, get_config


@dataclass
class ParsedDoc:
    """A parsed HTML document plus metadata carried from the fetch step.

    Downstream extractors read ``tree`` (the selectolax parser). They must
    not re-fetch the URL — everything they need should come from this
    object or be computed from it.
    """

    url: str
    final_url: str           # after redirects
    status: int
    tree: _HTMLParser
    headers: dict            # response headers (lower-cased keys)
    raw_html: str            # kept for trafilatura and fallbacks
    from_cache: bool = False
    fetched_with_js: bool = False
    word_count: int = 0
    text: str = ""
    extras: dict = field(default_factory=dict)  # extractor scratch space


def parse_html(
    html: str,
    url: str = "",
    status: int = 200,
    headers: Optional[dict] = None,
    final_url: Optional[str] = None,
    fetched_with_js: bool = False,
) -> ParsedDoc:
    """Parse HTML once and return a ``ParsedDoc`` ready for extractors."""
    tree = _HTMLParser(html or "")
    text = tree.text(separator=" ", strip=True) if tree.body else ""
    return ParsedDoc(
        url=url,
        final_url=final_url or url,
        status=status,
        tree=tree,
        headers={k.lower(): v for k, v in (headers or {}).items()},
        raw_html=html,
        fetched_with_js=fetched_with_js,
        word_count=len(text.split()) if text else 0,
        text=text,
    )


def needs_js(doc: ParsedDoc, config: Optional[CrawlerConfig] = None) -> bool:
    """Emptiness detector — decide whether tier-5 (Playwright) is needed.

    Heuristic: if the body is nearly empty but the page has SPA markers
    (script-heavy, ``<div id="root">``, ``__NEXT_DATA__``, ``ng-version``),
    the HTML we got is a shell and we need a real browser to execute it.
    Pages already fetched with JS never re-escalate.
    """
    if doc.fetched_with_js:
        return False

    cfg = config or get_config()
    tree = doc.tree

    text_len = len(doc.text)
    script_count = len(tree.css("script"))
    has_root = bool(
        tree.css_first("#root")
        or tree.css_first("#app")
        or tree.css_first("[ng-version]")
    )
    has_next_data = bool(tree.css_first("script#__NEXT_DATA__"))

    if text_len < cfg.empty_body_char_threshold and script_count > cfg.empty_body_script_count:
        return True
    if has_root and text_len < cfg.spa_root_char_threshold:
        return True
    if has_next_data and text_len < cfg.spa_root_char_threshold:
        return True

    return False
