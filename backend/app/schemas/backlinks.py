from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import Meta


class BacklinksRequest(BaseModel):
    target: str = Field(min_length=3, max_length=255)
    limit: int = Field(default=50, ge=1, le=200)
    force_live: bool = False


class BacklinksSummary(BaseModel):
    rank: float | None = None
    authority: int | None = None  # 0-100, mapped from DataForSEO rank (0-1000)
    backlinks: int | None = None
    referring_domains: int | None = None
    referring_main_domains: int | None = None
    broken_backlinks: int | None = None
    referring_ips: int | None = None
    dofollow: int | None = None
    nofollow: int | None = None
    first_seen: str | None = None
    global_rank: int | None = None  # OpenPageRank global position (fallback source)


class BacklinksSummaryResponse(BaseModel):
    target: str
    summary: BacklinksSummary
    # "dataforseo" (full link data) or "openpagerank" (free authority fallback).
    source: str = "dataforseo"
    meta: Meta


class BacklinkRow(BaseModel):
    domain_from: str | None = None
    url_from: str | None = None
    url_to: str | None = None
    anchor: str | None = None
    dofollow: bool = False
    domain_from_rank: float | None = None
    page_from_rank: float | None = None
    first_seen: str | None = None
    last_seen: str | None = None


class BacklinksListResponse(BaseModel):
    target: str
    rows: list[BacklinkRow]
    meta: Meta


class ReferringDomainRow(BaseModel):
    domain: str | None = None
    rank: float | None = None
    authority: int | None = None
    backlinks: int | None = None
    referring_pages: int | None = None
    first_seen: str | None = None


class ReferringDomainsResponse(BaseModel):
    target: str
    rows: list[ReferringDomainRow]
    meta: Meta


class AnchorRow(BaseModel):
    anchor: str | None = None
    backlinks: int | None = None
    referring_domains: int | None = None
    dofollow: bool = True


class AnchorsResponse(BaseModel):
    target: str
    rows: list[AnchorRow]
    meta: Meta
