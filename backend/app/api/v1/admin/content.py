"""Admin: blog categories, blog posts (+image upload), web stories."""
from __future__ import annotations


import asyncio
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_db_session,
    require_admin,
)
from app.core.config import settings
from app.db.models import (
    Blog,
    BlogCategory,
    User,
    WebStory,
    WebStoryCategory,
)
from app.schemas.admin import (
    AdminBlogDetail,
    AdminBlogOut,
    AdminWebStoryDetail,
    AdminWebStoryOut,
    BlogCategoryCreate,
    BlogCategoryOut,
    BlogCategoryUpdate,
    BlogCreate,
    BlogUpdate,
    UploadOut,
    WebStoryCategoryCreate,
    WebStoryCategoryOut,
    WebStoryCategoryUpdate,
    WebStoryCreate,
    WebStoryUpdate,
)
from app.api.v1.admin._shared import _slugify

router = APIRouter()


# ------------------------------------------------------------ content mod

# -------- blog categories

@router.get("/blog-categories", response_model=list[BlogCategoryOut])
async def admin_blog_categories(db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)):
    rows = await db.scalars(select(BlogCategory).order_by(BlogCategory.sort_order, BlogCategory.name))
    return list(rows)


@router.post("/blog-categories", response_model=BlogCategoryOut, status_code=status.HTTP_201_CREATED)
async def create_blog_category(
    body: BlogCategoryCreate, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    cat = BlogCategory(name=body.name.strip(), slug=_slugify(body.name), sort_order=body.sort_order)
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


@router.patch("/blog-categories/{cat_id}", response_model=BlogCategoryOut)
async def update_blog_category(
    cat_id: str, body: BlogCategoryUpdate, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    cat = await db.get(BlogCategory, cat_id)
    if not cat:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    if body.name is not None:
        cat.name = body.name.strip()
        cat.slug = _slugify(body.name)
    if body.sort_order is not None:
        cat.sort_order = body.sort_order
    await db.commit()
    await db.refresh(cat)
    return cat


@router.delete("/blog-categories/{cat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_blog_category(
    cat_id: str, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    if await db.scalar(select(func.count(Blog.id)).where(Blog.category_id == cat_id)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Category still has posts — reassign them first")
    cat = await db.get(BlogCategory, cat_id)
    if cat:
        await db.delete(cat)
        await db.commit()


# -------- web story categories

@router.get("/webstory-categories", response_model=list[WebStoryCategoryOut])
async def admin_webstory_categories(
    db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    rows = await db.scalars(
        select(WebStoryCategory).order_by(WebStoryCategory.sort_order, WebStoryCategory.name)
    )
    return list(rows)


@router.post(
    "/webstory-categories", response_model=WebStoryCategoryOut, status_code=status.HTTP_201_CREATED
)
async def create_webstory_category(
    body: WebStoryCategoryCreate,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_admin),
):
    cat = WebStoryCategory(
        name=body.name.strip(), slug=_slugify(body.name), sort_order=body.sort_order
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


@router.patch("/webstory-categories/{cat_id}", response_model=WebStoryCategoryOut)
async def update_webstory_category(
    cat_id: str,
    body: WebStoryCategoryUpdate,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_admin),
):
    cat = await db.get(WebStoryCategory, cat_id)
    if not cat:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    if body.name is not None:
        cat.name = body.name.strip()
        cat.slug = _slugify(body.name)
    if body.sort_order is not None:
        cat.sort_order = body.sort_order
    await db.commit()
    await db.refresh(cat)
    return cat


@router.delete("/webstory-categories/{cat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webstory_category(
    cat_id: str, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    if await db.scalar(select(func.count(WebStory.id)).where(WebStory.category_id == cat_id)):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Category still has stories — reassign them first"
        )
    cat = await db.get(WebStoryCategory, cat_id)
    if cat:
        await db.delete(cat)
        await db.commit()


# -------- blog posts

async def _unique_blog_slug(db: AsyncSession, base: str, exclude_id: str | None = None) -> str:
    slug = _slugify(base)
    q = select(Blog.id).where(Blog.slug == slug)
    if exclude_id:
        q = q.where(Blog.id != exclude_id)
    if await db.scalar(q):
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"
    return slug


@router.get("/blogs", response_model=list[AdminBlogOut])
async def admin_blogs(db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)):
    rows = await db.scalars(select(Blog).order_by(Blog.updated_at.desc()))
    return list(rows)


@router.post("/blogs", response_model=AdminBlogDetail, status_code=status.HTTP_201_CREATED)
async def create_blog(
    body: BlogCreate, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    slug = await _unique_blog_slug(db, body.slug or body.title)
    blog = Blog(
        title=body.title.strip(), slug=slug, body_html=body.body_html, excerpt=body.excerpt,
        meta_title=body.meta_title, meta_description=body.meta_description, meta_keywords=body.meta_keywords,
        cover_image_url=body.cover_image_url, image_alt=body.image_alt, author=body.author,
        category_id=body.category_id or None, faqs=[f.model_dump() for f in body.faqs],
        tldr=body.tldr, key_takeaways=list(body.key_takeaways),
        reading_time_minutes=body.reading_time_minutes, is_pillar=body.is_pillar, status=body.status,
        published_at=datetime.now(timezone.utc) if body.status == "published" else None,
    )
    db.add(blog)
    await db.commit()
    await db.refresh(blog)
    return blog


@router.post("/blogs/upload-image", response_model=UploadOut)
async def upload_blog_image(
    file: UploadFile = File(...), _: User = Depends(require_admin)
):
    """Store an uploaded image and return its public /content-assets/ URL."""
    ext = Path(file.filename or "").suffix.lower()
    if ext not in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unsupported image type")
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Image too large (max 8 MB)")
    dest_dir = Path(settings.content_upload_dir)
    name = f"{uuid.uuid4().hex}{ext}"

    def _save() -> None:
        dest_dir.mkdir(parents=True, exist_ok=True)
        (dest_dir / name).write_bytes(data)

    await asyncio.to_thread(_save)
    return UploadOut(url=f"/content-assets/uploads/{name}")


@router.get("/blogs/{blog_id}", response_model=AdminBlogDetail)
async def get_blog_admin(
    blog_id: str, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    blog = await db.get(Blog, blog_id)
    if not blog:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    return blog


@router.patch("/blogs/{blog_id}", response_model=AdminBlogDetail)
async def update_blog(
    blog_id: str,
    body: BlogUpdate,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_admin),
):
    blog = await db.get(Blog, blog_id)
    if not blog:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    patch = body.model_dump(exclude_unset=True)
    if "slug" in patch and patch["slug"]:
        blog.slug = await _unique_blog_slug(db, patch.pop("slug"), exclude_id=blog.id)
    else:
        patch.pop("slug", None)
    if "faqs" in patch and patch["faqs"] is not None:
        blog.faqs = [f if isinstance(f, dict) else f.model_dump() for f in patch.pop("faqs")]
    if "status" in patch and patch["status"] == "published" and not blog.published_at:
        blog.published_at = datetime.now(timezone.utc)
    for k, v in patch.items():
        setattr(blog, k, v)
    await db.commit()
    await db.refresh(blog)
    return blog


@router.delete("/blogs/{blog_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_blog(
    blog_id: str, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    blog = await db.get(Blog, blog_id)
    if blog:
        await db.delete(blog)
        await db.commit()


async def _unique_story_slug(db: AsyncSession, base: str, exclude_id: str | None = None) -> str:
    slug = _slugify(base)
    q = select(WebStory.id).where(WebStory.slug == slug)
    if exclude_id:
        q = q.where(WebStory.id != exclude_id)
    if await db.scalar(q):
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"
    return slug


@router.get("/webstories", response_model=list[AdminWebStoryOut])
async def admin_webstories(db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)):
    rows = await db.scalars(select(WebStory).order_by(WebStory.created_at.desc()))
    return list(rows)


@router.post("/webstories", response_model=AdminWebStoryDetail, status_code=status.HTTP_201_CREATED)
async def create_story(
    body: WebStoryCreate, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    slug = await _unique_story_slug(db, body.slug or body.title)
    story = WebStory(
        title=body.title.strip(), slug=slug, category_id=body.category_id or None,
        meta_description=body.meta_description,
        cover_image_url=body.cover_image_url, slides=[s.model_dump() for s in body.slides],
        status=body.status,
        published_at=datetime.now(timezone.utc) if body.status == "published" else None,
    )
    db.add(story)
    await db.commit()
    await db.refresh(story)
    return story


@router.get("/webstories/{story_id}", response_model=AdminWebStoryDetail)
async def get_story_admin(
    story_id: str, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    story = await db.get(WebStory, story_id)
    if not story:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Story not found")
    return story


@router.patch("/webstories/{story_id}", response_model=AdminWebStoryDetail)
async def update_story(
    story_id: str,
    body: WebStoryUpdate,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_admin),
):
    story = await db.get(WebStory, story_id)
    if not story:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Story not found")
    patch = body.model_dump(exclude_unset=True)
    if "slug" in patch and patch["slug"]:
        story.slug = await _unique_story_slug(db, patch.pop("slug"), exclude_id=story.id)
    else:
        patch.pop("slug", None)
    if "category_id" in patch:
        patch["category_id"] = patch["category_id"] or None  # "" (no category) -> NULL
    if "slides" in patch and patch["slides"] is not None:
        story.slides = patch.pop("slides")  # already plain dicts from model_dump
    if "status" in patch and patch["status"] == "published" and not story.published_at:
        story.published_at = datetime.now(timezone.utc)
    for k, v in patch.items():
        setattr(story, k, v)
    await db.commit()
    await db.refresh(story)
    return story


@router.delete("/webstories/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_story(
    story_id: str, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    story = await db.get(WebStory, story_id)
    if story:
        await db.delete(story)
        await db.commit()


