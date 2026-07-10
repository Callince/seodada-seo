"""AI Visibility — track which keywords cite a domain in Google's AI answers.

`check` starts a background job (one/two billed SERP calls per keyword, cached)
and returns a job id; the client polls `status/{task_id}` until finished.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends

from app.api.deps import current_user, get_db_session
from app.db.models import User
from sqlalchemy.ext.asyncio import AsyncSession
from app.integrations.dataforseo import ai_optimization as aio
from app.schemas.ai_visibility import (
    AiVolumeRequest,
    AiVolumeResponse,
    AskRequest,
    AskResponse,
    MentionsRequest,
    MentionsResponse,
    AiVisibilityRequest,
    AiVisibilityStartResponse,
    AiVisibilityStatusResponse,
)
from app.services import ai_visibility as svc
from app.services import engine, usage

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


# ---- AI Optimization API (LLM mentions subscription) -----------------------


@router.post("/mentions", response_model=MentionsResponse)
async def mentions(
    body: MentionsRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> MentionsResponse:
    """How often the domain is mentioned in LLM answers, by location/model."""
    domain = body.domain.strip().lower().removeprefix("https://").removeprefix("http://").removeprefix("www.").split("/")[0]
    resolved = await usage.metered(
        db, user, "ai_visibility.mentions",
        {"domain": domain},
        engine.TTL["ai_mentions"],
        lambda: aio.target_metrics(domain),
        force_live=body.force_live,
    )
    parsed = aio.parse_target_metrics(resolved.data)
    return MentionsResponse(
        domain=domain,
        mentions=parsed["mentions"],
        ai_search_volume=parsed["ai_search_volume"],
        dimensions=parsed["dimensions"],
        meta=resolved.meta(),
    )


@router.post("/ai-volume", response_model=AiVolumeResponse)
async def ai_volume(
    body: AiVolumeRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> AiVolumeResponse:
    """AI search volume (LLM prompt demand) for up to 20 keywords."""
    kws = sorted({k.strip().lower() for k in body.keywords if k.strip()})
    resolved = await usage.metered(
        db, user, "ai_visibility.ai_volume",
        {"keywords": kws, "loc": body.location_name},
        engine.TTL["ai_mentions"],
        lambda: aio.ai_keyword_volume(kws, body.location_name),
        force_live=body.force_live,
    )
    return AiVolumeResponse(rows=aio.parse_ai_keyword_volume(resolved.data), meta=resolved.meta())


@router.post("/ask", response_model=AskResponse)
async def ask(
    body: AskRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> AskResponse:
    """Ask a live LLM (via DataForSEO) — see the answer your buyers see."""
    resolved = await usage.metered(
        db, user, "ai_visibility.ask",
        {"prompt": body.prompt.strip().lower(), "model": body.model_name},
        engine.TTL["serp"],
        lambda: aio.llm_response(body.prompt, body.model_name),
        force_live=body.force_live,
    )
    parsed = aio.parse_llm_response(resolved.data)
    return AskResponse(
        model=parsed["model"],
        answer=parsed["answer"],
        input_tokens=parsed["input_tokens"],
        output_tokens=parsed["output_tokens"],
        meta=resolved.meta(),
    )
