"""Sliding-window rate limiting.

Two FastAPI dependencies backed by the shared cache (Redis in prod, in-process
in dev) so limits hold across workers:

  * `enforce_rate_limit`        — per-organization, guards the billed API groups.
  * `enforce_login_rate_limit`  — per-client-IP, guards unauthenticated auth routes
                                   against brute force.

Both raise `429` with a `Retry-After` header when the window is exhausted; the
RFC 7807 handler renders the body as `application/problem+json`.
"""
from __future__ import annotations

import time
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from app.api.deps import current_user
from app.core.config import settings
from app.db.models import User
from app.services.cache_backend import cache_backend

WINDOW = 60  # seconds


async def _hit(key: str, limit: int) -> None:
    # Sliding-window counter: the previous window's count, weighted by how much
    # of it still overlaps the trailing 60s, plus the current window's count.
    # Closes the 2x burst a plain fixed window allows at the boundary.
    now = time.time()
    window_start = int(now) - (int(now) % WINDOW)
    # TTL of 2 windows so the count is still readable as the "previous" window.
    count = await cache_backend.incr(f"{key}:{window_start}", WINDOW * 2)
    prev = await cache_backend.get_count(f"{key}:{window_start - WINDOW}")
    weighted = prev * (1 - (now - window_start) / WINDOW) + count
    if weighted > limit:
        retry_after = WINDOW - (int(now) % WINDOW)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit of {limit} requests per minute exceeded. Retry in {retry_after}s.",
            headers={"Retry-After": str(retry_after)},
        )


async def enforce_rate_limit(user: Annotated[User, Depends(current_user)]) -> None:
    """Per-organization request budget for billed endpoints."""
    if not settings.rate_limit_enabled:
        return
    await _hit(f"rl:org:{user.org_id}", settings.rate_limit_per_minute)


async def enforce_login_rate_limit(request: Request) -> None:
    """Per-IP throttle for the unauthenticated auth routes."""
    if not settings.rate_limit_enabled:
        return
    ip = request.client.host if request.client else "unknown"
    await _hit(f"rl:ip:{ip}", settings.login_rate_limit_per_minute)


async def enforce_public_demo_rate_limit(request: Request) -> None:
    """Per-IP throttle for the anonymous landing-page analyzer.

    Tighter than the login limit: every call fetches a third-party page, so an
    unthrottled endpoint is both an abuse vector and a way to make our server
    look like a crawler to someone else's site.
    """
    if not settings.rate_limit_enabled:
        return
    ip = request.client.host if request.client else "unknown"
    await _hit(f"rl:demo:{ip}", settings.public_demo_rate_limit_per_minute)
