from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, get_db_session
from app.db.models import User
from app.services import usage as usage_service

router = APIRouter()


@router.get("/summary")
async def summary(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db_session)
):
    return await usage_service.summary(db, user.org_id)
