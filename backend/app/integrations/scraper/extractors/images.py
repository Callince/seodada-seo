"""Image extraction — URL, alt text, dimensions if declared."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

from app.integrations.scraper.frontier import normalize_url
from app.integrations.scraper.parser import ParsedDoc


@dataclass
class ImageRef:
    url: str
    alt: str
    title: Optional[str]
    width: Optional[int]
    height: Optional[int]
    loading: Optional[str]
    raw_src: str


def _int_or_none(v: Optional[str]) -> Optional[int]:
    if not v:
        return None
    try:
        return int(v)
    except ValueError:
        return None


def extract_images(doc: ParsedDoc) -> List[ImageRef]:
    out: List[ImageRef] = []
    seen: set[str] = set()
    base = doc.final_url or doc.url
    for img in doc.tree.css("img"):
        raw = img.attributes.get("src") or img.attributes.get("data-src") or ""
        if not raw:
            continue
        canonical = normalize_url(raw, base_url=base)
        if not canonical or canonical in seen:
            continue
        seen.add(canonical)
        out.append(
            ImageRef(
                url=canonical,
                alt=(img.attributes.get("alt") or "").strip(),
                title=img.attributes.get("title"),
                width=_int_or_none(img.attributes.get("width")),
                height=_int_or_none(img.attributes.get("height")),
                loading=img.attributes.get("loading"),
                raw_src=raw,
            )
        )
    return out
