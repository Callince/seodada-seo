"""Untracking a keyword — deletes its history, and nothing else's.

Tracking is derived from RankSnapshot, so DELETE /rank/tracked removes rows.
A delete endpoint that over-reaches would silently destroy a customer's history
(or another tenant's), so the blast radius is pinned here.
"""
from __future__ import annotations

import pytest
from sqlalchemy import func, select

from app.api.v1 import rank as rank_api
from app.db.models import Organization, RankSnapshot, User


async def _seed(db) -> tuple[User, User]:
    """Two orgs, each tracking the same keyword — the cross-tenant trap."""
    orgs = [Organization(id=f"o{i}", name=f"Org{i}", monthly_quota_cents=0) for i in (1, 2)]
    db.add_all(orgs)
    await db.flush()
    users = [
        User(id=f"u{i}", email=f"u{i}@t.test", hashed_password="x", org_id=f"o{i}")
        for i in (1, 2)
    ]
    db.add_all(users)

    for org in ("o1", "o2"):
        for pos in (3, 5):  # two observations = history worth protecting
            db.add(RankSnapshot(
                org_id=org, keyword="shoes", domain="nike.com", location_code=2840,
                language_code="en", device="desktop", position=pos, url="https://nike.com",
            ))
    # Same org, a different market + device — must survive an untrack of the above.
    db.add(RankSnapshot(
        org_id="o1", keyword="shoes", domain="nike.com", location_code=2356,
        language_code="en", device="desktop", position=7, url="https://nike.com",
    ))
    db.add(RankSnapshot(
        org_id="o1", keyword="shoes", domain="nike.com", location_code=2840,
        language_code="en", device="mobile", position=9, url="https://nike.com",
    ))
    await db.commit()
    return users[0], users[1]


async def _count(db, **filters) -> int:
    stmt = select(func.count(RankSnapshot.id))
    for k, v in filters.items():
        stmt = stmt.where(getattr(RankSnapshot, k) == v)
    return int(await db.scalar(stmt) or 0)


@pytest.mark.asyncio
async def test_untrack_deletes_only_that_pair(db):
    u1, _u2 = await _seed(db)
    assert await _count(db) == 6

    await rank_api.untrack(
        keyword="shoes", domain="nike.com", location_code=2840,
        language_code="en", device="desktop", db=db, user=u1,
    )

    # The targeted pair's history is gone…
    assert await _count(db, org_id="o1", location_code=2840, device="desktop") == 0
    # …but the other market, the other device, and the OTHER TENANT are untouched.
    assert await _count(db, org_id="o1", location_code=2356) == 1
    assert await _count(db, org_id="o1", device="mobile") == 1
    assert await _count(db, org_id="o2") == 2


@pytest.mark.asyncio
async def test_untrack_normalizes_input_like_track_does(db):
    u1, _ = await _seed(db)
    # The UI sends what it displays; tracking stored a lowercased keyword and a
    # normalized domain, so untrack must match through the same normalizer.
    await rank_api.untrack(
        keyword="  SHOES  ", domain="https://www.nike.com/", location_code=2840,
        language_code="en", device="desktop", db=db, user=u1,
    )
    assert await _count(db, org_id="o1", location_code=2840, device="desktop") == 0


@pytest.mark.asyncio
async def test_untrack_unknown_pair_is_a_no_op(db):
    u1, _ = await _seed(db)
    await rank_api.untrack(
        keyword="never tracked", domain="nope.com", location_code=2840,
        language_code="en", device="desktop", db=db, user=u1,
    )
    assert await _count(db) == 6  # nothing deleted, no error
