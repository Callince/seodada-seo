from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.api import limiter
from app.db.models import User
from app.services.cache_backend import MemoryBackend


def _user(org: str) -> User:
    return User(email=f"u@{org}.test", hashed_password="x", org_id=org, role="owner")


@pytest.mark.asyncio
async def test_memory_incr_counts_within_window():
    b = MemoryBackend()
    assert await b.incr("k", 60) == 1
    assert await b.incr("k", 60) == 2
    assert await b.incr("other", 60) == 1  # independent key


@pytest.mark.asyncio
async def test_per_org_limit_blocks_after_threshold(monkeypatch):
    monkeypatch.setattr(limiter, "cache_backend", MemoryBackend())
    monkeypatch.setattr(limiter.settings, "rate_limit_enabled", True)
    monkeypatch.setattr(limiter.settings, "rate_limit_per_minute", 3)
    user = _user("org-1")

    for _ in range(3):
        await limiter.enforce_rate_limit(user)  # within budget

    with pytest.raises(HTTPException) as exc:
        await limiter.enforce_rate_limit(user)
    assert exc.value.status_code == 429
    assert "Retry-After" in exc.value.headers

    # A different org has its own independent bucket.
    await limiter.enforce_rate_limit(_user("org-2"))


@pytest.mark.asyncio
async def test_disabled_flag_bypasses(monkeypatch):
    monkeypatch.setattr(limiter, "cache_backend", MemoryBackend())
    monkeypatch.setattr(limiter.settings, "rate_limit_enabled", False)
    monkeypatch.setattr(limiter.settings, "rate_limit_per_minute", 1)
    user = _user("org-x")
    for _ in range(10):
        await limiter.enforce_rate_limit(user)  # never raises


@pytest.mark.asyncio
async def test_login_limit_is_per_ip(monkeypatch):
    monkeypatch.setattr(limiter, "cache_backend", MemoryBackend())
    monkeypatch.setattr(limiter.settings, "rate_limit_enabled", True)
    monkeypatch.setattr(limiter.settings, "login_rate_limit_per_minute", 2)

    class _Req:
        def __init__(self, ip):
            self.client = type("C", (), {"host": ip})()

    await limiter.enforce_login_rate_limit(_Req("1.2.3.4"))
    await limiter.enforce_login_rate_limit(_Req("1.2.3.4"))
    with pytest.raises(HTTPException) as exc:
        await limiter.enforce_login_rate_limit(_Req("1.2.3.4"))
    assert exc.value.status_code == 429
    # A different IP is unaffected.
    await limiter.enforce_login_rate_limit(_Req("9.9.9.9"))
