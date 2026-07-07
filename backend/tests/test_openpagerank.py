"""OpenPageRank free authority provider — parsing + summary fallback."""
from __future__ import annotations

import pytest

from app.api.v1 import backlinks as route
from app.core.config import settings
from app.db.models import Organization, User
from app.integrations.dataforseo.client import DataForSEOError, DfsResult
from app.integrations.free import openpagerank as opr
from app.schemas.backlinks import BacklinksRequest


def test_parse_maps_score_to_0_100_authority():
    rows = [
        {"status_code": 200, "domain": "Komaki.in", "page_rank_decimal": 3.74, "rank": "812345"},
        {"status_code": 200, "domain": "google.com", "page_rank_decimal": 10, "rank": "1"},
        {"status_code": 404, "domain": "nope.invalid", "page_rank_decimal": "", "rank": ""},
    ]
    out = opr.parse(rows)
    assert out["komaki.in"]["authority"] == 37
    assert out["komaki.in"]["global_rank"] == 812345
    assert out["google.com"]["authority"] == 100
    assert "nope.invalid" not in out  # not-found domains dropped


def test_parse_handles_garbage_values():
    rows = [{"status_code": 200, "domain": "x.com", "page_rank_decimal": None, "rank": "n/a"}]
    out = opr.parse(rows)
    assert out["x.com"]["authority"] == 0 and out["x.com"]["global_rank"] is None


def test_available_requires_key(monkeypatch):
    monkeypatch.setattr(settings, "openpagerank_api_key", "")
    assert opr.available() is False
    monkeypatch.setattr(settings, "openpagerank_api_key", "k")
    assert opr.available() is True


async def _seed_user(db) -> User:
    org = Organization(name="Acme", monthly_quota_cents=5000)
    db.add(org)
    await db.flush()
    user = User(email="bl@acme.test", hashed_password="x", org_id=org.id, role="owner")
    db.add(user)
    await db.commit()
    return user


def _gated(*a, **k):
    raise DataForSEOError(40204, "Access denied. Visit Plans and Subscriptions")


async def _gated_async(*a, **k):
    _gated()


@pytest.mark.asyncio
async def test_summary_falls_back_to_openpagerank(db, monkeypatch):
    """Subscription-gated DataForSEO error → free OpenPageRank authority."""
    monkeypatch.setattr(settings, "openpagerank_api_key", "test-key")

    async def fake_opr(domains):
        return DfsResult(
            result=[{"status_code": 200, "domain": domains[0],
                     "page_rank_decimal": 3.74, "rank": "812345"}],
            cost_cents=0,
        )

    monkeypatch.setattr(route.bl, "summary", _gated_async)
    monkeypatch.setattr(route.opr, "page_rank", fake_opr)

    user = await _seed_user(db)
    resp = await route.summary(BacklinksRequest(target="komaki.in"), db, user)
    assert resp.source == "openpagerank"
    assert resp.summary.authority == 37
    assert resp.summary.global_rank == 812345
    assert resp.summary.backlinks is None  # link counts still need the subscription


@pytest.mark.asyncio
async def test_summary_still_errors_without_opr_key(db, monkeypatch):
    monkeypatch.setattr(settings, "openpagerank_api_key", "")
    monkeypatch.setattr(route.bl, "summary", _gated_async)

    user = await _seed_user(db)
    with pytest.raises(DataForSEOError):
        await route.summary(BacklinksRequest(target="komaki.in"), db, user)
