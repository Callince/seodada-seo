"""Import seodada's real content from the Postgres dump into the unified DB.

Reads `flaskdb_backup_do.sql` (stdlib COPY-block parsing — no old DB needed) and
imports blog categories, blog posts, and web stories. Website-settings key/value
rows are folded into the single WebsiteSettings row. Idempotent: re-running skips
rows whose slug already exists. Blog/story cover images are pointed at
`/content-assets/...`; run with --copy-assets to also copy the files into the
frontend public dir.

Usage:
    python scripts/import_seodada_content.py [path_to_sql] [--copy-assets]
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import sys
from datetime import datetime

from sqlalchemy import select

from app.db.models import Blog, BlogCategory, WebStory, WebsiteSettings
from app.db.session import SessionLocal

DUMP = r"D:\SEO RENEW\flaskdb_backup_do.sql"
STATIC = r"D:\SEO RENEW\seo\static"
ASSETS_OUT = r"D:\data for seo\frontend\public\content-assets"
ASSET_URL = "/content-assets/"


# ------------------------------------------------------------- COPY parsing

def _unescape(v: str) -> str | None:
    if v == "\\N":
        return None
    return v.replace("\\t", "\t").replace("\\r", "\r").replace("\\n", "\n").replace("\\\\", "\\")


def parse_copy(sql: str, table: str) -> list[dict]:
    marker = f"COPY public.{table} ("
    i = sql.find(marker)
    if i == -1:
        return []
    lp, rp = sql.find("(", i), sql.find(")", sql.find("(", i))
    cols = [c.strip().strip('"') for c in sql[lp + 1 : rp].split(",")]
    start = sql.find("FROM stdin;\n", rp) + len("FROM stdin;\n")
    end = sql.find("\n\\.\n", start)
    rows = []
    for line in sql[start:end].split("\n"):
        if not line:
            continue
        vals = [_unescape(v) for v in line.split("\t")]
        rows.append(dict(zip(cols, vals)))
    return rows


def _slug(s: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", (s or "").lower())).strip("-") or "item"


def _dt(v: str | None) -> datetime | None:
    if not v:
        return None
    try:
        return datetime.fromisoformat(v.replace("+00", "+00:00"))
    except ValueError:
        return None


def _truthy(v: str | None) -> bool:
    return (v or "").strip().lower() in ("1", "t", "true", "active", "published", "publish")


def _asset(filename: str | None) -> str:
    if not filename:
        return ""
    return ASSET_URL + os.path.basename(filename)


def _rewrite_imgs(html: str) -> str:
    # Point any /static/uploads/... image at the copied assets path.
    return re.sub(r'(src=["\'])[^"\']*?/static/uploads/([^"\']+)', rf'\1{ASSET_URL}\2', html or "")


def _faqs_from_schema(schema_data: str | None) -> list[dict]:
    if not schema_data:
        return []
    try:
        data = json.loads(schema_data)
    except (ValueError, TypeError):
        return []
    blocks = data if isinstance(data, list) else [data]
    out = []
    for b in blocks:
        if isinstance(b, dict) and b.get("@type") == "FAQPage":
            for q in b.get("mainEntity", []) or []:
                ans = (q.get("acceptedAnswer") or {}).get("text", "")
                if q.get("name") and ans:
                    out.append({"question": q["name"], "answer": ans})
    return out


def _excerpt(html: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html or "")
    text = re.sub(r"\s+", " ", text).strip()
    return text[:200]


# ------------------------------------------------------------------- import

_SETTINGS_MAP = {
    "website_name": "company_name",
    "company_name": "company_name",
    "support_email": "support_email",
    "website_tagline": "tagline",
    "facebook_url": "facebook_url",
    "linkedin_url": "linkedin_url",
    "instagram_url": "instagram_url",
    "youtube_url": "youtube_url",
}


async def run(sql: str, copy_assets: bool) -> None:
    cats = parse_copy(sql, "blog_categories")
    blogs = parse_copy(sql, "blogs")
    stories = parse_copy(sql, "webstories")
    settings_rows = parse_copy(sql, "website_settings")

    async with SessionLocal() as db:
        # --- categories (preserve old id so blog.category_id resolves) ---
        added_c = 0
        for c in cats:
            if await db.get(BlogCategory, c["id"]):
                continue
            db.add(BlogCategory(id=c["id"], name=c["name"], slug=_slug(c["name"]),
                                sort_order=int(c.get("sort_order") or 0), created_at=_dt(c.get("created_at")) or datetime.now()))
            added_c += 1
        await db.commit()

        # --- blogs ---
        added_b = 0
        for b in blogs:
            slug = b.get("slug") or _slug(b.get("title", ""))
            if await db.scalar(select(Blog.id).where(Blog.slug == slug)):
                continue
            body = _rewrite_imgs(b.get("description") or "")
            db.add(Blog(
                id=b["id"], category_id=b.get("category_id"), title=b.get("title") or "Untitled",
                slug=slug, body_html=body, meta_title=b.get("meta_title") or "",
                meta_description=b.get("meta_description") or "", meta_keywords=b.get("meta_keyword") or "",
                excerpt=_excerpt(body), cover_image_url=_asset(b.get("image")),
                author=b.get("author_name") or "seodada", faqs=_faqs_from_schema(b.get("schema_data")),
                status="published" if _truthy(b.get("status")) else "draft",
                published_at=_dt(b.get("publish_date")) or _dt(b.get("created_at")),
                created_at=_dt(b.get("created_at")) or datetime.now(),
                updated_at=_dt(b.get("updated_at")) or datetime.now(),
            ))
            added_b += 1
        await db.commit()

        # --- web stories ---
        added_s = 0
        for s in stories:
            slug = s.get("slug") or _slug(s.get("meta_title", ""))
            if await db.scalar(select(WebStory.id).where(WebStory.slug == slug)):
                continue
            try:
                slides = json.loads(s.get("slides") or "[]")
            except (ValueError, TypeError):
                slides = []
            db.add(WebStory(
                id=s["id"], title=s.get("meta_title") or "Web Story", slug=slug,
                meta_description=s.get("meta_description") or "", cover_image_url=_asset(s.get("cover_image")),
                slides=slides if isinstance(slides, list) else [],
                status="published" if _truthy(s.get("status")) else "draft",
                published_at=_dt(s.get("publish_date")), created_at=_dt(s.get("created_at")) or datetime.now(),
            ))
            added_s += 1
        await db.commit()

        # --- website settings (key/value → structured single row) ---
        row = await db.scalar(select(WebsiteSettings).limit(1))
        if not row:
            row = WebsiteSettings()
            db.add(row)
        for kv in settings_rows:
            field = _SETTINGS_MAP.get((kv.get("setting_key") or "").lower())
            if field and kv.get("setting_value"):
                setattr(row, field, kv["setting_value"])
        await db.commit()

    print(f"Imported: {added_c} categories, {added_b} blogs, {added_s} web stories, "
          f"{len(settings_rows)} settings keys folded in.")

    if copy_assets:
        os.makedirs(ASSETS_OUT, exist_ok=True)
        copied = 0
        for root in ("uploads", "uploads/blogs", "uploads/webstories"):
            src_dir = os.path.join(STATIC, root)
            if not os.path.isdir(src_dir):
                continue
            for fn in os.listdir(src_dir):
                src = os.path.join(src_dir, fn)
                if os.path.isfile(src):
                    shutil.copy2(src, os.path.join(ASSETS_OUT, fn))
                    copied += 1
        print(f"Copied {copied} asset files to {ASSETS_OUT}")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    path = args[0] if args else DUMP
    copy_assets = "--copy-assets" in sys.argv
    with open(path, encoding="utf-8", errors="replace") as f:
        asyncio.run(run(f.read(), copy_assets))
