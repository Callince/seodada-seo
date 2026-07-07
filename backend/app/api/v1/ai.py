from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import current_user
from app.db.models import User
from app.schemas.ai import AiInsightsRequest, AiInsightsResponse
from app.services import ai

router = APIRouter()


@router.post("/insights", response_model=AiInsightsResponse)
async def insights(
    body: AiInsightsRequest,
    user: User = Depends(current_user),
) -> AiInsightsResponse:
    try:
        result = await ai.seo_insights(body.context)
    except ai.AiNotConfigured as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except ai.AiError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return AiInsightsResponse(**result)
