from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, get_db_session
from app.db.models import RankSnapshot, User
from app.integrations.dataforseo import serp as serp_api
from app.schemas.rank import (
    RankHistoryResponse,
    RankPoint,
    RankTrackRequest,
    RankTrackResponse,
    TrackedItem,
    TrackedListResponse,
)
from app.services import engine, ranking, usage

router = APIRouter()

_MAX_HISTORY = 90


async def _history(
    db: AsyncSession, org_id: str, keyword: str, domain: str
) -> list[RankSnapshot]:
    rows = await db.scalars(
        select(RankSnapshot)
        .where(
            RankSnapshot.org_id == org_id,
            RankSnapshot.keyword == keyword,
            RankSnapshot.domain == domain,
        )
        .order_by(RankSnapshot.created_at.asc())
        .limit(_MAX_HISTORY)
    )
    return list(rows)


def _points(snaps: list[RankSnapshot]) -> list[RankPoint]:
    return [
        RankPoint(position=s.position, url=s.url, created_at=s.created_at.isoformat())
        for s in snaps
    ]


@router.post("/track", response_model=RankTrackResponse)
async def track(
    body: RankTrackRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> RankTrackResponse:
    keyword = body.keyword.strip().lower()
    domain = ranking.normalize_domain(body.domain)
    fetch_fn = lambda: serp_api.organic(  # noqa: E731
        body.keyword, body.location_code, body.language_code, body.depth, body.device
    )

    resolved = await usage.metered(
        db, user, "serp.organic",
        {"keyword": keyword, "location_code": body.location_code,
         "language_code": body.language_code, "depth": body.depth,
         # Constant since Brave was removed; kept so existing cache entries
         # keep hashing the same rather than all re-billing.
         "device": body.device, "provider": "dataforseo"},
        engine.TTL["serp"],
        fetch_fn,
        force_live=body.force_live,
    )
    rows = serp_api.parse_organic(resolved.data)
    position, url = ranking.find_position(rows, domain)

    snap = RankSnapshot(
        org_id=user.org_id,
        keyword=keyword,
        domain=domain,
        location_code=body.location_code,
        language_code=body.language_code,
        device=body.device,
        position=position,
        url=url,
    )
    db.add(snap)
    await db.commit()

    history = await _history(db, user.org_id, keyword, domain)
    return RankTrackResponse(
        keyword=keyword,
        domain=domain,
        position=position,
        url=url,
        found=position is not None,
        depth=body.depth,
        history=_points(history),
        meta=resolved.meta(),
    )


@router.get("/history", response_model=RankHistoryResponse)
async def history(
    keyword: str = Query(...),
    domain: str = Query(...),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> RankHistoryResponse:
    kw = keyword.strip().lower()
    dom = ranking.normalize_domain(domain)
    snaps = await _history(db, user.org_id, kw, dom)
    return RankHistoryResponse(keyword=kw, domain=dom, history=_points(snaps))


@router.delete("/tracked", status_code=status.HTTP_204_NO_CONTENT)
async def untrack(
    keyword: str = Query(...),
    domain: str = Query(...),
    location_code: int = Query(...),
    language_code: str = Query(...),
    device: str = Query("desktop"),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> None:
    """Stop tracking a keyword — deletes its position history for this org.

    Tracked pairs are *derived* from RankSnapshot (there is no separate table),
    so removing the snapshots both drops it from the list and stops the daily
    auto-recheck. The position history is gone for good — the UI confirms first.
    Org-scoped: one tenant can never delete another's history.
    """
    await db.execute(
        delete(RankSnapshot).where(
            RankSnapshot.org_id == user.org_id,
            RankSnapshot.keyword == keyword.strip().lower(),
            RankSnapshot.domain == ranking.normalize_domain(domain),
            RankSnapshot.location_code == location_code,
            RankSnapshot.language_code == language_code,
            RankSnapshot.device == device,
        )
    )
    await db.commit()


@router.get("/tracked", response_model=TrackedListResponse)
async def tracked(
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> TrackedListResponse:
    rows = await db.scalars(
        select(RankSnapshot)
        .where(RankSnapshot.org_id == user.org_id)
        .order_by(RankSnapshot.created_at.asc())
    )
    # Group by (keyword, domain, location, language, device) → latest + previous.
    groups: dict[tuple, list[RankSnapshot]] = {}
    for s in rows:
        groups.setdefault(
            (s.keyword, s.domain, s.location_code, s.language_code, s.device), []
        ).append(s)

    items: list[TrackedItem] = []
    for (kw, dom, loc, lang, device), snaps in groups.items():
        latest = snaps[-1]
        previous = snaps[-2] if len(snaps) > 1 else None
        delta = None
        if previous and previous.position is not None and latest.position is not None:
            delta = previous.position - latest.position  # positive = moved up
        items.append(
            TrackedItem(
                keyword=kw,
                domain=dom,
                location_code=loc,
                language_code=lang,
                device=device,
                latest_position=latest.position,
                previous_position=previous.position if previous else None,
                delta=delta,
                last_checked=latest.created_at.isoformat(),
                observations=len(snaps),
            )
        )
    items.sort(key=lambda i: i.last_checked, reverse=True)
    return TrackedListResponse(items=items)
