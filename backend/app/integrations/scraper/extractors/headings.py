"""H1-H6 extraction (ordered, hierarchical)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

from app.integrations.scraper.parser import ParsedDoc


@dataclass
class Heading:
    level: int   # 1-6
    text: str
    order: int   # document order index


def extract_headings(doc: ParsedDoc) -> List[Heading]:
    out: List[Heading] = []
    for idx, node in enumerate(doc.tree.css("h1, h2, h3, h4, h5, h6")):
        tag = node.tag  # "h1".."h6"
        try:
            level = int(tag[1])
        except (ValueError, IndexError):
            continue
        text = " ".join((node.text() or "").split())
        if not text:
            continue
        out.append(Heading(level=level, text=text, order=idx))
    return out
