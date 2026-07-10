"""Create (or reset the password of) a login account in the local database.

Usage:
    python scripts/create_user.py [email] [password] [full_name]

Defaults create an owner account you can sign in with immediately. Idempotent —
re-running with the same email just resets that user's password.
"""
from __future__ import annotations

import asyncio
import sys

from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db.models import Organization, User
from app.db.session import SessionLocal


async def main(email: str, password: str, full_name: str) -> None:
    async with SessionLocal() as db:
        user = await db.scalar(select(User).where(User.email == email))
        if user:
            user.hashed_password = hash_password(password)
            user.is_verified = True
            user.is_active = True
            await db.commit()
            print(f"Updated existing account — password reset for {email}")
            return
        org = Organization(name=email, monthly_quota_cents=settings.default_org_quota_cents)
        db.add(org)
        await db.flush()
        db.add(User(
            email=email, hashed_password=hash_password(password), full_name=full_name,
            org_id=org.id, role="owner", is_verified=True, is_active=True,
        ))
        await db.commit()
        print(f"Created account {email}")


if __name__ == "__main__":
    args = sys.argv[1:]
    email = args[0] if len(args) > 0 else "admin@seodada.com"
    password = args[1] if len(args) > 1 else "seodada123"
    full_name = args[2] if len(args) > 2 else "Admin"
    asyncio.run(main(email, password, full_name))
