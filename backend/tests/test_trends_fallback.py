from __future__ import annotations

import httpx
import pytest

from app.integrations.free import trends as ft


def _http_429() -> httpx.HTTPStatusError:
    req = httpx.Request("GET", "https://trends.google.com/x")
    return httpx.HTTPStatusError("429", request=req, response=httpx.Response(429, request=req))


@pytest.mark.asyncio
async def test_a_throttled_first_attempt_still_returns_data(monkeypatch):
    """Google 429s intermittently — measured 1 failure in 3 sequential live
    calls. A retry recovers it without falling over to a paid provider, so a
    transient throttle must not reach the user at all."""
    monkeypatch.setattr(ft, "_BACKOFF_S", 0)
    state = {"client": 0}

    explore_body = ")]}',\n" + (
        '{"widgets": [{"id": "TIMESERIES", "token": "tok", "request": {}}]}'
    )
    multiline_body = ")]}',\n" + (
        '{"default": {"timelineData": [{"time": "1700000000", "value": [42]}]}}'
    )

    class FlakyOnce:
        def __init__(self, *a, **k):
            state["client"] += 1
            self.attempt = state["client"]

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, url, **k):
            if self.attempt == 1:  # whole first attempt is throttled
                raise _http_429()
            body = multiline_body if "multiline" in url else explore_body
            return httpx.Response(200, text=body, request=httpx.Request("GET", url))

    monkeypatch.setattr(ft.httpx, "AsyncClient", FlakyOnce)
    res = await ft.google_trends(["seo"], 2356, "en")

    assert state["client"] == 2, "should have retried exactly once"
    assert res.cost_cents == 0
    points = res.result[0]["items"][0]["data"]
    assert points == [{"timestamp": 1700000000, "values": [42]}]


@pytest.mark.asyncio
async def test_raises_unavailable_rather_than_returning_empty(monkeypatch):
    """The bug: every failure returned an empty graph, so a 429 was
    indistinguishable from a keyword nobody searches. The chart reported an
    absence that was really our own throttled request."""
    monkeypatch.setattr(ft, "_BACKOFF_S", 0)

    class Boom:
        def __init__(self, *a, **k): ...
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def get(self, *a, **k): raise _http_429()

    monkeypatch.setattr(ft.httpx, "AsyncClient", Boom)
    with pytest.raises(ft.TrendsUnavailable):
        await ft.google_trends(["seo"], 2356, "en")


@pytest.mark.asyncio
async def test_retries_the_configured_number_of_times(monkeypatch):
    monkeypatch.setattr(ft, "_BACKOFF_S", 0)
    attempts = {"n": 0}

    class Counting:
        def __init__(self, *a, **k): ...
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def get(self, *a, **k):
            attempts["n"] += 1
            raise _http_429()

    monkeypatch.setattr(ft.httpx, "AsyncClient", Counting)
    with pytest.raises(ft.TrendsUnavailable):
        await ft.google_trends(["seo"], 2356, "en")
    # one _HOME call per attempt, and it fails there each time
    assert attempts["n"] == ft._ATTEMPTS


@pytest.mark.asyncio
async def test_no_timeseries_widget_is_empty_not_unavailable(monkeypatch):
    """Google answering with no timeseries IS a real 'no data' — it must stay
    an empty result, not trigger a paid fallback."""
    monkeypatch.setattr(ft, "_BACKOFF_S", 0)

    class NoWidget:
        def __init__(self, *a, **k): ...
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def get(self, url, **k):
            r = httpx.Response(200, text=")]}',\n" + '{"widgets": []}',
                               request=httpx.Request("GET", url))
            return r

    monkeypatch.setattr(ft.httpx, "AsyncClient", NoWidget)
    res = await ft.google_trends(["seo"], 2356, "en")
    assert res.cost_cents == 0
    assert res.result[0]["items"] == []
