import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, get_db_session, is_platform_admin
from app.core.config import settings
from app.core.security import (
    ACCESS,
    RESET,
    create_access_token,
    create_refresh_token,
    create_reset_token,
    decode_refresh,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.models import Organization, RefreshToken, User
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    LoginRequest,
    MeOut,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    SignupVerifyRequest,
    TokenPair,
)
from app.services import email as email_svc

router = APIRouter()

# Pending email-verified signups (in-memory; single uvicorn worker).
_PENDING: dict[str, dict] = {}
_OTP_TTL = 600

_GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"
_GOOGLE_USERINFO = "https://www.googleapis.com/oauth2/v2/userinfo"


def _frontend_base() -> str:
    return settings.cors_origin_list[0] if settings.cors_origin_list else ""


async def _upsert_google_user(db: AsyncSession, email: str, name: str) -> User:
    """Find or create a user for a verified Google email (open to any account)."""
    user = await db.scalar(select(User).where(User.email == email))
    if user:
        return user
    org = Organization(name=email, monthly_quota_cents=settings.default_org_quota_cents)
    db.add(org)
    await db.flush()
    user = User(
        email=email, hashed_password=hash_password(secrets.token_urlsafe(24)),
        full_name=name or "", org_id=org.id, role="owner", is_verified=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _token_pair(db: AsyncSession, user_id: str) -> dict:
    """Issue an access+refresh pair, persisting the refresh token's jti so the
    session can be revoked (logout, password reset) and rotated on refresh."""
    jti = uuid.uuid4().hex
    db.add(RefreshToken(
        id=jti, user_id=user_id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_days),
    ))
    await db.commit()
    return {
        "access_token": create_access_token(user_id),
        "refresh_token": create_refresh_token(user_id, jti),
    }


def _user_out(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "org_id": user.org_id,
        "is_admin": is_platform_admin(user),
    }


async def _create_account(db: AsyncSession, email: str, hashed_pw: str, full_name: str, org_name: str) -> dict:
    org = Organization(name=org_name.strip() or email, monthly_quota_cents=settings.default_org_quota_cents)
    db.add(org)
    await db.flush()
    # Reaches here only after the emailed OTP (or with email delivery disabled),
    # so the address is confirmed — mark verified.
    user = User(
        email=email, hashed_password=hashed_pw, full_name=full_name,
        org_id=org.id, role="owner", is_verified=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {**await _token_pair(db, user.id), "user": _user_out(user)}


@router.post("/register")
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db_session)):
    """Signup. When email is configured, emails a 6-digit code and defers account
    creation to /signup/verify; otherwise creates the account immediately."""
    if await db.scalar(select(User).where(User.email == body.email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    if not settings.emails_enabled:
        return {"verification": False, **await _create_account(
            db, body.email, hash_password(body.password), body.full_name, body.org_name)}

    code = f"{secrets.randbelow(1_000_000):06d}"
    _PENDING[body.email] = {
        "code": code, "full_name": body.full_name, "org_name": body.org_name,
        "hashed_password": hash_password(body.password), "exp": time.monotonic() + _OTP_TTL,
    }
    sent = await email_svc.send_email(
        body.email, "Your SEO Intelligence verification code",
        f"<p>Your verification code is <strong style='font-size:20px'>{code}</strong></p>"
        f"<p>It expires in 10 minutes.</p>",
    )
    if not sent:
        _PENDING.pop(body.email, None)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Couldn't send the verification email — try again.")
    return {"verification": True, "email": body.email}


@router.post("/signup/verify", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup_verify(body: SignupVerifyRequest, db: AsyncSession = Depends(get_db_session)):
    pending = _PENDING.get(body.email)
    if not pending or pending["exp"] < time.monotonic():
        _PENDING.pop(body.email, None)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Code expired — start signup again.")
    if not secrets.compare_digest(body.code, pending["code"]):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Incorrect verification code.")
    if await db.scalar(select(User).where(User.email == body.email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    out = await _create_account(
        db, body.email, pending["hashed_password"], pending["full_name"], pending["org_name"])
    _PENDING.pop(body.email, None)
    return out


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db_session)):
    user = await db.scalar(select(User).where(User.email == body.email))
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    return {**await _token_pair(db, user.id), "user": _user_out(user)}


@router.post("/admin/login", response_model=AuthResponse)
async def admin_login(body: LoginRequest, db: AsyncSession = Depends(get_db_session)):
    """Separate admin sign-in — same credentials, but only platform admins (emails
    in ADMIN_EMAILS) are allowed through. Non-admins are rejected with 403."""
    user = await db.scalar(select(User).where(User.email == body.email))
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if not is_platform_admin(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is not an administrator.")
    return {**await _token_pair(db, user.id), "user": _user_out(user)}


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db_session)):
    decoded = decode_refresh(body.refresh_token)
    if not decoded:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    user_id, jti = decoded
    row = await db.get(RefreshToken, jti)
    if not row or row.revoked:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    expires = row.expires_at if row.expires_at.tzinfo else row.expires_at.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc) or not await db.get(User, user_id):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    # Rotate: each refresh token is single-use.
    row.revoked = True
    return await _token_pair(db, user_id)


@router.post("/logout")
async def logout(body: RefreshRequest, db: AsyncSession = Depends(get_db_session)):
    """Revoke the session's refresh token. Idempotent — always returns ok."""
    decoded = decode_refresh(body.refresh_token)
    if decoded:
        row = await db.get(RefreshToken, decoded[1])
        if row:
            row.revoked = True
            await db.commit()
    return {"ok": True}


@router.post("/password/forgot")
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db_session)):
    """Email a password-reset link. Always returns ok so the endpoint can't be
    used to probe which emails are registered."""
    user = await db.scalar(select(User).where(User.email == body.email))
    if user and settings.emails_enabled:
        token = create_reset_token(user.id)
        link = f"{_frontend_base()}/reset-password?token={token}"
        await email_svc.send_email(
            user.email, "Reset your seodada password",
            f"<p>We received a request to reset your password.</p>"
            f"<p><a href='{link}'>Click here to choose a new password</a>. "
            f"This link expires in {settings.reset_token_minutes} minutes.</p>"
            f"<p>If you didn't request this, you can safely ignore this email.</p>",
        )
    return {"ok": True}


@router.post("/password/reset", response_model=AuthResponse)
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db_session)):
    user_id = decode_token(body.token, RESET)
    user = await db.get(User, user_id) if user_id else None
    if not user:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This reset link is invalid or has expired.")
    user.hashed_password = hash_password(body.password)
    # A password reset invalidates every existing session.
    await db.execute(update(RefreshToken).where(RefreshToken.user_id == user.id).values(revoked=True))
    await db.commit()
    await db.refresh(user)
    return {**await _token_pair(db, user.id), "user": _user_out(user)}


@router.get("/google/login")
async def google_login():
    if not settings.google_client_id:
        return RedirectResponse(f"{_frontend_base()}/login?error=google_disabled")
    # State is a short-lived signed token — verified on callback (CSRF guard).
    state = create_access_token(secrets.token_urlsafe(8))
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    }
    return RedirectResponse(f"{_GOOGLE_AUTH}?{urlencode(params)}")


@router.get("/google/callback")
async def google_callback(
    code: str = "", state: str = "", db: AsyncSession = Depends(get_db_session)
):
    base = _frontend_base()
    if not code or decode_token(state, ACCESS) is None:
        return RedirectResponse(f"{base}/login?error=google_failed")
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            tok = await client.post(_GOOGLE_TOKEN, data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            })
            tok.raise_for_status()
            access = tok.json()["access_token"]
            info = await client.get(_GOOGLE_USERINFO, headers={"Authorization": f"Bearer {access}"})
            info.raise_for_status()
            data = info.json()
    except (httpx.HTTPError, KeyError):
        return RedirectResponse(f"{base}/login?error=google_failed")

    email = (data.get("email") or "").lower()
    if not email or not data.get("verified_email", True):
        return RedirectResponse(f"{base}/login?error=google_failed")
    try:
        user = await _upsert_google_user(db, email, data.get("name") or "")
    except HTTPException:
        return RedirectResponse(f"{base}/login?error=domain")

    frag = urlencode(await _token_pair(db, user.id))
    return RedirectResponse(f"{base}/oauth#{frag}")


@router.get("/me", response_model=MeOut)
async def me(user: User = Depends(current_user), db: AsyncSession = Depends(get_db_session)):
    org = await db.get(Organization, user.org_id)
    return {
        "user": _user_out(user),
        "org": {
            "id": org.id,
            "name": org.name,
            "plan": org.plan,
            "monthly_quota_cents": org.monthly_quota_cents,
        },
    }
