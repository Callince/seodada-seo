"""Thin async client for the DataForSEO API v3.

Every endpoint is POST with a body that is an *array* of task objects; we send a
single-element array. The response envelope is:

    { "status_code": 20000, "cost": <usd>, "tasks": [
        { "status_code": 20000, "cost": <usd>, "result": [ ... ] } ] }

`post()` validates both envelope levels, returns the inner `result` list, and
reports the call cost in integer USD cents.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.core.logging import log

OK = 20000


class DataForSEOError(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        self.status_code = status_code
        self.message = message
        super().__init__(f"DataForSEO {status_code}: {message}")


@dataclass(slots=True)
class DfsResult:
    result: list[dict[str, Any]]
    cost_cents: float  # fractional — DataForSEO prices below a cent


class DataForSEOClient:
    def __init__(self) -> None:
        self._client = httpx.AsyncClient(
            base_url=settings.dfs_base_url,
            auth=(settings.dfs_login, settings.dfs_password),
            http2=True,
            timeout=httpx.Timeout(60.0),
            headers={"Content-Type": "application/json"},
        )

    @retry(
        retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, max=8),
        reraise=True,
    )
    async def _raw_post(self, path: str, body: list[dict]) -> dict:
        resp = await self._client.post(path, json=body)
        resp.raise_for_status()
        return resp.json()

    @retry(
        retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, max=8),
        reraise=True,
    )
    async def get(self, path: str) -> DfsResult:
        """GET endpoints (e.g. appendix/user_data) — same envelope, no body."""
        resp = await self._client.get(path)
        resp.raise_for_status()
        data = resp.json()
        if data.get("status_code") != OK:
            raise DataForSEOError(
                data.get("status_code", 0), data.get("status_message", "unknown error")
            )
        tasks = data.get("tasks") or []
        if not tasks or tasks[0].get("status_code") != OK:
            msg = tasks[0].get("status_message", "task error") if tasks else "no tasks"
            raise DataForSEOError(tasks[0].get("status_code", 0) if tasks else 0, msg)
        return DfsResult(
            result=tasks[0].get("result") or [],
            cost_cents=_to_cents(data.get("cost", 0)),
        )

    async def post(self, path: str, payload: dict) -> DfsResult:
        data = await self._raw_post(path, [payload])
        if data.get("status_code") != OK:
            raise DataForSEOError(
                data.get("status_code", 0), data.get("status_message", "unknown error")
            )
        tasks = data.get("tasks") or []
        if not tasks:
            return DfsResult(result=[], cost_cents=_to_cents(data.get("cost", 0)))
        task = tasks[0]
        if task.get("status_code") != OK:
            raise DataForSEOError(
                task.get("status_code", 0), task.get("status_message", "task error")
            )
        cost = _to_cents(data.get("cost", task.get("cost", 0)))
        result = task.get("result") or []
        log.info("dfs_call", path=path, cost_cents=cost, results=len(result))
        return DfsResult(result=result, cost_cents=cost)

    async def close(self) -> None:
        await self._client.aclose()


def _to_cents(usd: float | int | None) -> float:
    """USD -> cents, keeping sub-cent precision.

    DataForSEO bills in fractions of a cent — an AI Overview call is $0.002
    (0.2c). Rounding to whole cents recorded those as **free**, so real spend
    never appeared in the usage log or the admin spend report. 4dp keeps every
    real price exactly while trimming float noise.
    """
    return round(float(usd or 0) * 100, 4)


# Single shared client (one upstream DataForSEO account proxied for all tenants).
dfs_client = DataForSEOClient()
