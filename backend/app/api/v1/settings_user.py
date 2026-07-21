"""Per-user preferences, and the FX rates the display currency needs."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, get_db_session
from app.db.models import User
from app.services import fx

router = APIRouter()

# The currencies offered in the picker. A closed list, not "anything the rates
# endpoint knows": each of these needs a symbol and sensible formatting in the
# UI, and offering 166 options would be a worse experience than offering 12.
SUPPORTED_CURRENCIES: list[dict[str, str]] = [
    {"code": "INR", "symbol": "₹", "label": "Indian Rupee"},
    {"code": "USD", "symbol": "$", "label": "US Dollar"},
    {"code": "EUR", "symbol": "€", "label": "Euro"},
    {"code": "GBP", "symbol": "£", "label": "British Pound"},
    {"code": "AUD", "symbol": "A$", "label": "Australian Dollar"},
    {"code": "CAD", "symbol": "C$", "label": "Canadian Dollar"},
    {"code": "SGD", "symbol": "S$", "label": "Singapore Dollar"},
    {"code": "AED", "symbol": "د.إ", "label": "UAE Dirham"},
    {"code": "JPY", "symbol": "¥", "label": "Japanese Yen"},
    {"code": "ZAR", "symbol": "R", "label": "South African Rand"},
    {"code": "BRL", "symbol": "R$", "label": "Brazilian Real"},
    {"code": "NGN", "symbol": "₦", "label": "Nigerian Naira"},
]
_CODES = {c["code"] for c in SUPPORTED_CURRENCIES}


class UserSettings(BaseModel):
    display_currency: str = ""
    full_name: str = ""


class UserSettingsUpdate(BaseModel):
    display_currency: str | None = Field(default=None, max_length=3)
    full_name: str | None = Field(default=None, max_length=255)

    @field_validator("display_currency")
    @classmethod
    def _known_currency(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return v
        code = v.upper()
        if code not in _CODES:
            # Rejected rather than stored-and-ignored: an unknown code would
            # convert to nothing and the UI would quietly fall back to INR
            # while the settings page claimed the choice had been saved.
            raise ValueError(f"Unsupported currency '{v}'.")
        return code


@router.get("/me", response_model=UserSettings)
async def get_my_settings(user: User = Depends(current_user)) -> UserSettings:
    return UserSettings(
        display_currency=user.display_currency or "",
        full_name=user.full_name or "",
    )


@router.patch("/me", response_model=UserSettings)
async def update_my_settings(
    body: UserSettingsUpdate,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_user),
) -> UserSettings:
    if body.display_currency is not None:
        user.display_currency = body.display_currency
    if body.full_name is not None:
        user.full_name = body.full_name.strip()
    await db.commit()
    await db.refresh(user)
    return UserSettings(
        display_currency=user.display_currency or "",
        full_name=user.full_name or "",
    )


@router.get("/currencies")
async def list_currencies() -> dict:
    """The picker's options plus live rates from the INR base.

    Rates ride along so the settings page can show what a conversion actually
    looks like before the user commits to it.
    """
    try:
        data = await fx.get_rates()
    except fx.RatesUnavailable:
        # Currencies are still listed so the picker works; `rates` empty tells
        # the UI to show INR and say conversion is unavailable, rather than
        # rendering a converted-looking number that is really just INR.
        return {"currencies": SUPPORTED_CURRENCIES, "base": fx.BASE, "rates": {}, "stale": False, "available": False}
    return {
        "currencies": SUPPORTED_CURRENCIES,
        "base": data["base"],
        "rates": {c["code"]: data["rates"].get(c["code"]) for c in SUPPORTED_CURRENCIES if data["rates"].get(c["code"]) or c["code"] == fx.BASE},
        "date": data.get("date", ""),
        "stale": data.get("stale", False),
        "available": True,
    }


@router.post("/currencies/refresh")
async def refresh_rates(user: User = Depends(current_user)) -> dict:
    """Force a rate refresh (the cache is 6h)."""
    try:
        data = await fx.get_rates(force=True)
    except fx.RatesUnavailable as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, f"Exchange rates unavailable: {exc}") from exc
    return {"base": data["base"], "date": data.get("date", ""), "count": len(data["rates"])}
