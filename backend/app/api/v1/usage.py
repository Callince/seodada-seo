from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, get_db_session
from app.core.config import settings
from app.db.models import User
from app.services import usage as usage_service

router = APIRouter()


@router.get("/summary")
async def summary(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db_session)
):
    return await usage_service.summary(db, user.org_id)


@router.get("/dashboard")
async def dashboard(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db_session)
):
    # Quota off, platform admin, or admin-granted unlimited — the UI renders a
    # 0 limit as ∞.
    return await usage_service.dashboard_stats(
        db, user.org_id,
        unlimited=(
            not settings.quota_enabled
            or usage_service._is_platform_admin(user)
            or bool(user.unlimited_usage)
        ),
    )
