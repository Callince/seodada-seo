"""Foreign-exchange rates for DISPLAY conversion.

Scope, deliberately narrow: these rates convert amounts for *reading*. Nothing
here touches billing. Razorpay charges INR, every stored amount is INR minor
units, and the checkout must always state the INR figure — a converted price is
an estimate, and the card network's own rate on the day is what the customer
actually pays.

Source is open.er-api.com: no API key, 166 currencies, ~50ms. Measured against
frankfurter.app (ECB) on the same day — USD 0.01036 vs 0.01037 — so the two
independent sources agree to four decimal places.
"""
from __future__ import annotations

import time
from typing import Any

import httpx

from app.core.logging import log

_ENDPOINT = "https://open.er-api.com/v6/latest/{base}"
BASE = "INR"

# Rates move on a daily cadence, so a per-request fetch would be pure waste and
# would put a third party in the path of every page render. Six hours keeps
# figures current without making the UI depend on someone else's uptime.
_TTL_S = 6 * 3600
_MAX_STALE_S = 7 * 24 * 3600

_cache: dict[str, Any] = {"rates": None, "fetched_at": 0.0, "provider_date": ""}


class RatesUnavailable(Exception):
    """No fresh rates and nothing usable cached.

    Raised rather than defaulting to 1.0 or silently returning INR: a wrong
    exchange rate is invisible in the UI — the figure just looks like a price —
    so failing loudly is the only honest option.
    """


def _usable(entry: dict, max_age: float) -> bool:
    return bool(entry.get("rates")) and (time.time() - entry["fetched_at"]) < max_age


async def get_rates(force: bool = False) -> dict[str, Any]:
    """{"base": "INR", "rates": {...}, "date": ..., "stale": bool}."""
    if not force and _usable(_cache, _TTL_S):
        return {"base": BASE, "rates": _cache["rates"], "date": _cache["provider_date"], "stale": False}

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            r = await client.get(_ENDPOINT.format(base=BASE))
            r.raise_for_status()
            payload = r.json()
        rates = payload.get("rates") or {}
        if not rates or payload.get("result") == "error":
            raise ValueError(f"provider returned no rates ({payload.get('error-type', 'unknown')})")
        _cache.update(
            rates=rates,
            fetched_at=time.time(),
            provider_date=payload.get("time_last_update_utc", ""),
        )
        log.info("fx_rates_refreshed", currencies=len(rates))
        return {"base": BASE, "rates": rates, "date": _cache["provider_date"], "stale": False}
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        # Serve stale before failing: a rate from this morning is a far better
        # answer than an error, and it is still labelled stale so the UI can say
        # so. Past a week even that stops being defensible.
        if _usable(_cache, _MAX_STALE_S):
            log.info("fx_rates_serving_stale", reason=str(exc)[:200])
            return {"base": BASE, "rates": _cache["rates"], "date": _cache["provider_date"], "stale": True}
        log.info("fx_rates_unavailable", reason=str(exc)[:200])
        raise RatesUnavailable(str(exc)) from exc


def convert(amount_inr_minor: int, currency: str, rates: dict[str, float]) -> float | None:
    """INR minor units (paise) -> major units of `currency`.

    Returns None for an unknown currency rather than falling back to the base:
    silently showing an INR figure under a "$" sign is worse than showing
    nothing, because it is indistinguishable from a correct conversion.
    """
    cur = (currency or "").upper()
    if cur == BASE:
        return amount_inr_minor / 100
    rate = rates.get(cur)
    if not rate:
        return None
    return (amount_inr_minor / 100) * float(rate)
