from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, get_db_session
from app.db.models import Project, Schedule, User
from app.schemas.schedule import (
    ScheduleCreate,
    ScheduleListResponse,
    ScheduleOut,
    ScheduleUpdate,
)
from app.services import scheduler

router = APIRouter()

_DEFAULT_PROJECT = "Scheduled Reports"


def _label(s: Schedule) -> str:
    p = s.params or {}
    parts = [p.get("domain") or "site"]
    if p.get("keyword"):
        parts.append(f"“{p['keyword']}”")
    return f"Site Report · {' · '.join(parts)}"


def _out(s: Schedule) -> ScheduleOut:
    return ScheduleOut(
        id=s.id,
        kind=s.kind,
        frequency=s.frequency,
        params=s.params or {},
        project_id=s.project_id,
        active=s.active,
        next_run_at=s.next_run_at.isoformat(),
        last_run_at=s.last_run_at.isoformat() if s.last_run_at else None,
        last_status=s.last_status,
        label=_label(s),
    )


async def _ensure_project(db: AsyncSession, user: User, name: str) -> Project:
    existing = await db.scalar(
        select(Project).where(Project.org_id == user.org_id, Project.name == name)
    )
    if existing:
        return existing
    project = Project(org_id=user.org_id, name=name, type="serp")
    db.add(project)
    await db.flush()
    return project


async def _owned(db: AsyncSession, schedule_id: str, user: User) -> Schedule:
    s = await db.get(Schedule, schedule_id)
    if s is None or s.org_id != user.org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")
    return s


@router.post("", response_model=ScheduleOut, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    body: ScheduleCreate,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> ScheduleOut:
    if not (body.params.get("domain") or "").strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="params.domain is required")

    if body.project_id:
        project = await db.get(Project, body.project_id)
        if project is None or project.org_id != user.org_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    else:
        project = await _ensure_project(db, user, _DEFAULT_PROJECT)

    s = Schedule(
        org_id=user.org_id,
        user_id=user.id,
        project_id=project.id,
        kind=body.kind,
        params=body.params,
        frequency=body.frequency,
        active=True,
        next_run_at=scheduler._now(),  # eligible on the next tick
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return _out(s)


@router.get("", response_model=ScheduleListResponse)
async def list_schedules(
    db: AsyncSession = Depends(get_db_session), user: User = Depends(current_user)
) -> ScheduleListResponse:
    rows = (
        await db.scalars(
            select(Schedule)
            .where(Schedule.org_id == user.org_id)
            .order_by(Schedule.created_at.desc())
        )
    ).all()
    return ScheduleListResponse(items=[_out(s) for s in rows])


@router.patch("/{schedule_id}", response_model=ScheduleOut)
async def update_schedule(
    schedule_id: str,
    body: ScheduleUpdate,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> ScheduleOut:
    s = await _owned(db, schedule_id, user)
    if body.active is not None:
        s.active = body.active
    if body.frequency is not None:
        s.frequency = body.frequency
    await db.commit()
    await db.refresh(s)
    return _out(s)


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> None:
    s = await _owned(db, schedule_id, user)
    await db.delete(s)
    await db.commit()


@router.post("/{schedule_id}/run", response_model=ScheduleOut)
async def run_now(
    schedule_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> ScheduleOut:
    """Trigger a schedule immediately (also used by external cron)."""
    s = await _owned(db, schedule_id, user)
    status_str = await scheduler.run_schedule(db, s)
    s.last_run_at = scheduler._now()
    s.last_status = status_str
    await db.commit()
    await db.refresh(s)
    return _out(s)
