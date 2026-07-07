from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import Meta
from app.schemas.domains import CompetitorRow, OverviewMetrics, RankedKeywordRow


class SiteReportRequest(BaseModel):
    domain: str = Field(min_length=3, max_length=255)
    keyword: str | None = Field(default=None, max_length=255)
    location_code: int = 2840
    language_code: str = "en"
    max_pages: int = Field(default=5, ge=1, le=10)
    # True bypasses cache reads for the billed sub-calls (fresh, billed data).
    force_live: bool = False


class OverviewBlock(BaseModel):
    organic: OverviewMetrics
    paid: OverviewMetrics


class PageReport(BaseModel):
    url: str
    content_score: float | None = None
    word_count: int | None = None
    title: str | None = None
    issues: list[str] = []
    recommendation: str | None = None


class ReportRanking(BaseModel):
    keyword: str
    position: int | None = None
    url: str | None = None
    found: bool


class SiteReportResponse(BaseModel):
    domain: str
    keyword: str | None = None
    location_code: int
    language_code: str
    health_score: int | None = None  # 0–100, avg of analyzed page scores
    overview: OverviewBlock
    pages: list[PageReport] = []
    top_keywords: list[RankedKeywordRow] = []
    competitors: list[CompetitorRow] = []
    ranking: ReportRanking | None = None
    findings: list[str] = []
    recommendations: list[str] = []
    meta: Meta
