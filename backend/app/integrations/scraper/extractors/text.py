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
