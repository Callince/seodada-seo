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
# endpoint knows": offering all 166 would be a worse experience than offering a
# curated set, and every one of these needs a live rate to be usable.
#
# Code and label only — NO symbol. Symbols are derived in the browser from
# Intl.NumberFormat, which knows the correct glyph, its placement, and the
# minor-unit count for every ISO code. A symbol column here would be a second
# source of truth for the same fact, free to drift from what the formatted
# amounts actually render.
SUPPORTED_CURRENCIES: list[dict[str, str]] = [
    {"code": "INR", "label": "Indian Rupee"},
    {"code": "USD", "label": "US Dollar"},
    {"code": "EUR", "label": "Euro"},
    {"code": "GBP", "label": "British Pound"},
    {"code": "AUD", "label": "Australian Dollar"},
    {"code": "CAD", "label": "Canadian Dollar"},
    {"code": "SGD", "label": "Singapore Dollar"},
    {"code": "NZD", "label": "New Zealand Dollar"},
    {"code": "HKD", "label": "Hong Kong Dollar"},
    {"code": "CHF", "label": "Swiss Franc"},
    {"code": "SEK", "label": "Swedish Krona"},
    {"code": "AED", "label": "UAE Dirham"},
    {"code": "SAR", "label": "Saudi Riyal"},
    {"code": "JPY", "label": "Japanese Yen"},
    {"code": "CNY", "label": "Chinese Yuan"},
    {"code": "KRW", "label": "South Korean Won"},
    {"code": "MYR", "label": "Malaysian Ringgit"},
    {"code": "IDR", "label": "Indonesian Rupiah"},
    {"code": "PHP", "label": "Philippine Peso"},
    {"code": "THB", "label": "Thai Baht"},
    {"code": "VND", "label": "Vietnamese Dong"},
    {"code": "BDT", "label": "Bangladeshi Taka"},
    {"code": "PKR", "label": "Pakistani Rupee"},
    {"code": "LKR", "label": "Sri Lankan Rupee"},
    {"code": "ZAR", "label": "South African Rand"},
    {"code": "NGN", "label": "Nigerian Naira"},
    {"code": "KES", "label": "Kenyan Shilling"},
    {"code": "EGP", "label": "Egyptian Pound"},
    {"code": "BRL", "label": "Brazilian Real"},
    {"code": "MXN", "label": "Mexican Peso"},
    {"code": "TRY", "label": "Turkish Lira"},
    {"code": "PLN", "label": "Polish Zloty"},
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
