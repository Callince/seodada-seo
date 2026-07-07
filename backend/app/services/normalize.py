"""Shared input normalizers (single home — don't re-implement per module)."""
from __future__ import annotations


def clean_domain(domain: str) -> str:
    """`https://www.Example.com/` -> `example.com` — the form every provider wants."""
    d = domain.strip().lower()
    for prefix in ("https://", "http://", "www."):
        if d.startswith(prefix):
            d = d[len(prefix):]
    return d.rstrip("/")
