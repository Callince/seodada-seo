from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import Meta


# ---- Requests ----
class TargetRequest(BaseModel):
    target: str = Field(min_length=1, max_length=255)
    location_code: int = 2840
    language_code: str = "en"
    limit: int = Field(default=100, ge=1, le=1000)


class IntersectionRequest(BaseModel):
    target1: str = Field(min_length=1, max_length=255)
    target2: str = Field(min_length=1, max_length=255)
    location_code: int = 2840
    language_code: str = "en"
    limit: int = Field(default=100, ge=1, le=1000)


# ---- Responses ----
class RankedKeywordRow(BaseModel):
    keyword: str
    position: int | None = None
    search_volume: int | None = None
    etv: float | None = None
    url: str | None = None


class RankedKeywordsResponse(BaseModel):
    target: str
    rows: list[RankedKeywordRow]
    meta: Meta


class CompetitorRow(BaseModel):
    domain: str
    common_keywords: int | None = None
    avg_position: float | None = None
    etv: float | None = None
    keywords_count: int | None = None


class CompetitorsResponse(BaseModel):
    target: str
    rows: list[CompetitorRow]
    meta: Meta


class OverviewMetrics(BaseModel):
    count: int | None = None
    etv: float | None = None
    traffic_cost: float | None = None


class OverviewResponse(BaseModel):
    target: str
    organic: OverviewMetrics
    paid: OverviewMetrics
    meta: Meta


class IntersectionRow(BaseModel):
    keyword: str
    search_volume: int | None = None
    target1_position: int | None = None
    target2_position: int | None = None


class IntersectionResponse(BaseModel):
    target1: str
    target2: str
    rows: list[IntersectionRow]
    meta: Meta
