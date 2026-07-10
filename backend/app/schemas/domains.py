from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import Meta


# ---- Requests ----
class TargetRequest(BaseModel):
    target: str = Field(min_length=1, max_length=255)
    location_code: int = 2840
    language_code: str = "en"
    limit: int = Field(default=100, ge=1, le=1000)
    force_live: bool = False


class IntersectionRequest(BaseModel):
    target1: str = Field(min_length=1, max_length=255)
    target2: str = Field(min_length=1, max_length=255)
    location_code: int = 2840
    language_code: str = "en"
    limit: int = Field(default=100, ge=1, le=1000)
    force_live: bool = False


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


# ---- History / WHOIS / Technologies ----
class HistoryRankPoint(BaseModel):
    year: int | None = None
    month: int | None = None
    keywords: int | None = None
    etv: float | None = None
    top3: int | None = None


class DomainHistoryResponse(BaseModel):
    target: str
    rows: list[HistoryRankPoint]
    meta: Meta


class WhoisInfo(BaseModel):
    domain: str | None = None
    created: str | None = None
    expires: str | None = None
    updated: str | None = None
    registrar: str | None = None
    first_seen: str | None = None
    epp_status_codes: list[str] = Field(default_factory=list)


class WhoisResponse(BaseModel):
    target: str
    whois: WhoisInfo
    meta: Meta


class TechRow(BaseModel):
    group: str | None = None
    category: str | None = None
    name: str | None = None


class TechProfile(BaseModel):
    domain: str | None = None
    title: str | None = None
    country: str | None = None
    language: str | None = None
    last_visited: str | None = None
    emails: list[str] = Field(default_factory=list)
    phones: list[str] = Field(default_factory=list)
    rows: list[TechRow] = Field(default_factory=list)


class TechnologiesResponse(BaseModel):
    target: str
    profile: TechProfile
    meta: Meta
