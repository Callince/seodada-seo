from __future__ import annotations

import httpx
import pytest
import respx

from app.integrations.dataforseo.client import DataForSEOClient, DataForSEOError


def _envelope(task_status=20000, top_status=20000, cost=0.02):
    return {
        "status_code": top_status,
        "status_message": "ok",
        "cost": cost,
        "tasks": [
            {
                "status_code": task_status,
                "status_message": "task ok",
                "cost": cost,
                "result": [{"keyword": "shoes", "items": []}],
            }
        ],
    }


@pytest.mark.asyncio
@respx.mock
async def test_post_unwraps_envelope_and_converts_cost_to_cents():
    respx.post("https://sandbox.dataforseo.com/v3/serp/google/organic/live/advanced").mock(
        return_value=httpx.Response(200, json=_envelope(cost=0.02))
    )
    client = DataForSEOClient()
    res = await client.post("/v3/serp/google/organic/live/advanced", {"keyword": "shoes"})
    assert res.result == [{"keyword": "shoes", "items": []}]
    assert res.cost_cents == 2  # $0.02 -> 2 cents
    await client.close()


@pytest.mark.asyncio
@respx.mock
async def test_post_raises_on_top_level_error():
    respx.post("https://sandbox.dataforseo.com/v3/x").mock(
        return_value=httpx.Response(200, json={"status_code": 40000, "status_message": "bad"})
    )
    client = DataForSEOClient()
    with pytest.raises(DataForSEOError) as exc:
        await client.post("/v3/x", {})
    assert exc.value.status_code == 40000
    await client.close()


@pytest.mark.asyncio
@respx.mock
async def test_post_raises_on_task_level_error():
    respx.post("https://sandbox.dataforseo.com/v3/x").mock(
        return_value=httpx.Response(200, json=_envelope(task_status=40501))
    )
    client = DataForSEOClient()
    with pytest.raises(DataForSEOError) as exc:
        await client.post("/v3/x", {})
    assert exc.value.status_code == 40501
    await client.close()
