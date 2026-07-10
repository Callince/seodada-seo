"""Public content API — the migrated seodada blog + web stories (read-only).

Global content (not org-scoped). No auth. Only published items are exposed.
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session
from app.db.models import Blog, BlogCategory, ContactSubmission, WebStory

router = APIRouter()


class ContactCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    message: str = Field(min_length=10, max_length=5000)


@router.post("/contact", status_code=status.HTTP_201_CREATED)
async def submit_contact(
    body: ContactCreate, request: Request, db: AsyncSession = Depends(get_db_session)
):
    """Public contact form → an admin-inbox submission (no auth)."""
    db.add(ContactSubmission(
        name=body.name.strip(), email=str(body.email).lower(), message=body.message.strip(),
        ip=(request.client.host if request.client else ""),
    ))
    await db.commit()
    return {"ok": True}


class BlogSummary(BaseModel):
    title: str
    slug: str
    excerpt: str
    cover_image_url: str
    author: str
    meta_description: str
    published_at: datetime | None = None


class FaqItem(BaseModel):
    question: str
    answer: str


class BlogDetail(BlogSummary):
    meta_title: str
    body_html: str
    faqs: list[FaqItem] = []


class CategoryOut(BaseModel):
    name: str
    slug: str


class WebStorySummary(BaseModel):
    title: str
    slug: str
    cover_image_url: str
    published_at: datetime | None = None


class WebStoryDetail(WebStorySummary):
    meta_description: str
    slides: list = []


@router.get("/blog", response_model=list[BlogSummary])
async def list_blogs(db: AsyncSession = Depends(get_db_session)):
    rows = await db.scalars(
        select(Blog).where(Blog.status == "published").order_by(Blog.published_at.desc().nullslast()).limit(200)
    )
    return list(rows)


@router.get("/blog-categories", response_model=list[CategoryOut])
async def list_categories(db: AsyncSession = Depends(get_db_session)):
    rows = await db.scalars(select(BlogCategory).order_by(BlogCategory.sort_order, BlogCategory.name))
    return list(rows)


@router.get("/blog/{slug}", response_model=BlogDetail)
async def get_blog(slug: str, db: AsyncSession = Depends(get_db_session)):
    blog = await db.scalar(select(Blog).where(Blog.slug == slug, Blog.status == "published"))
    if not blog:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    return blog


@router.get("/webstories", response_model=list[WebStorySummary])
async def list_webstories(db: AsyncSession = Depends(get_db_session)):
    rows = await db.scalars(
        select(WebStory).where(WebStory.status == "published").order_by(WebStory.published_at.desc().nullslast())
    )
    return list(rows)


@router.get("/webstories/{slug}", response_model=WebStoryDetail)
async def get_webstory(slug: str, db: AsyncSession = Depends(get_db_session)):
    story = await db.scalar(select(WebStory).where(WebStory.slug == slug, WebStory.status == "published"))
    if not story:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Story not found")
    return story
