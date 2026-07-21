from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

ACCESS = "access"
REFRESH = "refresh"
RESET = "reset"

# bcrypt operates on at most 72 bytes; longer inputs are truncated by the algorithm.
_MAX_BYTES = 72


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8")[:_MAX_BYTES], bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8")[:_MAX_BYTES], hashed.encode("utf-8"))
    except ValueError:
        return False


def _create_token(subject: str, token_type: str, expires: timedelta, jti: str | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires,
    }
    if jti:
        payload["jti"] = jti
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(subject: str) -> str:
    return _create_token(subject, ACCESS, timedelta(minutes=settings.access_token_minutes))


def create_refresh_token(subject: str, jti: str) -> str:
    """Refresh tokens carry a `jti` matching a `refresh_tokens` row so they can
    be revoked (logout, password reset) and rotated on use."""
    return _create_token(subject, REFRESH, timedelta(days=settings.refresh_token_days), jti=jti)


def create_reset_token(subject: str) -> str:
    """Short-lived, stateless password-reset token (emailed to the user)."""
    return _create_token(subject, RESET, timedelta(minutes=settings.reset_token_minutes))


def decode_token(token: str, expected_type: str) -> str | None:
    """Return the subject (user id) if the token is valid and of the expected type."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
    if payload.get("type") != expected_type:
        return None
    return payload.get("sub")


def decode_refresh(token: str) -> tuple[str, str] | None:
    """Return (subject, jti) for a valid refresh token, else None."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
    if payload.get("type") != REFRESH or not payload.get("jti"):
        return None
    return payload["sub"], payload["jti"]
