from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import Meta


class RankTrackRequest(BaseModel):
    keyword: str = Field(min_length=1, max_length=255)
    domain: str = Field(min_length=1, max_length=255)
    location_code: int = 2840
    language_code: str = "en"
    depth: int = Field(default=100, ge=10, le=100)
    device: Literal["desktop", "mobile"] = "desktop"
    # True bypasses the SERP cache and fetches a fresh (billed) snapshot.
    force_live: bool = False


class RankPoint(BaseModel):
    position: int | None = None
    url: str | None = None
    created_at: str


class RankTrackResponse(BaseModel):
    keyword: str
    domain: str
    position: int | None = None  # current observation; None = not found in results
    url: str | None = None
    found: bool
    depth: int
    history: list[RankPoint] = []
    meta: Meta


class TrackedItem(BaseModel):
    keyword: str
    domain: str
    location_code: int
    language_code: str
    device: str = "desktop"
    latest_position: int | None = None
    previous_position: int | None = None
    delta: int | None = None  # previous - latest (positive = improved/up)
    last_checked: str
    observations: int


class TrackedListResponse(BaseModel):
    items: list[TrackedItem] = []


class RankHistoryResponse(BaseModel):
    keyword: str
    domain: str
    history: list[RankPoint] = []
