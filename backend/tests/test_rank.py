from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.api.v1 import rank as rank_api
from app.db.models import Organization, RankSnapshot, User
from app.schemas.rank import RankTrackRequest
from app.services import ranking


async def _seed_user(db) -> User:
    org = Organization(name="Acme", monthly_quota_cents=5000)
    db.add(org)
    await db.flush()
    user = User(email="rank@acme.test", hashed_password="x", org_id=org.id, role="owner")
    db.add(user)
    await db.commit()
    return user


def test_find_position_matches_subdomains():
    rows = [
        {"position": 1, "domain": "en.wikipedia.org", "url": "u1"},
        {"position": 2, "domain": "www.nike.com", "url": "u2"},
    ]
    assert ranking.find_position(rows, "nike.com") == (2, "u2")
    assert ranking.find_position(rows, "https://nike.com/") == (2, "u2")
    assert ranking.find_position(rows, "puma.com") == (None, None)


@pytest.mark.asyncio
async def test_track_records_snapshot(db, monkeypatch):
    from app.integrations.dataforseo.client import DfsResult

    async def fake_organic(*a, **k):
        items = [
            {"type": "organic", "rank_absolute": 1, "title": "t", "description": "d",
             "url": "https://nike.com/x", "domain": "nike.com"},
        ]
        return DfsResult(result=[{"items": items}], cost_cents=3)

    monkeypatch.setattr(rank_api.serp_api, "organic", fake_organic)
    user = await _seed_user(db)

    resp = await rank_api.track(
        RankTrackRequest(keyword="Running Shoes", domain="nike.com"), db, user
    )
    assert resp.found is True
    assert resp.position == 1
    assert resp.keyword == "running shoes"  # normalized
    assert len(resp.history) == 1

    rows = list(await db.scalars(select(RankSnapshot).where(RankSnapshot.org_id == user.org_id)))
    assert len(rows) == 1 and rows[0].position == 1


@pytest.mark.asyncio
async def test_tracked_aggregates_delta(db):
    user = await _seed_user(db)
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    db.add(RankSnapshot(org_id=user.org_id, keyword="seo tools", domain="acme.com",
                        position=5, created_at=base))
    db.add(RankSnapshot(org_id=user.org_id, keyword="seo tools", domain="acme.com",
                        position=3, created_at=base + timedelta(days=1)))
    await db.commit()

    out = await rank_api.tracked(db, user)
    assert len(out.items) == 1
    item = out.items[0]
    assert item.latest_position == 3
    assert item.previous_position == 5
    assert item.delta == 2  # moved up two spots
    assert item.observations == 2
