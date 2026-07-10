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
    BLCompetitorsResponse,
    HistoryResponse,
    LinkGapRequest,
    LinkGapResponse,
    NewLostResponse,
    ReferringDomainsResponse,
    SpamScoreResponse,
)
from app.services import engine, usage

router = APIRouter()

# Timeseries endpoints cover the trailing 12 months, snapped to the month so
# the cache key is stable for the whole day.
def _year_range() -> tuple[str, str]:
    from datetime import date

    today = date.today()
    return (today.replace(year=today.year - 1).isoformat(), today.isoformat())


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


@router.post("/history", response_model=HistoryResponse)
async def history(
    body: BacklinksRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> HistoryResponse:
    target = _target(body)
    d_from, d_to = _year_range()
    resolved = await usage.metered(
        db, user, "backlinks.history",
        {"target": target, "from": d_from, "to": d_to},
        engine.TTL["backlinks"],
        lambda: bl.timeseries(target, d_from, d_to),
        force_live=body.force_live,
    )
    return HistoryResponse(target=target, rows=bl.parse_timeseries(resolved.data), meta=resolved.meta())


@router.post("/new-lost", response_model=NewLostResponse)
async def new_lost(
    body: BacklinksRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> NewLostResponse:
    target = _target(body)
    d_from, d_to = _year_range()
    resolved = await usage.metered(
        db, user, "backlinks.new_lost",
        {"target": target, "from": d_from, "to": d_to},
        engine.TTL["backlinks"],
        lambda: bl.new_lost(target, d_from, d_to),
        force_live=body.force_live,
    )
    return NewLostResponse(target=target, rows=bl.parse_new_lost(resolved.data), meta=resolved.meta())


@router.post("/competitors", response_model=BLCompetitorsResponse)
async def bl_competitors(
    body: BacklinksRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> BLCompetitorsResponse:
    target = _target(body)
    resolved = await usage.metered(
        db, user, "backlinks.competitors",
        {"target": target, "limit": body.limit},
        engine.TTL["backlinks"],
        lambda: bl.competitors(target, min(body.limit, 50)),
        force_live=body.force_live,
    )
    return BLCompetitorsResponse(
        target=target, rows=bl.parse_competitors(resolved.data), meta=resolved.meta()
    )


@router.post("/spam-score", response_model=SpamScoreResponse)
async def spam_score(
    body: BacklinksRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> SpamScoreResponse:
    target = _target(body)
    resolved = await usage.metered(
        db, user, "backlinks.spam_score",
        {"target": target},
        engine.TTL["backlinks"],
        lambda: bl.spam_score(target),
        force_live=body.force_live,
    )
    return SpamScoreResponse(
        target=target, spam_score=bl.parse_spam_score(resolved.data), meta=resolved.meta()
    )


@router.post("/link-gap", response_model=LinkGapResponse)
async def link_gap(
    body: LinkGapRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> LinkGapResponse:
    target = bl._clean(body.target)  # noqa: SLF001
    comps = sorted(bl._clean(c) for c in body.competitors)  # noqa: SLF001 — stable cache key
    resolved = await usage.metered(
        db, user, "backlinks.link_gap",
        {"target": target, "competitors": comps, "limit": body.limit},
        engine.TTL["backlinks"],
        lambda: bl.link_gap(target, comps, body.limit),
        force_live=body.force_live,
    )
    return LinkGapResponse(target=target, rows=bl.parse_link_gap(resolved.data), meta=resolved.meta())
