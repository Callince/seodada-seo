"""Razorpay client — order creation and HMAC signature verification.

Talks to the Razorpay REST API over httpx (no SDK) with HTTP Basic auth
(key_id : key_secret). The two verification helpers are the security boundary of
the whole billing system and must be exact:

  * payment checkout callback -> HMAC_SHA256("{order_id}|{payment_id}", key_secret)
  * webhook                   -> HMAC_SHA256(raw_request_body, webhook_secret)

Both compare with `hmac.compare_digest` (constant-time). A tampered amount,
order, or body fails verification.
"""
from __future__ import annotations

import hashlib
import hmac

import httpx

from app.core.config import settings

_ORDERS_URL = "https://api.razorpay.com/v1/orders"
_REFUNDS_URL = "https://api.razorpay.com/v1/payments/{payment_id}/refund"


class RazorpayError(Exception):
    pass


class RazorpayNotConfigured(RazorpayError):
    pass


def is_configured() -> bool:
    return bool(settings.razorpay_key_id.strip() and settings.razorpay_key_secret.strip())


def _auth() -> tuple[str, str]:
    if not is_configured():
        raise RazorpayNotConfigured("Razorpay is not configured — set RAZORPAY_KEY_ID/SECRET.")
    return settings.razorpay_key_id, settings.razorpay_key_secret


async def create_order(amount_cents: int, currency: str, receipt: str, notes: dict | None = None) -> dict:
    """Create a Razorpay order. `amount_cents` is the minor unit (paise for INR)
    — exactly Razorpay's `amount` field, so no conversion here."""
    payload = {
        "amount": int(amount_cents),
        "currency": currency,
        "receipt": receipt[:40],
        "notes": notes or {},
        "payment_capture": 1,
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            resp = await client.post(_ORDERS_URL, json=payload, auth=_auth())
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise RazorpayError(f"Razorpay order failed ({exc.response.status_code}).") from exc
        except httpx.HTTPError as exc:
            raise RazorpayError(f"Razorpay order failed: {exc}") from exc
        return resp.json()


def _hmac_hex(message: bytes, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def verify_payment_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """Verify the checkout callback signature. Signs "{order_id}|{payment_id}"
    with the API key_secret."""
    if not (order_id and payment_id and signature):
        return False
    expected = _hmac_hex(f"{order_id}|{payment_id}".encode("utf-8"), settings.razorpay_key_secret)
    return hmac.compare_digest(expected, signature)


def verify_webhook_signature(body: bytes, signature: str) -> bool:
    """Verify a webhook against the RAW request body using the webhook secret."""
    secret = settings.razorpay_webhook_secret.strip()
    if not secret or not signature:
        return False
    expected = _hmac_hex(body, secret)
    return hmac.compare_digest(expected, signature)


async def refund_payment(payment_id: str, amount_cents: int | None = None) -> dict:
    """Refund a captured payment (full, or partial when amount_cents is given)."""
    payload = {"amount": int(amount_cents)} if amount_cents else {}
    url = _REFUNDS_URL.format(payment_id=payment_id)
    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            resp = await client.post(url, json=payload, auth=_auth())
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise RazorpayError(f"Razorpay refund failed ({exc.response.status_code}).") from exc
        except httpx.HTTPError as exc:
            raise RazorpayError(f"Razorpay refund failed: {exc}") from exc
        return resp.json()
