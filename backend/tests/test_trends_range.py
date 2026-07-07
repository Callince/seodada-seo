from __future__ import annotations

import pytest

from app.integrations.dataforseo import keywords as kw
from app.integrations.dataforseo.client import DfsResult


@pytest.mark.asyncio
async def test_custom_date_range_payload(monkeypatch):
    captured: dict = {}

    async def fake_post(path, payload):
        captured["path"] = path
        captured["payload"] = payload
        return DfsResult(result=[], cost_cents=0)

    monkeypatch.setattr(kw.dfs_client, "post", fake_post)

    await kw.google_trends(["bitcoin"], 2840, "en", "past_12_months", "2026-01-01", "2026-03-31")
    p = captured["payload"]
    assert p["date_from"] == "2026-01-01"
    assert p["date_to"] == "2026-03-31"
    assert "time_range" not in p  # custom window overrides the named range


@pytest.mark.asyncio
async def test_named_range_payload_when_no_dates(monkeypatch):
    captured: dict = {}

    async def fake_post(path, payload):
        captured["payload"] = payload
        return DfsResult(result=[], cost_cents=0)

    monkeypatch.setattr(kw.dfs_client, "post", fake_post)

    await kw.google_trends(["bitcoin"], 2840, "en", "past_30_days")
    p = captured["payload"]
    assert p["time_range"] == "past_30_days"
    assert "date_from" not in p
