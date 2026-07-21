from __future__ import annotations

from pydantic import BaseModel, Field


class AuditStartRequest(BaseModel):
    domain: str = Field(min_length=3, max_length=255)
    max_crawl_pages: int = Field(default=50, ge=5, le=200)


class AuditStartResponse(BaseModel):
    task_id: str
    cost_cents: float
    max_crawl_pages: int


class AuditIssue(BaseModel):
    check: str
    label: str
    severity: str  # error | warning | notice
    count: int


class AuditPageRow(BaseModel):
    url: str | None = None
    status_code: int | None = None
    onpage_score: float | None = None
    title: str | None = None
    word_count: int | None = None
    internal_links: int | None = None
    external_links: int | None = None
    load_time_ms: float | None = None
    failed_checks: list[str] = []


class AuditStatusResponse(BaseModel):
    task_id: str
    progress: str  # queued | in_progress | finished | error | unknown
    error: str | None = None
    pages_crawled: int | None = None
    pages_in_queue: int | None = None
    max_crawl_pages: int | None = None
    onpage_score: float | None = None
    total_pages: int | None = None
    ssl: bool | None = None
    cms: str | None = None
    server: str | None = None
    errors: int = 0
    warnings: int = 0
    notices: int = 0
    issues: list[AuditIssue] = []
    pages: list[AuditPageRow] = []
