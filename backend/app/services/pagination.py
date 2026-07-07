"""Cursor (keyset) pagination helpers.

Opaque cursors encode the last item's `(sort_timestamp, id)` so the next page
is fetched with a keyset predicate rather than a slow OFFSET. Stable under
inserts/deletes and efficient at any depth.
"""
from __future__ import annotations

import base64
import binascii
from datetime import datetime


class InvalidCursor(ValueError):
    pass


def encode_cursor(ts: datetime, id_: str) -> str:
    raw = f"{ts.isoformat()}|{id_}".encode()
    return base64.urlsafe_b64encode(raw).decode()


def decode_cursor(cursor: str) -> tuple[datetime, str]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode()).decode()
        ts_str, id_ = raw.split("|", 1)
        return datetime.fromisoformat(ts_str), id_
    except (binascii.Error, ValueError, UnicodeDecodeError) as exc:
        raise InvalidCursor("Malformed pagination cursor.") from exc
