from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import Meta


# ---- Requests ----
class VolumeRequest(BaseModel):
    keywords: list[str] = Field(min_length=1, max_length=1000)
    location_code: int = 2840
    language_code: str = "en"
    force_live: bool = False


class TrendsRequest(BaseModel):
    keywords: list[str] = Field(min_length=1, max_length=5)
    location_code: int = 2840
    language_code: str = "en"
    time_range: str = "past_12_months"
    # Optional custom window (YYYY-MM-DD); when both set, overrides time_range.
    date_from: str | None = Field(default=None, max_length=10)
    date_to: str | None = Field(default=None, max_length=10)
    force_live: bool = False


class SeedRequest(BaseModel):
    seed: str = Field(min_length=1, max_length=300)
    location_code: int = 2840
    language_code: str = "en"
    limit: int = Field(default=100, ge=1, le=1000)
    force_live: bool = False


class IdeasRequest(BaseModel):
    keywords: list[str] = Field(min_length=1, max_length=200)
    location_code: int = 2840
    language_code: str = "en"
    limit: int = Field(default=100, ge=1, le=1000)
    force_live: bool = False


class PaaRequest(BaseModel):
    keyword: str = Field(min_length=1, max_length=300)
    location_code: int = 2840
    language_code: str = "en"
    force_live: bool = False


# ---- Response models ----
class MonthlyPoint(BaseModel):
    year: int | None = None
    month: int | None = None
    volume: int | None = None


class VolumeRow(BaseModel):
    keyword: str
    search_volume: int | None = None
    cpc: float | None = None
    competition: int | None = None
    competition_level: str | None = None
    monthly_searches: list[MonthlyPoint] = []


class VolumeResponse(BaseModel):
    rows: list[VolumeRow]
    meta: Meta


class BulkOverviewRow(VolumeRow):
    """A bulk row: everything VolumeRow carries, plus the two fields the
    google_ads volume endpoint has no equivalent for."""

    keyword_difficulty: int | None = None
    intent: str | None = None


class BulkOverviewResponse(BaseModel):
    rows: list[BulkOverviewRow]
    meta: Meta


class TrendsPoint(BaseModel):
    date: str | None = None
    values: list[int | None] = []


class TrendsResponse(BaseModel):
    keywords: list[str]
    graph: list[TrendsPoint]
    meta: Meta


class KeywordRow(BaseModel):
    keyword: str
    search_volume: int | None = None
    cpc: float | None = None
    competition: float | None = None
    keyword_difficulty: int | None = None
    intent: str | None = None


class KeywordListResponse(BaseModel):
    rows: list[KeywordRow]
    meta: Meta


class PaaItem(BaseModel):
    question: str = ""
    answer: str | None = None
    url: str | None = None


class PaaResponse(BaseModel):
    keyword: str
    paa: list[PaaItem]
    meta: Meta


class OverviewRequest(BaseModel):
    keyword: str = Field(min_length=1, max_length=300)
    location_code: int = 2840
    language_code: str = "en"
    force_live: bool = False


class KeywordOverview(BaseModel):
    keyword: str | None = None
    search_volume: int | None = None
    cpc: float | None = None
    competition: float | None = None
    difficulty: int | None = None
    intent: str | None = None
    monthly_searches: list[MonthlyPoint] = Field(default_factory=list)


class KeywordOverviewResponse(BaseModel):
    overview: KeywordOverview
    meta: Meta
