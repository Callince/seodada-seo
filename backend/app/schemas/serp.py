from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import Meta


class SerpRankingRequest(BaseModel):
    keyword: str = Field(min_length=1, max_length=300)
    location_code: int = 2840  # United States
    language_code: str = "en"
    depth: int = Field(default=10, ge=1, le=100)
    device: Literal["desktop", "mobile"] = "desktop"
    # True bypasses every cache read and fetches fresh (billed) data upstream.
    force_live: bool = False


class SerpResult(BaseModel):
    position: int | None = None  # organic rank (1..N, gapless)
    serp_slot: int | None = None  # absolute slot among all SERP elements
    featured: bool = False  # True when this is the featured snippet
    title: str = ""
    description: str | None = None
    url: str = ""
    domain: str = ""
    brand_name: str = ""
    brand_volume: int | None = None


class PaaItem(BaseModel):
    question: str = ""
    answer: str | None = None
    url: str | None = None


class SerpResponse(BaseModel):
    keyword: str
    results: list[SerpResult]
    paa: list[PaaItem]
    meta: Meta
