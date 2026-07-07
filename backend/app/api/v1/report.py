from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, get_db_session
from app.db.models import User
from app.schemas.report import SiteReportRequest, SiteReportResponse
from app.services import report

router = APIRouter()


@router.post("/site", response_model=SiteReportResponse)
async def site(
    body: SiteReportRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> SiteReportResponse:
    keyword = body.keyword.strip().lower() if body.keyword and body.keyword.strip() else None
    data = await report.site_report(
        db, user, body.domain, keyword, body.location_code, body.language_code, body.max_pages,
        force_live=body.force_live,
    )
    return SiteReportResponse(**data)
