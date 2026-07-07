from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.api.v1 import projects as projects_api
from app.db.models import Organization, User
from app.schemas.projects import ProjectCreate, ProjectRunCreate


async def _seed_user(db, role="owner") -> User:
    org = Organization(name="Acme", monthly_quota_cents=5000)
    db.add(org)
    await db.flush()
    user = User(email=f"{role}@acme.test", hashed_password="x", org_id=org.id, role=role)
    db.add(user)
    await db.commit()
    return user


@pytest.mark.asyncio
async def test_save_and_reopen_run_is_free(db):
    user = await _seed_user(db)
    project = await projects_api.create_project(ProjectCreate(name="Q3 Audit"), db, user)

    result_snapshot = {
        "keyword": "running shoes",
        "results": [{"position": 1, "title": "Nike", "domain": "nike.com"}],
        "meta": {"from_cache": False, "cost_cents": 3, "source": "live", "latency_ms": 120},
    }
    run = await projects_api.save_run(
        project.id,
        ProjectRunCreate(module="serp", params={"keyword": "running shoes"}, result=result_snapshot),
        db,
        user,
    )

    reopened = await projects_api.open_run(project.id, run.id, db, user)
    assert reopened.result["keyword"] == "running shoes"
    assert reopened.result["results"][0]["title"] == "Nike"
    # Reopening is always free, regardless of the original cost.
    assert reopened.result["meta"]["cost_cents"] == 0
    assert reopened.result["meta"]["from_cache"] is True
    assert reopened.result["meta"]["source"] == "saved"

    page = await projects_api.list_projects(cursor=None, limit=50, db=db, user=user)
    assert page.data[0].run_count == 1
    assert page.pagination.has_more is False


@pytest.mark.asyncio
async def test_only_owner_can_delete_project(db):
    owner = await _seed_user(db, role="owner")
    project = await projects_api.create_project(ProjectCreate(name="P"), db, owner)

    member = User(email="m@acme.test", hashed_password="x", org_id=owner.org_id, role="member")
    db.add(member)
    await db.commit()

    with pytest.raises(HTTPException) as exc:
        await projects_api.delete_project(project.id, db, member)
    assert exc.value.status_code == 403

    await projects_api.delete_project(project.id, db, owner)  # owner succeeds
    empty = await projects_api.list_projects(cursor=None, limit=50, db=db, user=owner)
    assert empty.data == []


@pytest.mark.asyncio
async def test_cannot_access_other_orgs_project(db):
    user_a = await _seed_user(db, role="owner")
    project = await projects_api.create_project(ProjectCreate(name="A"), db, user_a)

    other_org = Organization(name="Other")
    db.add(other_org)
    await db.flush()
    user_b = User(email="b@other.test", hashed_password="x", org_id=other_org.id, role="owner")
    db.add(user_b)
    await db.commit()

    with pytest.raises(HTTPException) as exc:
        await projects_api.get_project(project.id, db, user_b)
    assert exc.value.status_code == 404
