from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.core.config import settings
from app.db.models import Organization, RankSnapshot, User
from app.services import rank_watch


async def _seed(db, *, snapshot_age_hours: float, position: int | None = 5):
    org = Organization(name="Acme", monthly_quota_cents=5000)
    db.add(org)
    await db.flush()
    user = User(email="owner@example.com", hashed_password="x", org_id=org.id, role="owner")
    db.add(user)
    snap = RankSnapshot(
        org_id=org.id, keyword="running shoes", domain="acme.com",
        location_code=2840, language_code="en", position=position, url="https://acme.com/",
        created_at=datetime.now(timezone.utc) - timedelta(hours=snapshot_age_hours),
    )
    db.add(snap)
    await db.commit()
    return org, user


@pytest.mark.asyncio
async def test_due_pairs_only_stale_groups(db):
    await _seed(db, snapshot_age_hours=25)
    due = await rank_watch.due_pairs(db)
    assert len(due) == 1 and due[0]["keyword"] == "running shoes"


@pytest.mark.asyncio
async def test_fresh_pairs_not_due(db):
    await _seed(db, snapshot_age_hours=2)
    assert await rank_watch.due_pairs(db) == []


@pytest.mark.asyncio
async def test_check_due_records_snapshot_and_alerts_on_big_move(db, monkeypatch):
    org, user = await _seed(db, snapshot_age_hours=25, position=8)
    monkeypatch.setattr(settings, "rank_alert_delta", 3)

    async def fake_fetch(db_, user_, keyword, loc, lang, domain, device="desktop"):
        return 2, "https://acme.com/shoes"  # moved 8 -> 2 (delta 6, alert-worthy)

    sent: dict = {}

    async def fake_send(to, subject, html):
        sent.update(to=to, subject=subject)
        return True

    monkeypatch.setattr(rank_watch, "_fetch_position", fake_fetch)
    monkeypatch.setattr(rank_watch.email, "send_email", fake_send)

    checked = await rank_watch.check_due(db)
    assert checked == 1
    assert sent["to"] == "owner@example.com" and "acme.com" in sent["subject"]

    # A fresh snapshot now exists, so nothing is due anymore.
    assert await rank_watch.due_pairs(db) == []


@pytest.mark.asyncio
async def test_small_move_does_not_alert(db, monkeypatch):
    await _seed(db, snapshot_age_hours=25, position=5)
    monkeypatch.setattr(settings, "rank_alert_delta", 3)

    async def fake_fetch(db_, user_, keyword, loc, lang, domain, device="desktop"):
        return 4, "https://acme.com/"  # delta 1 — below threshold

    sent: dict = {}

    async def fake_send(to, subject, html):
        sent["called"] = True
        return True

    monkeypatch.setattr(rank_watch, "_fetch_position", fake_fetch)
    monkeypatch.setattr(rank_watch.email, "send_email", fake_send)

    assert await rank_watch.check_due(db) == 1
    assert "called" not in sent


def test_should_alert_rules():
    assert rank_watch._should_alert(8, 2, 3) is True     # big move
    assert rank_watch._should_alert(5, 4, 3) is False    # small move
    assert rank_watch._should_alert(None, 7, 3) is True  # entered top 100
    assert rank_watch._should_alert(7, None, 3) is True  # dropped out
    assert rank_watch._should_alert(None, None, 3) is False


def test_alert_email_content():
    subject, html = rank_watch.build_alert_email("acme.com", "running shoes", 8, 2)
    assert "acme.com" in subject and "#8" in subject and "#2" in subject
    assert "running shoes" in html
