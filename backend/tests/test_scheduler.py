from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.db.models import ApiCache, Organization, Project, ProjectRun, Schedule, User
from app.services import scheduler


def test_compute_next_run():
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    assert scheduler.compute_next_run("daily", base) == base + timedelta(days=1)
    assert scheduler.compute_next_run("weekly", base) == base + timedelta(weeks=1)
    assert scheduler.compute_next_run("monthly", base) == base + timedelta(days=30)
    assert scheduler.compute_next_run("bogus", base) == base + timedelta(weeks=1)  # default


async def _seed(db) -> tuple[User, Project]:
    org = Organization(name="Acme", monthly_quota_cents=100000)
    db.add(org)
    await db.flush()
    user = User(email="sch@acme.test", hashed_password="x", org_id=org.id, role="owner")
    project = Project(org_id=org.id, name="Scheduled Reports", type="serp")
    db.add_all([user, project])
    await db.commit()
    return user, project


def _fake_report():
    async def _site_report(db, user, domain, keyword, location_code, language_code, max_pages):
        return {"domain": domain, "health_score": 88, "pages": [],
                "meta": {"from_cache": False, "cost_cents": 9, "source": "composite", "latency_ms": 5}}
    return _site_report


@pytest.mark.asyncio
async def test_run_schedule_saves_reopenable_run(db, monkeypatch):
    monkeypatch.setattr(scheduler.report, "site_report", _fake_report())
    user, project = await _seed(db)
    sched = Schedule(
        org_id=user.org_id, user_id=user.id, project_id=project.id,
        kind="site_report", params={"domain": "acme.com"}, frequency="weekly",
        next_run_at=datetime(2020, 1, 1, tzinfo=timezone.utc),
    )
    db.add(sched)
    await db.commit()

    status = await scheduler.run_schedule(db, sched)
    await db.commit()
    assert status.startswith("ok")

    runs = list(await db.scalars(select(ProjectRun).where(ProjectRun.project_id == project.id)))
    assert len(runs) == 1 and runs[0].module == "report" and runs[0].result_ref
    snap = await db.scalar(select(ApiCache).where(ApiCache.params_hash == runs[0].result_ref))
    assert snap.response["result"]["health_score"] == 88


@pytest.mark.asyncio
async def test_run_due_claims_and_advances(db, monkeypatch):
    monkeypatch.setattr(scheduler.report, "site_report", _fake_report())
    user, project = await _seed(db)
    now = datetime(2026, 6, 1, tzinfo=timezone.utc)

    due = Schedule(org_id=user.org_id, user_id=user.id, project_id=project.id,
                   kind="site_report", params={"domain": "due.com"}, frequency="weekly",
                   next_run_at=now - timedelta(hours=1))
    future = Schedule(org_id=user.org_id, user_id=user.id, project_id=project.id,
                      kind="site_report", params={"domain": "later.com"}, frequency="weekly",
                      next_run_at=now + timedelta(days=3))
    db.add_all([due, future])
    await db.commit()

    ran = await scheduler.run_due(db, now)
    assert ran == 1

    await db.refresh(due)
    await db.refresh(future)

    def _utc(dt):  # SQLite returns tz-naive timestamps
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

    assert _utc(due.next_run_at) == now + timedelta(weeks=1)  # advanced
    assert due.last_status.startswith("ok")
    assert _utc(future.next_run_at) == now + timedelta(days=3)  # untouched

    # Running again at the same instant does nothing (already advanced).
    assert await scheduler.run_due(db, now) == 0
