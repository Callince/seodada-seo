"""Main content / text extraction using trafilatura.

Trafilatura handles boilerplate removal, encoding, and article detection
far better than any hand-rolled tag filter. We feed it the *raw HTML*
(not the selectolax tree) because trafilatura has its own parser that
knows about comments, tables, lists, etc.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

try:
    import trafilatura
    from trafilatura.settings import use_config as _traf_use_config
except ImportError:  # pragma: no cover
    trafilatura = None  # type: ignore
    _traf_use_config = None  # type: ignore

from app.integrations.scraper.parser import ParsedDoc


@dataclass
class TextExtract:
    main_text: str          # the "readable" article text
    full_text: str          # fallback: full DOM text (from ParsedDoc)
    word_count: int
    language: Optional[str] = None


_TRAF_CFG = None


def _traf_config():
    global _TRAF_CFG
    if _TRAF_CFG is not None or _traf_use_config is None:
        return _TRAF_CFG
    cfg = _traf_use_config()
    # Trafilatura 2.x — disable signal-based timeouts (unsupported on Windows)
    try:
        cfg.set("DEFAULT", "EXTRACTION_TIMEOUT", "0")
    except Exception:
        pass
    _TRAF_CFG = cfg
    return cfg


def extract_text(doc: ParsedDoc) -> TextExtract:
    """Return both the trafilatura-cleaned main text and full DOM text."""
    main_text = ""
    language: Optional[str] = None
    if trafilatura is not None and doc.raw_html:
        try:
            extracted = trafilatura.extract(
                doc.raw_html,
                url=doc.final_url or doc.url,
                favor_precision=True,
                include_comments=False,
                include_tables=True,
                config=_traf_config(),
            )
            if extracted:
                main_text = extracted
        except Exception:
            main_text = ""

    full_text = doc.text
    word_count = len(main_text.split()) if main_text else doc.word_count

    return TextExtract(
        main_text=main_text,
        full_text=full_text,
        word_count=word_count,
        language=language,
    )


# Tags whose text is worth showing as its own line, in rough reading order of
# SEO weight. Anything not listed (div, span, section wrappers) is skipped —
# their text is already inside these, and including them would repeat every
# sentence once per level of nesting.
_BLOCK_TAGS = (
    "title", "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "li", "td", "th", "blockquote", "figcaption", "dd", "dt",
)
# Never surface these: they carry no reader-visible copy.
_SKIP_ANCESTORS = {"script", "style", "noscript", "template", "svg"}


@dataclass
class TextBlock:
    tag: str
    text: str


def extract_blocks(doc: ParsedDoc, limit: int = 600) -> list[TextBlock]:
    """The page's copy as tagged lines, in document order.

    Density alone tells someone a keyword appears 12 times; it cannot tell them
    whether those 12 are in the H1 and opening paragraph or buried in footer
    list items. Returning (tag, text) pairs lets the UI show WHERE each mention
    lives, which is the part that changes what you do next.

    Only leaf-ish content tags are emitted (see _BLOCK_TAGS): walking every
    element would repeat the same sentence at each nesting level.
    """
    tree = getattr(doc, "tree", None)
    if tree is None:
        return []

    blocks: list[TextBlock] = []
    seen: set[tuple[str, str]] = set()
    for node in tree.css(",".join(_BLOCK_TAGS)):
        tag = (node.tag or "").lower()
        if tag not in _BLOCK_TAGS:
            continue
        # Skip anything inside a non-content ancestor.
        parent, skip = node.parent, False
        while parent is not None:
            if (parent.tag or "").lower() in _SKIP_ANCESTORS:
                skip = True
                break
            parent = parent.parent
        if skip:
            continue

        text = " ".join((node.text(deep=True) or "").split())
        if not text:
            continue
        # A <li> wrapping a <p> yields the same string twice; keep the first.
        key = (tag, text)
        if key in seen:
            continue
        seen.add(key)
        blocks.append(TextBlock(tag=tag, text=text[:2000]))
        if len(blocks) >= limit:
            break
    return blocks
