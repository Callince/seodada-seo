"""Site Audit — self-hosted full-site crawl (no DataForSEO, $0).

The crawl runs in-process as a background task: `start` returns a job id
immediately and the client polls `status/{task_id}` (also free) until
`progress == "finished"`, at which point the response carries the issue
breakdown and crawled pages. See `app.services.crawler` for the engine.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, get_db_session
from app.db.models import User
from app.schemas.audit import AuditStartRequest, AuditStartResponse, AuditStatusResponse
from app.services import crawler, usage
from app.services.normalize import clean_domain

router = APIRouter()


@router.post("/start", response_model=AuditStartResponse)
async def start(
    body: AuditStartRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> AuditStartResponse:
    task_id = uuid.uuid4().hex
    crawler.start_crawl(task_id, clean_domain(body.domain), body.max_crawl_pages)
    # The crawl is free; record a $0 usage row so it still shows in history.
    await usage.record(db, user, "onpage.site_audit", 0, from_cache=False)
    return AuditStartResponse(task_id=task_id, cost_cents=0, max_crawl_pages=body.max_crawl_pages)


@router.get("/status/{task_id}", response_model=AuditStatusResponse)
async def status(
    task_id: str,
    user: User = Depends(current_user),
) -> AuditStatusResponse:
    job = crawler.get_job(task_id)
    if job is None:
        return AuditStatusResponse(
            task_id=task_id, progress="unknown",
            error="This audit is no longer available — start a new one.",
        )
    if job.progress == "error":
        return AuditStatusResponse(
            task_id=task_id, progress="error", error=job.error,
            max_crawl_pages=job.max_pages,
        )
    if job.progress == "finished" and job.result:
        return AuditStatusResponse(
            task_id=task_id, progress="finished",
            pages_crawled=job.pages_crawled, pages_in_queue=0,
            max_crawl_pages=job.max_pages, **job.result,
        )
    return AuditStatusResponse(
        task_id=task_id, progress=job.progress,
        pages_crawled=job.pages_crawled, pages_in_queue=job.pages_in_queue,
        max_crawl_pages=job.max_pages,
    )
