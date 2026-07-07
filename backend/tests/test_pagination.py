from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.api.v1 import projects as projects_api
from app.db.models import Organization, Project, User
from app.services.pagination import InvalidCursor, decode_cursor, encode_cursor


def test_cursor_round_trip():
    ts = datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone.utc)
    cur = encode_cursor(ts, "abc-123")
    back_ts, back_id = decode_cursor(cur)
    assert back_id == "abc-123" and back_ts == ts


def test_decode_rejects_garbage():
    with pytest.raises(InvalidCursor):
        decode_cursor("not-a-valid-cursor!!")


async def _seed_user(db) -> User:
    org = Organization(name="Acme", monthly_quota_cents=5000)
    db.add(org)
    await db.flush()
    user = User(email="owner@acme.test", hashed_password="x", org_id=org.id, role="owner")
    db.add(user)
    await db.commit()
    return user


@pytest.mark.asyncio
async def test_projects_pagination_walks_all_pages(db):
    user = await _seed_user(db)
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for i in range(5):
        db.add(
            Project(
                org_id=user.org_id, name=f"P{i}", type="serp",
                created_at=base + timedelta(minutes=i), updated_at=base + timedelta(minutes=i),
            )
        )
    await db.commit()

    page1 = await projects_api.list_projects(cursor=None, limit=2, db=db, user=user)
    assert len(page1.data) == 2
    assert page1.pagination.has_more is True
    assert page1.pagination.next_cursor

    page2 = await projects_api.list_projects(cursor=page1.pagination.next_cursor, limit=2, db=db, user=user)
    assert len(page2.data) == 2
    assert page2.pagination.has_more is True

    page3 = await projects_api.list_projects(cursor=page2.pagination.next_cursor, limit=2, db=db, user=user)
    assert len(page3.data) == 1
    assert page3.pagination.has_more is False
    assert page3.pagination.next_cursor is None

    # No overlaps and newest-first ordering across pages.
    names = [p.name for p in page1.data + page2.data + page3.data]
    assert names == ["P4", "P3", "P2", "P1", "P0"]
    assert len(set(names)) == 5
