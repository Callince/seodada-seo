from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import ACCESS, decode_token
from app.db.models import User
from app.db.session import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


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


def is_platform_admin(user: User) -> bool:
    return user.email.strip().lower() in settings.admin_email_list


async def require_admin(user: User = Depends(current_user)) -> User:
    """Gate for /admin routes — only emails listed in ADMIN_EMAILS pass."""
    if not is_platform_admin(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return user
