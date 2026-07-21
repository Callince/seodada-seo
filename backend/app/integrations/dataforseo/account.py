"""DataForSEO account info — balance and plan limits.

`appendix/user_data` is a free GET endpoint (no cost, ~6 calls/minute allowed),
so it never routes through the cost engine — but the caller caches it briefly to
stay well inside that rate limit.
"""
from __future__ import annotations

from typing import Any

from app.integrations.dataforseo.client import DfsResult, dfs_client

PATH_USER_DATA = "/v3/appendix/user_data"


async def user_data() -> DfsResult:
    return await dfs_client.get(PATH_USER_DATA)


def parse_user_data(result: list[dict[str, Any]]) -> dict:
    """result[0] = {login, timezone, rates: {limits, ...}, money: {balance,
    total, ...}, price: {...}}."""
    res = (result[0] if result else {}) or {}
    money = res.get("money") or {}
    limits = (res.get("rates") or {}).get("limits") or {}
    return {
        "login": res.get("login"),
        # USD floats upstream; keep integer cents to match the rest of the app.
        "balance_cents": int(round(float(money.get("balance") or 0) * 100)),
        "spent_total_cents": int(round(float(money.get("total") or 0) * 100)),
        "limit_minute": limits.get("minute", {}).get("total")
        if isinstance(limits.get("minute"), dict)
        else None,
    }
