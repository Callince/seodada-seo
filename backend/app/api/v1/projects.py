from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, get_db_session
from app.db.models import ApiCache, Project, ProjectRun, User
from app.schemas.common import CursorPage, Page
from app.schemas.projects import (
    ProjectCreate,
    ProjectDetail,
    ProjectOut,
    ProjectRunCreate,
    ProjectRunOut,
    ProjectRunResult,
    ProjectUpdate,
)
from app.services import engine
from app.services.pagination import InvalidCursor, decode_cursor, encode_cursor

router = APIRouter()


def _keyset_before(ts_col, id_col, cursor: str | None):
    """Build a keyset predicate for DESC ordering by (ts_col, id_col)."""
    if not cursor:
        return None
    try:
        ts, cid = decode_cursor(cursor)
    except InvalidCursor as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return or_(ts_col < ts, and_(ts_col == ts, id_col < cid))

# Saved snapshots never expire on their own; reopening is always $0.
_SNAPSHOT_TTL = timedelta(days=3650)


async def _owned_project(db: AsyncSession, project_id: str, user: User) -> Project:
    project = await db.get(Project, project_id)
    if project is None or project.org_id != user.org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


_SERIES_WEEKS = 8


class _RunStats:
    __slots__ = ("count", "target", "last_run_at", "series")

    def __init__(self) -> None:
        self.count = 0
        self.target: str | None = None
        self.last_run_at = None
        self.series = [0] * _SERIES_WEEKS


async def _run_stats(db: AsyncSession, project_ids: list[str]) -> dict[str, _RunStats]:
    """Derive run_count, latest target, last_run_at and a weekly activity series
    per project — bounded work regardless of how many runs a project has:
    SQL aggregates for count/last-run, a windowed pick of the newest run's
    params, and only the last 8 weeks of rows for the series."""
    if not project_ids:
        return {}
    out: dict[str, _RunStats] = {}

    agg = await db.execute(
        select(ProjectRun.project_id, func.count(ProjectRun.id), func.max(ProjectRun.created_at))
        .where(ProjectRun.project_id.in_(project_ids))
        .group_by(ProjectRun.project_id)
    )
    for pid, count, last in agg.all():
        s = out.setdefault(pid, _RunStats())
        s.count = int(count)
        s.last_run_at = last

    # The newest run's params per project — for the display target.
    rn = (
        func.row_number()
        .over(partition_by=ProjectRun.project_id, order_by=ProjectRun.created_at.desc())
        .label("rn")
    )
    newest = (
        select(ProjectRun.project_id, ProjectRun.params, rn)
        .where(ProjectRun.project_id.in_(project_ids))
        .subquery()
    )
    rows = await db.execute(select(newest.c.project_id, newest.c.params).where(newest.c.rn == 1))
    for pid, params in rows.all():
        if isinstance(params, dict):
            out.setdefault(pid, _RunStats()).target = (
                params.get("target") or params.get("keyword") or params.get("url")
            )

    now = engine._now()
    recent = await db.execute(
        select(ProjectRun.project_id, ProjectRun.created_at).where(
            ProjectRun.project_id.in_(project_ids),
            ProjectRun.created_at >= now - timedelta(weeks=_SERIES_WEEKS),
        )
    )
    for pid, created_at in recent.all():
        if created_at.tzinfo is None:  # SQLite returns naive datetimes
            created_at = created_at.replace(tzinfo=now.tzinfo)
        weeks_ago = int((now - created_at).days // 7)
        if 0 <= weeks_ago < _SERIES_WEEKS:
            out.setdefault(pid, _RunStats()).series[_SERIES_WEEKS - 1 - weeks_ago] += 1
    return out


def _project_out(project: Project, stats: _RunStats | None) -> ProjectOut:
    s = stats or _RunStats()
    return ProjectOut(
        id=project.id,
        name=project.name,
        type=project.type,
        config=project.config or {},
        created_at=project.created_at,
        updated_at=project.updated_at,
        run_count=s.count,
        target=s.target,
        last_run_at=s.last_run_at,
        runs_series=s.series if s.count else [],
    )


@router.get("", response_model=Page[ProjectOut])
async def list_projects(
    cursor: str | None = Query(default=None, description="Opaque pagination cursor."),
    limit: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> Page[ProjectOut]:
    q = (
        select(Project)
        .where(Project.org_id == user.org_id)
        .order_by(Project.updated_at.desc(), Project.id.desc())
    )
    keyset = _keyset_before(Project.updated_at, Project.id, cursor)
    if keyset is not None:
        q = q.where(keyset)
    rows = (await db.scalars(q.limit(limit + 1))).all()
    has_more = len(rows) > limit
    rows = rows[:limit]
    stats = await _run_stats(db, [p.id for p in rows])
    data = [_project_out(p, stats.get(p.id)) for p in rows]
    next_cursor = encode_cursor(rows[-1].updated_at, rows[-1].id) if has_more and rows else None
    return Page(data=data, pagination=CursorPage(next_cursor=next_cursor, has_more=has_more))


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> ProjectOut:
    project = Project(org_id=user.org_id, name=body.name, type=body.type, config=body.config)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return _project_out(project, None)


@router.get("/{project_id}", response_model=ProjectDetail)
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> ProjectDetail:
    project = await _owned_project(db, project_id, user)
    runs = (
        await db.scalars(
            select(ProjectRun)
            .where(ProjectRun.project_id == project.id)
            .order_by(ProjectRun.created_at.desc())
        )
    ).all()
    return ProjectDetail(
        id=project.id,
        name=project.name,
        type=project.type,
        config=project.config or {},
        created_at=project.created_at,
        updated_at=project.updated_at,
        run_count=len(runs),
        runs=[
            ProjectRunOut(id=r.id, module=r.module, params=r.params or {}, created_at=r.created_at)
            for r in runs
        ],
    )


@router.put("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: str,
    body: ProjectUpdate,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> ProjectOut:
    project = await _owned_project(db, project_id, user)
    if body.name is not None:
        project.name = body.name
    if body.config is not None:
        project.config = body.config
    await db.commit()
    await db.refresh(project)
    stats = await _run_stats(db, [project.id])
    return _project_out(project, stats.get(project.id))


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> None:
    if user.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the organization owner can delete projects.",
        )
    project = await _owned_project(db, project_id, user)
    refs = (
        await db.scalars(
            select(ProjectRun.result_ref).where(ProjectRun.project_id == project.id)
        )
    ).all()
    snapshot_keys = [r for r in refs if r]
    if snapshot_keys:
        await db.execute(delete(ApiCache).where(ApiCache.params_hash.in_(snapshot_keys)))
    await db.delete(project)
    await db.commit()


@router.post(
    "/{project_id}/runs", response_model=ProjectRunOut, status_code=status.HTTP_201_CREATED
)
async def save_run(
    project_id: str,
    body: ProjectRunCreate,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> ProjectRunOut:
    project = await _owned_project(db, project_id, user)
    run = ProjectRun(project_id=project.id, module=body.module, params=body.params)
    db.add(run)
    await db.flush()  # assign run.id

    # Persist the structured snapshot in api_cache so reopening is always $0.
    snapshot_key = engine.params_hash("project_run", {"run_id": run.id})
    now = engine._now()
    db.add(
        ApiCache(
            endpoint="project_run",
            params_hash=snapshot_key,
            response={"result": body.result},
            cost_cents=0,
            fetched_at=now,
            expires_at=now + _SNAPSHOT_TTL,
        )
    )
    run.result_ref = snapshot_key
    project.updated_at = now
    await db.commit()
    await db.refresh(run)
    return ProjectRunOut(id=run.id, module=run.module, params=run.params or {}, created_at=run.created_at)


@router.get("/{project_id}/runs", response_model=Page[ProjectRunOut])
async def list_runs(
    project_id: str,
    cursor: str | None = Query(default=None, description="Opaque pagination cursor."),
    limit: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> Page[ProjectRunOut]:
    project = await _owned_project(db, project_id, user)
    q = (
        select(ProjectRun)
        .where(ProjectRun.project_id == project.id)
        .order_by(ProjectRun.created_at.desc(), ProjectRun.id.desc())
    )
    keyset = _keyset_before(ProjectRun.created_at, ProjectRun.id, cursor)
    if keyset is not None:
        q = q.where(keyset)
    rows = (await db.scalars(q.limit(limit + 1))).all()
    has_more = len(rows) > limit
    rows = rows[:limit]
    data = [
        ProjectRunOut(id=r.id, module=r.module, params=r.params or {}, created_at=r.created_at)
        for r in rows
    ]
    next_cursor = encode_cursor(rows[-1].created_at, rows[-1].id) if has_more and rows else None
    return Page(data=data, pagination=CursorPage(next_cursor=next_cursor, has_more=has_more))


@router.get("/{project_id}/runs/{run_id}", response_model=ProjectRunResult)
async def open_run(
    project_id: str,
    run_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> ProjectRunResult:
    project = await _owned_project(db, project_id, user)
    run = await db.get(ProjectRun, run_id)
    if run is None or run.project_id != project.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    result: dict = {}
    if run.result_ref:
        snapshot = await db.scalar(
            select(ApiCache).where(ApiCache.params_hash == run.result_ref)
        )
        if snapshot is not None:
            result = snapshot.response.get("result", {})
    if isinstance(result, dict) and "meta" in result and isinstance(result["meta"], dict):
        result["meta"] = {**result["meta"], "from_cache": True, "cost_cents": 0, "source": "saved"}
    return ProjectRunResult(
        id=run.id, module=run.module, params=run.params or {}, result=result, created_at=run.created_at
    )
