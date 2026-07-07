"""Helpers for rank tracking: locate a domain within parsed SERP rows."""
from __future__ import annotations


def normalize_domain(domain: str) -> str:
    d = (domain or "").strip().lower().rstrip("/")
    if d.startswith(("http://", "https://")):
        d = d.split("://", 1)[1]
    d = d.split("/", 1)[0]
    if d.startswith("www."):
        d = d[4:]
    return d


def find_position(rows: list[dict], domain: str) -> tuple[int | None, str | None]:
    """Return (position, url) of the first SERP row matching `domain`.

    Matches the registrable domain, so `shop.nike.com` and `www.nike.com`
    both match a target of `nike.com`. Returns (None, None) if not present.
    """
    target = normalize_domain(domain)
    if not target:
        return None, None
    for r in rows:
        row_domain = normalize_domain(r.get("domain") or r.get("url") or "")
        if row_domain == target or row_domain.endswith("." + target):
            return r.get("position"), r.get("url")
    return None, None
