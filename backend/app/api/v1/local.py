"""Local SEO — Google business listings around a location (Business Data API)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, get_db_session
from app.db.models import User
from app.integrations.dataforseo import local as local_api
from app.schemas.local import ListingsRequest, ListingsResponse
from app.services import engine, usage

router = APIRouter()


@router.post("/listings", response_model=ListingsResponse)
async def listings(
    body: ListingsRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> ListingsResponse:
    what = body.what.strip().lower()
    # Round coordinates so nearby searches share a cache entry.
    lat, lng = round(body.lat, 3), round(body.lng, 3)
    resolved = await usage.metered(
        db, user, "local.listings",
        {"what": what, "lat": lat, "lng": lng, "r": body.radius_km, "limit": body.limit},
        engine.TTL["local"],
        lambda: local_api.listings(what, lat, lng, body.radius_km, body.limit),
        force_live=body.force_live,
    )
    return ListingsResponse(
        what=what, rows=local_api.parse_listings(resolved.data), meta=resolved.meta()
    )
