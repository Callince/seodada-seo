from fastapi import APIRouter, Depends

from app.api.deps import enforce_admin_permission
from app.api.limiter import enforce_login_rate_limit, enforce_rate_limit
from app.api.v1 import (
    admin,
    ai,
    ai_visibility,
    analyze,
    audit,
    auth,
    backlinks,
    billing,
    content,
    domains,
    keywords,
    local,
    onpage,
    projects,
    public_content,
    rank,
    report,
    schedules,
    serp,
    usage,
    webhooks,
    settings_user,
)

# Per-organization budget for the billed API groups.
_metered = [Depends(enforce_rate_limit)]

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(
    auth.router, prefix="/auth", tags=["auth"], dependencies=[Depends(enforce_login_rate_limit)]
)
api_router.include_router(serp.router, prefix="/serp", tags=["serp"], dependencies=_metered)
api_router.include_router(keywords.router, prefix="/keywords", tags=["keywords"], dependencies=_metered)
api_router.include_router(domains.router, prefix="/domains", tags=["domains"], dependencies=_metered)
api_router.include_router(onpage.router, prefix="/onpage", tags=["onpage"], dependencies=_metered)
api_router.include_router(analyze.router, prefix="/analyze", tags=["analyze"], dependencies=_metered)
api_router.include_router(content.router, prefix="/content", tags=["content"], dependencies=_metered)
api_router.include_router(rank.router, prefix="/rank", tags=["rank"], dependencies=_metered)
api_router.include_router(report.router, prefix="/report", tags=["report"], dependencies=_metered)
api_router.include_router(ai.router, prefix="/ai", tags=["ai"], dependencies=_metered)
api_router.include_router(backlinks.router, prefix="/backlinks", tags=["backlinks"], dependencies=_metered)
api_router.include_router(local.router, prefix="/local", tags=["local"], dependencies=_metered)
api_router.include_router(audit.router, prefix="/audit", tags=["audit"], dependencies=_metered)
api_router.include_router(ai_visibility.router, prefix="/ai-visibility", tags=["ai-visibility"], dependencies=_metered)
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(schedules.router, prefix="/schedules", tags=["schedules"])
api_router.include_router(usage.router, prefix="/usage", tags=["usage"])
api_router.include_router(settings_user.router, prefix="/settings", tags=["settings"])
api_router.include_router(
    admin.router, prefix="/admin", tags=["admin"], dependencies=[Depends(enforce_admin_permission)]
)
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
# Public reads — no auth, no rate-limit group.
api_router.include_router(billing.public_router, prefix="/public", tags=["public"])
api_router.include_router(public_content.router, prefix="/public", tags=["public"])
# Provider webhooks — no auth (verified by HMAC signature).
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
