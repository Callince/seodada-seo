from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import ACCESS, decode_token
from app.db.models import User
from app.db.session import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

# Canonical admin permission slugs (one per admin section/tab). Super-admins
# (ADMIN_EMAILS) implicitly hold all of these.
ADMIN_PERMISSIONS: list[str] = [
    "dashboard",
    "user_management",
    "content_management",
    "subscription_management",
    "payments",
    "contact_submissions",
    "email_logs",
    "search_history",
    "website_settings",
    "manage_roles",
]

# Longest-prefix map from an /admin/* path to the permission it requires. Paths
# not listed here need admin access but no specific permission.
_PATH_PERMISSIONS: list[tuple[str, str]] = [
    ("/admin/roles", "manage_roles"),
    ("/admin/users", "user_management"),
    ("/admin/blog-categories", "content_management"),
    ("/admin/blogs", "content_management"),
    ("/admin/webstories", "content_management"),
    ("/admin/subscriptions", "subscription_management"),
    ("/admin/plans", "subscription_management"),
    ("/admin/payments", "payments"),
    ("/admin/contact-submissions", "contact_submissions"),
    ("/admin/email-logs", "email_logs"),
    ("/admin/usage-history", "search_history"),
    ("/admin/settings", "website_settings"),
    ("/admin/stats", "dashboard"),
]


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async for session in get_db():
        yield session


async def current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db_session),
) -> User:
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise cred_exc
    user_id = decode_token(token, ACCESS)
    if not user_id:
        raise cred_exc
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise cred_exc
    return user


def is_super_admin(user: User) -> bool:
    """Config-defined super-admins (ADMIN_EMAILS) — implicitly hold every
    permission and cannot be edited/revoked from the Role Management UI."""
    return user.email.strip().lower() in settings.admin_email_list


def is_platform_admin(user: User) -> bool:
    """Anyone who may reach the admin area: a super-admin or a staff admin."""
    return is_super_admin(user) or bool(user.is_staff)


def effective_permissions(user: User) -> list[str]:
    if is_super_admin(user):
        return list(ADMIN_PERMISSIONS)
    return list(user.admin_permissions or [])


def has_permission(user: User, perm: str) -> bool:
    return is_super_admin(user) or perm in (user.admin_permissions or [])


async def require_admin(user: User = Depends(current_user)) -> User:
    """Gate for /admin routes — super-admins and staff admins pass."""
    if not is_platform_admin(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return user


def _required_permission(path: str) -> str | None:
    for prefix, perm in _PATH_PERMISSIONS:
        if path.startswith(prefix) or f"/api/v1{prefix}" in path:
            return perm
    return None


async def enforce_admin_permission(
    request: Request, user: User = Depends(current_user)
) -> User:
    """Router-level gate for the whole admin API: requires admin access, then
    checks the per-section permission mapped from the request path. Super-admins
    bypass. Endpoints with no mapped permission just need admin access."""
    if not is_platform_admin(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    perm = _required_permission(request.url.path)
    if perm and not has_permission(user, perm):
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"Missing permission: {perm}")
    return user
