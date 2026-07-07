"""AI Visibility — track which keywords cite a domain in Google's AI answers.

`check` starts a background job (one/two billed SERP calls per keyword, cached)
and returns a job id; the client polls `status/{task_id}` until finished.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends

from app.api.deps import current_user
from app.db.models import User
from app.schemas.ai_visibility import (
    AiVisibilityRequest,
    AiVisibilityStartResponse,
    AiVisibilityStatusResponse,
)
from app.services import ai_visibility as svc

router = APIRouter()


@router.post("/check", response_model=AiVisibilityStartResponse)
async def check(
    body: AiVisibilityRequest,
    user: User = Depends(current_user),
) -> AiVisibilityStartResponse:
    task_id = uuid.uuid4().hex
    svc.start_check(
        task_id, user.id, body.domain, body.keywords,
        body.location_code, body.language_code, body.device,
        body.include_ai_mode, body.force_live,
    )
    return AiVisibilityStartResponse(task_id=task_id)


@router.get("/status/{task_id}", response_model=AiVisibilityStatusResponse)
async def status(
    task_id: str,
    user: User = Depends(current_user),
) -> AiVisibilityStatusResponse:
    job = svc.get_job(task_id)
    if job is None:
        return AiVisibilityStatusResponse(
            task_id=task_id, progress="unknown",
            error="This check is no longer available — run a new one.",
        )
    return AiVisibilityStatusResponse(
        task_id=task_id,
        progress=job.progress,
        error=job.error,
        checked=job.checked,
        total=job.total,
        domain=job.domain,
        include_ai_mode=job.include_ai_mode,
        rows=job.rows,
        summary=job.summary or {},
    )
