"""Extract ALL human-readable content from App B (seodada) Jinja templates into
a structured JSON catalog the redesigned React pages render from.

Lossless by design: for every template we capture SEO meta (title, description,
canonical, OG/Twitter, robots), the heading hierarchy, visible text blocks,
links, and images — with Jinja markup and <script>/<style> stripped. No copy is
hand-retyped, so nothing is lost in the migration.

Usage:
    python backend/scripts/extract_content.py \
        --src "D:/SEO RENEW/seo/templates" \
        --out "frontend/src/content/raw"

Run with no args to use those defaults (paths relative to repo root).
Dependency-free (stdlib html.parser) — no bs4/selectolax needed.
"""
from __future__ import annotations

import argparse
import json
import re
from html.parser import HTMLParser
from pathlib import Path

# Jinja constructs to remove before parsing so they never leak into copy.
_JINJA = re.compile(r"\{\{.*?\}\}|\{%.*?%\}|\{#.*?#\}", re.DOTALL)
# Tags whose *content* is never user-facing copy.
_SKIP_CONTENT = {"script", "style", "noscript", "svg", "template", "head"}
_HEADINGS = {"h1", "h2", "h3", "h4", "h5", "h6"}
_BLOCKISH = {"p", "li", "div", "section", "article", "header", "footer",
             "blockquote", "figcaption", "td", "th", "button", "a", "span",
             "label", *_HEADINGS}


class _Extractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.meta: dict[str, str] = {}
        self.title = ""
        self._in_title = False
        self._skip_depth = 0
        self._cur_heading: str | None = None
        self.headings: list[dict] = []
        self.blocks: list[str] = []
        self.flow: list[dict] = []          # ordered heading/text stream
        self.links: list[dict] = []
        self.images: list[dict] = []
        self._buf: list[str] = []

    # --- helpers ----------------------------------------------------------
    def _flush(self) -> None:
        text = re.sub(r"\s+", " ", "".join(self._buf)).strip()
        self._buf = []
        if not text:
            self._cur_heading = None
            return
        if self._cur_heading:
            self.headings.append({"level": self._cur_heading, "text": text})
            self.flow.append({"type": "heading", "level": self._cur_heading, "text": text})
            self._cur_heading = None
        elif len(text) > 1:
            self.blocks.append(text)
            self.flow.append({"type": "text", "text": text})

    # --- parser hooks -----------------------------------------------------
    def handle_starttag(self, tag: str, attrs_list) -> None:
        attrs = dict(attrs_list)
        if tag in _SKIP_CONTENT:
            self._skip_depth += 1
            return
        if self._skip_depth:
            return
        if tag == "title":
            self._in_title = True
        elif tag == "meta":
            name = (attrs.get("name") or attrs.get("property") or "").lower()
            content = attrs.get("content")
            if name and content:
                self.meta[name] = content
        elif tag == "link" and (attrs.get("rel") or "") == "canonical":
            if attrs.get("href"):
                self.meta["canonical"] = attrs["href"]
        elif tag == "img":
            self.images.append({"src": attrs.get("src", ""), "alt": attrs.get("alt", "")})
        elif tag == "a" and attrs.get("href"):
            self._pending_href = attrs["href"]
        if tag in _BLOCKISH:
            self._flush()
        if tag in _HEADINGS:
            self._cur_heading = tag

    def handle_endtag(self, tag: str) -> None:
        if tag in _SKIP_CONTENT:
            self._skip_depth = max(0, self._skip_depth - 1)
            return
        if self._skip_depth:
            return
        if tag == "title":
            self._in_title = False
        if tag == "a":
            href = getattr(self, "_pending_href", None)
            text = re.sub(r"\s+", " ", "".join(self._buf)).strip()
            if href and text:
                self.links.append({"href": href, "text": text})
            self._pending_href = None
        if tag in _BLOCKISH:
            self._flush()

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return
        if self._in_title:
            self.title += data
        self._buf.append(data)


def extract_file(path: Path) -> dict:
    raw = path.read_text(encoding="utf-8", errors="replace")
    raw = _JINJA.sub(" ", raw)
    p = _Extractor()
    p.feed(raw)
    p._flush()
    m = p.meta
    seo = {
        "title": (p.title or m.get("og:title") or m.get("twitter:title") or "").strip(),
        "description": (m.get("description") or m.get("og:description") or "").strip(),
        "canonical": m.get("canonical", ""),
        "robots": m.get("robots", ""),
        "og_image": m.get("og:image", ""),
        "og_type": m.get("og:type", ""),
    }
    # De-dup blocks while preserving order (templates repeat boilerplate).
    seen: set[str] = set()
    blocks = [b for b in p.blocks if not (b in seen or seen.add(b))]
    # Ordered heading/text flow, de-duped by text so nav/footer echoes collapse.
    fseen: set[str] = set()
    flow = [f for f in p.flow if not (f["text"] in fseen or fseen.add(f["text"]))]
    return {
        "slug": path.stem,
        "source": str(path).replace("\\", "/"),
        "seo": seo,
        "headings": p.headings,
        "text_blocks": blocks,
        "flow": flow,
        "links": p.links[:400],
        "images": p.images[:200],
        "counts": {
            "headings": len(p.headings),
            "text_blocks": len(blocks),
            "links": len(p.links),
            "images": len(p.images),
        },
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="D:/SEO RENEW/seo/templates")
    ap.add_argument("--out", default="frontend/src/content/raw")
    ap.add_argument("--include-emails", action="store_true", default=True)
    args = ap.parse_args()

    src = Path(args.src)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    files = sorted(src.glob("*.html"))
    if args.include_emails and (src / "emails").is_dir():
        files += sorted((src / "emails").glob("*.html"))

    index = []
    for f in files:
        try:
            data = extract_file(f)
        except Exception as exc:  # noqa: BLE001 - report and continue
            print(f"  ! {f.name}: {exc}")
            continue
        (out / f"{f.stem}.json").write_text(
            json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        index.append({"slug": data["slug"], "title": data["seo"]["title"],
                      "source": data["source"], **data["counts"]})
        c = data["counts"]
        print(f"  {f.stem:28} h={c['headings']:>3} blocks={c['text_blocks']:>4} "
              f"links={c['links']:>3} imgs={c['images']:>3}")

    (out / "_index.json").write_text(
        json.dumps(index, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    total_blocks = sum(i["text_blocks"] for i in index)
    print(f"\nExtracted {len(index)} templates -> {out}  "
          f"({total_blocks} text blocks total)")


if __name__ == "__main__":
    main()
