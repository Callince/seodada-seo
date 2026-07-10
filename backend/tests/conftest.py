from __future__ import annotations

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings as app_settings
from app.db.base import Base
from app.db import models  # noqa: F401  (register mappers)
from app.services.cache_backend import MemoryBackend


@pytest.fixture(autouse=True)
def pinned_settings(monkeypatch):
    """Keep tests independent of the developer's local .env (sandbox, no Brave)."""
    monkeypatch.setattr(app_settings, "dfs_use_sandbox", True)
    monkeypatch.setattr(app_settings, "brave_api_key", "")
    monkeypatch.setattr(app_settings, "serp_provider", "dataforseo")
    monkeypatch.setattr(app_settings, "smtp_host", "")
    monkeypatch.setattr(app_settings, "google_gmail_refresh_token", "")
    # Quota enforcement is opt-in per test (test_quota enables it).
    monkeypatch.setattr(app_settings, "quota_enabled", False)


@pytest_asyncio.fixture
async def db() -> AsyncSession:
    """A fresh in-memory SQLite database per test."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as session:
        yield session
    await engine.dispose()


@pytest.fixture(autouse=True)
def fresh_cache(monkeypatch):
    """Isolate the engine's L1 cache between tests."""
    backend = MemoryBackend()
    monkeypatch.setattr("app.services.engine.cache_backend", backend)
    return backend
