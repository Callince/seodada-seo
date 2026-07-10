"""Server-to-server webhooks. No auth — authenticity is proven by the provider's
HMAC signature over the raw request body."""
from __future__ import annotations

import orjson
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session
from app.integrations.razorpay import client as rzp
from app.services import billing

router = APIRouter()


@router.post("/razorpay")
async def razorpay_webhook(request: Request, db: AsyncSession = Depends(get_db_session)):
    # The signature is over the RAW body — read it before any parsing.
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    if not rzp.verify_webhook_signature(body, signature):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid signature")
    try:
        event = orjson.loads(body)
    except orjson.JSONDecodeError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "invalid payload") from exc
    await billing.handle_webhook(db, event)
    return {"status": "ok"}
