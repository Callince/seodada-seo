"""Tree-consuming extractors.

Every extractor takes a ``ParsedDoc`` (already fetched + parsed) and
returns its result. None of them fetch. None of them re-parse. The
engine calls each once per page so a single HTML parse fans out to all
of them.
"""

from app.integrations.scraper.extractors.headings import extract_headings
from app.integrations.scraper.extractors.images import extract_images
from app.integrations.scraper.extractors.links import extract_links
from app.integrations.scraper.extractors.meta import extract_meta
from app.integrations.scraper.extractors.schema import extract_json_ld
from app.integrations.scraper.extractors.text import extract_text

__all__ = [
    "extract_headings",
    "extract_images",
    "extract_links",
    "extract_meta",
    "extract_json_ld",
    "extract_text",
]
