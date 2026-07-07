from typing import Generic, TypeVar

from pydantic import BaseModel


class Meta(BaseModel):
    from_cache: bool
    cost_cents: int
    source: str
    latency_ms: int
    # ISO timestamp of when the data was fetched upstream (cache age indicator).
    fetched_at: str | None = None


class LocationParams(BaseModel):
    location_code: int = 2840  # United States
    language_code: str = "en"


T = TypeVar("T")


class CursorPage(BaseModel):
    next_cursor: str | None = None
    has_more: bool = False


class Page(BaseModel, Generic[T]):
    """Standard cursor-paginated collection envelope."""

    data: list[T]
    pagination: CursorPage
