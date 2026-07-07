"""Backlinks & Domain Authority — DataForSEO Backlinks API.

When the Backlinks subscription is not active, the summary endpoint degrades
gracefully: authority comes from the free OpenPageRank index instead of
erroring, so the Domain Authority ring and competitor comparison keep working.
Full link lists (backlinks / referring domains / anchors) still need the
subscription — no free index provides them.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, get_db_session
from app.db.models import User
from app.integrations.dataforseo import backlinks as bl
from app.integrations.dataforseo.client import DataForSEOError
from app.integrations.free import openpagerank as opr
from app.schemas.backlinks import (
    AnchorsResponse,
    BacklinksListResponse,
    BacklinksRequest,
    BacklinksSummary,
    BacklinksSummaryResponse,
    ReferringDomainsResponse,
)
from app.services import engine, usage

router = APIRouter()


def _target(body: BacklinksRequest) -> str:
    return bl._clean(body.target)  # noqa: SLF001 — same module family


def _is_subscription_gate(exc: DataForSEOError) -> bool:
    return "plans and subscriptions" in exc.message.lower()


@router.post("/summary", response_model=BacklinksSummaryResponse)
async def summary(
    body: BacklinksRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> BacklinksSummaryResponse:
    target = _target(body)
    try:
        resolved = await usage.metered(
            db, user, "backlinks.summary",
            {"target": target},
            engine.TTL["backlinks"],
            lambda: bl.summary(target),
            force_live=body.force_live,
        )
        return BacklinksSummaryResponse(
            target=target, summary=bl.parse_summary(resolved.data), meta=resolved.meta()
        )
    except DataForSEOError as exc:
        if not (_is_subscription_gate(exc) and opr.available()):
            raise

    # Free fallback — authority via OpenPageRank (no key = the except re-raised).
    resolved = await usage.metered(
        db, user, "backlinks.opr",
        {"target": target},
        engine.TTL["backlinks"],
        lambda: opr.page_rank([target]),
        force_live=body.force_live,
    )
    info = opr.parse(resolved.data).get(target)
    summary_ = BacklinksSummary(
        authority=info["authority"] if info else None,
        global_rank=info["global_rank"] if info else None,
    )
    return BacklinksSummaryResponse(
        target=target, summary=summary_, source="openpagerank", meta=resolved.meta()
    )


@router.post("/list", response_model=BacklinksListResponse)
async def backlinks_list(
    body: BacklinksRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> BacklinksListResponse:
    target = _target(body)
    resolved = await usage.metered(
        db, user, "backlinks.list",
        {"target": target, "limit": body.limit},
        engine.TTL["backlinks"],
        lambda: bl.backlinks_list(target, body.limit),
        force_live=body.force_live,
    )
    return BacklinksListResponse(
        target=target, rows=bl.parse_backlinks(resolved.data), meta=resolved.meta()
    )


@router.post("/referring-domains", response_model=ReferringDomainsResponse)
async def referring(
    body: BacklinksRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> ReferringDomainsResponse:
    target = _target(body)
    resolved = await usage.metered(
        db, user, "backlinks.referring_domains",
        {"target": target, "limit": body.limit},
        engine.TTL["backlinks"],
        lambda: bl.referring_domains(target, body.limit),
        force_live=body.force_live,
    )
    return ReferringDomainsResponse(
        target=target, rows=bl.parse_referring_domains(resolved.data), meta=resolved.meta()
    )


@router.post("/anchors", response_model=AnchorsResponse)
async def anchors(
    body: BacklinksRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> AnchorsResponse:
    target = _target(body)
    resolved = await usage.metered(
        db, user, "backlinks.anchors",
        {"target": target, "limit": body.limit},
        engine.TTL["backlinks"],
        lambda: bl.anchors(target, body.limit),
        force_live=body.force_live,
    )
    return AnchorsResponse(
        target=target, rows=bl.parse_anchors(resolved.data), meta=resolved.meta()
    )
