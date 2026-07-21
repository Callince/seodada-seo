"""Live DataForSEO account balance for the admin dashboard.

`appendix/user_data` is free but rate-limited (~6 calls/minute), so the result is
cached in the shared backend — every admin and every replica share one upstream
call. Failures degrade to an `error` field rather than raising: a credentials or
network problem must never break the admin dashboard.
"""
from __future__ import annotations

from app.core.logging import log
from app.integrations.dataforseo import account as account_api
from app.services.cache_backend import cache_backend

_KEY = "dfs:account"
_TTL = 300  # 5 min — balance moves slowly; keeps us well inside the rate limit


async def balance(force: bool = False) -> dict:
    """Account login + balance in integer cents. `force` bypasses the cache."""
    if not force:
        cached = await cache_backend.get(_KEY)
        if cached is not None:
            return {**cached, "from_cache": True}
    try:
        resolved = await account_api.user_data()
    except Exception as exc:  # noqa: BLE001 — degrade, never break the dashboard
        log.warning("dfs_account_failed", error=str(exc))
        return {"error": str(exc)[:200]}

    parsed = account_api.parse_user_data(resolved.result)
    await cache_backend.set(_KEY, parsed, _TTL)
    return {**parsed, "from_cache": False}
