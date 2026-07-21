"""Admin: website settings and roles & permissions (RBAC)."""
from __future__ import annotations



from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    ADMIN_PERMISSIONS,
    effective_permissions,
    get_db_session,
    is_super_admin,
    require_admin,
)
from app.core.config import settings
from app.core.security import hash_password
from app.db.models import (
    Organization,
    User,
    WebsiteSettings,
)
from app.schemas.admin import (
    AdminMeOut,
    AdminRoleCreate,
    AdminRoleOut,
    AdminRoleUpdate,
    WebsiteSettingsOut,
    WebsiteSettingsUpdate,
)

router = APIRouter()


# ---------------------------------------------------------------- site config

async def _get_or_create_settings(db: AsyncSession) -> WebsiteSettings:
    row = await db.scalar(select(WebsiteSettings).limit(1))
    if not row:
        row = WebsiteSettings()
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


@router.get("/settings", response_model=WebsiteSettingsOut)
async def get_settings(db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)):
    return await _get_or_create_settings(db)


@router.put("/settings", response_model=WebsiteSettingsOut)
async def update_settings(
    body: WebsiteSettingsUpdate,
    db: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_admin),
):
    row = await _get_or_create_settings(db)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return row



# ---------------------------------------------------- roles & permissions (RBAC)

def _role_out(u: User) -> AdminRoleOut:
    return AdminRoleOut(
        id=u.id, email=u.email, full_name=u.full_name, is_super=is_super_admin(u),
        is_active=u.is_active, permissions=effective_permissions(u), created_at=u.created_at,
    )


@router.get("/me", response_model=AdminMeOut)
async def admin_me(admin: User = Depends(require_admin)) -> AdminMeOut:
    """The signed-in admin's effective permissions — the frontend gates tabs on this."""
    return AdminMeOut(
        email=admin.email,
        is_super=is_super_admin(admin),
        permissions=effective_permissions(admin),
        all_permissions=list(ADMIN_PERMISSIONS),
    )


@router.get("/roles", response_model=list[AdminRoleOut])
async def list_roles(db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)):
    supers = settings.admin_email_list
    rows = await db.scalars(
        select(User).where(or_(User.is_staff.is_(True), User.email.in_(supers))).order_by(User.created_at)
    )
    return [_role_out(u) for u in rows]


@router.post("/roles", response_model=AdminRoleOut, status_code=status.HTTP_201_CREATED)
async def create_role(
    body: AdminRoleCreate, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    """Grant admin access: promotes an existing user, or creates a new admin account."""
    perms = [p for p in body.permissions if p in ADMIN_PERMISSIONS]
    existing = await db.scalar(select(User).where(User.email == body.email.lower()))
    if existing:
        if is_super_admin(existing):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This is a super-admin (ADMIN_EMAILS) — permissions are all-access by config.")
        existing.is_staff = True
        existing.admin_permissions = perms
        user = existing
    else:
        if not body.password or len(body.password) < 8:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "A password (min 8 chars) is required to create a new admin.")
        org = Organization(name=body.full_name.strip() or body.email, monthly_quota_cents=settings.default_org_quota_cents)
        db.add(org)
        await db.flush()
        user = User(
            email=body.email.lower(), hashed_password=hash_password(body.password),
            full_name=body.full_name.strip(), org_id=org.id, role="owner",
            is_verified=True, is_staff=True, admin_permissions=perms,
        )
        db.add(user)
    await db.commit()
    await db.refresh(user)
    return _role_out(user)


@router.patch("/roles/{user_id}", response_model=AdminRoleOut)
async def update_role(
    user_id: str, body: AdminRoleUpdate, db: AsyncSession = Depends(get_db_session), _: User = Depends(require_admin)
):
    user = await db.get(User, user_id)
    if not user or not (user.is_staff or is_super_admin(user)):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not an admin")
    if is_super_admin(user):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Super-admins are managed via ADMIN_EMAILS, not here.")
    if body.permissions is not None:
        user.admin_permissions = [p for p in body.permissions if p in ADMIN_PERMISSIONS]
        user.is_staff = True
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.full_name is not None:
        user.full_name = body.full_name.strip()
    await db.commit()
    await db.refresh(user)
    return _role_out(user)


@router.delete("/roles/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_role(
    user_id: str, db: AsyncSession = Depends(get_db_session), admin: User = Depends(require_admin)
):
    """Revoke a staff admin's access (the user account itself is kept)."""
    if user_id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot revoke your own admin access")
    user = await db.get(User, user_id)
    if not user:
        return
    if is_super_admin(user):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Super-admins are defined in ADMIN_EMAILS and can't be revoked here.")
    user.is_staff = False
    user.admin_permissions = []
    await db.commit()
