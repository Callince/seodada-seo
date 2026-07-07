"""Pixel-width estimation for SERP snippets.

Google truncates titles and meta descriptions by *pixel* width, not character
count, so a short-but-wide title ("WWW Mmm…") can truncate while a longer thin
one fits. We approximate Arial glyph widths (the font Google renders desktop
results in) to score truncation realistically and to render a snippet preview.

Widths are in 1/1000 em units for Arial; multiply by font size in px.
Thresholds are the commonly-cited desktop limits:
    title  ~600 px  (rendered ~20 px Arial)
    meta   ~920 px  (rendered ~14 px Arial)
"""
from __future__ import annotations

# Arial advance widths, units per 1000 em. Unlisted chars fall back to AVG.
_WIDTHS: dict[str, int] = {
    " ": 278, "!": 278, '"': 355, "#": 556, "$": 556, "%": 889, "&": 667,
    "'": 191, "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333,
    ".": 278, "/": 278, "0": 556, "1": 556, "2": 556, "3": 556, "4": 556,
    "5": 556, "6": 556, "7": 556, "8": 556, "9": 556, ":": 278, ";": 278,
    "<": 584, "=": 584, ">": 584, "?": 556, "@": 1015, "A": 667, "B": 667,
    "C": 722, "D": 722, "E": 667, "F": 611, "G": 778, "H": 722, "I": 278,
    "J": 500, "K": 667, "L": 556, "M": 833, "N": 722, "O": 778, "P": 667,
    "Q": 778, "R": 722, "S": 667, "T": 611, "U": 722, "V": 667, "W": 944,
    "X": 667, "Y": 667, "Z": 611, "[": 278, "\\": 278, "]": 278, "^": 469,
    "_": 556, "`": 333, "a": 556, "b": 556, "c": 500, "d": 556, "e": 556,
    "f": 278, "g": 556, "h": 556, "i": 222, "j": 222, "k": 500, "l": 222,
    "m": 833, "n": 556, "o": 556, "p": 556, "q": 556, "r": 333, "s": 500,
    "t": 278, "u": 556, "v": 500, "w": 722, "x": 500, "y": 500, "z": 500,
    "{": 334, "|": 260, "}": 334, "~": 584,
}
_AVG = 556

TITLE_FONT_PX = 20
TITLE_LIMIT_PX = 600
META_FONT_PX = 14
META_LIMIT_PX = 920


def text_width_px(text: str, font_px: int) -> float:
    """Estimated rendered width of `text` at the given font size (px)."""
    units = sum(_WIDTHS.get(ch, _AVG) for ch in text)
    return round(units / 1000 * font_px, 1)


def _truncate_to_px(text: str, font_px: int, limit_px: int) -> str:
    """Trim `text` to fit `limit_px` (leaving room for an ellipsis)."""
    if text_width_px(text, font_px) <= limit_px:
        return text
    ell = text_width_px("…", font_px)
    budget = limit_px - ell
    acc = 0.0
    out: list[str] = []
    for ch in text:
        w = _WIDTHS.get(ch, _AVG) / 1000 * font_px
        if acc + w > budget:
            break
        acc += w
        out.append(ch)
    return "".join(out).rstrip() + "…"


def _measure(text: str | None, font_px: int, limit_px: int) -> dict:
    text = text or ""
    width = text_width_px(text, font_px)
    return {
        "text": text,
        "pixels": width,
        "limit_pixels": limit_px,
        "truncated": width > limit_px,
        "preview": _truncate_to_px(text, font_px, limit_px),
        "fill_pct": round(min(100.0, width / limit_px * 100), 1) if limit_px else 0.0,
    }


def snippet_preview(title: str | None, meta_description: str | None, url: str) -> dict:
    """Build a Google-style snippet preview with pixel-truncation flags."""
    return {
        "url": url,
        "title": _measure(title, TITLE_FONT_PX, TITLE_LIMIT_PX),
        "meta_description": _measure(meta_description, META_FONT_PX, META_LIMIT_PX),
    }
