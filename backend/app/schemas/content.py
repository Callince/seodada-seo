from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import Meta


class ContentRequest(BaseModel):
    keyword: str = Field(min_length=1, max_length=300)
    citation_limit: int = Field(default=20, ge=1, le=100)
    force_live: bool = False


class Sentiment(BaseModel):
    positive: float | None = None
    negative: float | None = None
    neutral: float | None = None


class Connotations(BaseModel):
    anger: float | None = None
    happiness: float | None = None
    love: float | None = None
    sadness: float | None = None
    fun: float | None = None


class Citation(BaseModel):
    domain: str | None = None
    url: str | None = None
    title: str | None = None
    snippet: str | None = None


class ContentResponse(BaseModel):
    keyword: str
    total_count: int
    sentiment: Sentiment
    connotations: Connotations
    top_citations: list[Citation]
    meta: Meta


# ---- Sentiment + phrase trends ----
class SentimentResponse(BaseModel):
    keyword: str
    total_citations: int | None = None
    connotations: dict[str, int] = Field(default_factory=dict)
    types: dict[str, int] = Field(default_factory=dict)
    meta: Meta


class PhraseTrendPoint(BaseModel):
    date: str
    citations: int | None = None


class PhraseTrendsResponse(BaseModel):
    keyword: str
    rows: list[PhraseTrendPoint]
    meta: Meta
