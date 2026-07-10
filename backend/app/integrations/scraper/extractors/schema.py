"""JSON-LD structured data extractor.

Rich results / schema.org payloads live in ``<script type="application/ld+json">``
blocks. We parse each one, skipping malformed entries, and return the
parsed objects in document order.
"""

from __future__ import annotations

import json
from typing import Any, List

from app.integrations.scraper.parser import ParsedDoc


def extract_json_ld(doc: ParsedDoc) -> List[Any]:
    out: List[Any] = []
    for script in doc.tree.css('script[type="application/ld+json"]'):
        raw = (script.text() or "").strip()
        if not raw:
            continue
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            # Some sites embed multiple top-level JSON objects concatenated
            # without an array wrapper. Try each line as a fallback.
            try:
                parsed = json.loads("[" + raw.replace("}\n{", "},{") + "]")
            except Exception:
                continue
        if isinstance(parsed, list):
            out.extend(parsed)
        else:
            out.append(parsed)
    return out
