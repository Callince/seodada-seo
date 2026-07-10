from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import Meta


class ListingsRequest(BaseModel):
    what: str = Field(min_length=2, max_length=200, description="Business type / name")
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    radius_km: int = Field(default=10, ge=1, le=100)
    limit: int = Field(default=20, ge=1, le=100)
    force_live: bool = False


class ListingRow(BaseModel):
    title: str | None = None
    category: str | None = None
    address: str | None = None
    phone: str | None = None
    url: str | None = None
    domain: str | None = None
    rating: float | None = None
    reviews: int | None = None
    lat: float | None = None
    lng: float | None = None
    is_claimed: bool | None = None


class ListingsResponse(BaseModel):
    what: str
    rows: list[ListingRow]
    meta: Meta
