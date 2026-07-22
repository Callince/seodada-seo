from __future__ import annotations

from pydantic import BaseModel


class LocationItem(BaseModel):
    code: int  # DataForSEO location_code — what every research endpoint takes
    name: str
    region: str = ""  # state/province; "" for countries
    country_name: str
    country_iso: str
    kind: str  # country | city
    language_code: str

    @property
    def label(self) -> str:  # pragma: no cover - convenience only
        return f"{self.name}, {self.country_name}" if self.kind == "city" else self.name


class LocationSearchResponse(BaseModel):
    rows: list[LocationItem]
    # True when more matched than `limit` returned — lets the UI say "keep
    # typing" instead of implying these are all the matches there are.
    truncated: bool = False
