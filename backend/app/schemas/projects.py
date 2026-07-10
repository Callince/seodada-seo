from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    type: str = Field(default="keyword")  # keyword | domain | serp
    config: dict[str, Any] = Field(default_factory=dict)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    config: dict[str, Any] | None = None


class ProjectRunCreate(BaseModel):
    module: str = Field(min_length=1, max_length=50)
    params: dict[str, Any] = Field(default_factory=dict)
    result: dict[str, Any] = Field(default_factory=dict)


class ProjectRunOut(BaseModel):
    id: str
    module: str
    params: dict[str, Any]
    created_at: datetime


class ProjectOut(BaseModel):
    id: str
    name: str
    type: str
    config: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    run_count: int = 0
    # Derived from saved runs (no extra storage):
    target: str | None = None          # most recent run's target/keyword
    last_run_at: datetime | None = None
    runs_series: list[int] = Field(default_factory=list)  # weekly run counts, oldest→newest


class ProjectDetail(ProjectOut):
    runs: list[ProjectRunOut] = Field(default_factory=list)


class ProjectRunResult(BaseModel):
    id: str
    module: str
    params: dict[str, Any]
    result: dict[str, Any]
    created_at: datetime
