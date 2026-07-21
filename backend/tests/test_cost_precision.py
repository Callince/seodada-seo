"""Sub-cent cost precision.

DataForSEO bills in fractions of a cent (an AI Overview call is $0.002). Integer
cents rounded those to zero, so real spend recorded as **free** and never showed
up in the usage log, the admin spend report, or month-to-date totals.
"""
from __future__ import annotations

import pytest

from app.api.v1 import auth as auth_api
from app.integrations.dataforseo.client import _to_cents
from app.services import usage


def test_sub_cent_costs_are_not_rounded_away():
    # The exact price that used to vanish: $0.002 -> 0.2c, not 0.
    assert _to_cents(0.002) == 0.2
    assert _to_cents(0.0001) == 0.01
    assert _to_cents(0.005) == 0.5  # was also 0 under banker's rounding


def test_whole_cent_costs_are_unchanged():
    assert _to_cents(0.02) == 2.0    # a SERP call
    assert _to_cents(0.09) == 9.0    # a batched search_volume call
    assert _to_cents(1) == 100.0


def test_none_and_zero_are_free():
    assert _to_cents(None) == 0.0
    assert _to_cents(0) == 0.0


def test_float_noise_is_trimmed():
    # 0.07 * 100 = 7.000000000000001 in binary float; don't store that.
    assert _to_cents(0.07) == 7.0


@pytest.mark.asyncio
async def test_month_to_date_accumulates_sub_cent_spend(db):
    user = await auth_api._upsert_google_user(db, "cost@test.com", "C")
    # 20 AI Overview calls at 0.2c — real spend $0.04, previously reported $0.00.
    for _ in range(20):
        await usage.record(db, user, "serp.ai_overview", 0.2, from_cache=False)
    total = await usage.month_to_date_cents(db, user.org_id)
    assert total == pytest.approx(4.0)  # 4 cents, not 0
