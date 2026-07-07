from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Frequency = Literal["daily", "weekly", "monthly"]


class ScheduleCreate(BaseModel):
    kind: Literal["site_report"] = "site_report"
    frequency: Frequency = "weekly"
    params: dict = Field(default_factory=dict)  # e.g. {domain, keyword, location_code, ...}
    project_id: str | None = None  # target project; auto-created when omitted


class ScheduleUpdate(BaseModel):
    active: bool | None = None
    frequency: Frequency | None = None


class ScheduleOut(BaseModel):
    id: str
    kind: str
    frequency: str
    params: dict
    project_id: str
    active: bool
    next_run_at: str
    last_run_at: str | None = None
    last_status: str | None = None
    label: str  # human summary, e.g. "Site Report · nike.com"


class ScheduleListResponse(BaseModel):
    items: list[ScheduleOut] = []
