"""Google Trends → DataForSEO-trends-shaped result, $0.

Google Trends has no official API, but its public widget endpoints return real
interest-over-time data. The flow is two requests:

  1. /api/explore        → returns widget tokens (incl. the TIMESERIES widget)
  2. /api/widgetdata/multiline using that token → the timeline points

Both responses are prefixed with `)]}',` which we strip. We shape the output to
mirror DataForSEO's Google Trends "explore" result so `keywords.parse_trends`
consumes it unchanged. Trends scraping is best-effort: any failure degrades to an
empty graph (the UI already handles the empty state) rather than erroring.
"""
from __future__ import annotations

import json

import httpx

from app.core.logging import log
from app.integrations.dataforseo.client import DfsResult

_EXPLORE = "https://trends.google.com/trends/api/explore"
_MULTILINE = "https://trends.google.com/trends/api/widgetdata/multiline"
_HOME = "https://trends.google.com/trends/"

# DataForSEO location_code → Google Trends geo (ISO-3166 alpha-2, "" = worldwide).
_GEO_BY_LOCATION = {
    2840: "US", 2826: "GB", 2356: "IN", 2036: "AU", 2124: "CA",
    2276: "DE", 2250: "FR", 2724: "ES", 2380: "IT", 2392: "JP",
    2076: "BR", 2528: "NL", 2752: "SE", 2616: "PL", 2710: "ZA",
}
_TIME_BY_RANGE = {
    "past_7_days": "now 7-d",
    "past_30_days": "today 1-m",
    "past_90_days": "today 3-m",
    "past_12_months": "today 12-m",
    "past_5_years": "today 5-y",
}


def _strip_prefix(text: str) -> dict:
    start = text.find("{")
    if start == -1:
        raise ValueError("unexpected Google Trends response")
    return json.loads(text[start:])


def _geo(location_code: int) -> str:
    return _GEO_BY_LOCATION.get(location_code, "US")


async def google_trends(
    keywords: list[str],
    location_code: int,
    language_code: str,
    time_range: str = "past_12_months",
    date_from: str | None = None,
    date_to: str | None = None,
) -> DfsResult:
    terms = [k for k in keywords if k.strip()][:5]
    empty = DfsResult(result=[{"keywords": terms, "items": []}], cost_cents=0)
    if not terms:
        return empty

    geo = _geo(location_code)
    # A custom window maps to Google's "YYYY-MM-DD YYYY-MM-DD" time spec.
    tf = f"{date_from} {date_to}" if date_from and date_to else _TIME_BY_RANGE.get(time_range, "today 12-m")
    hl = f"{(language_code or 'en')}-{geo or 'US'}"
    comparison = [{"keyword": t, "geo": geo, "time": tf} for t in terms]
    explore_req = {"comparisonItem": comparison, "category": 0, "property": ""}

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(30.0),
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (SEO-Console)", "Accept-Language": hl},
        ) as client:
            await client.get(_HOME, params={"geo": geo or "US"})  # prime NID cookie
            explore = await client.get(
                _EXPLORE,
                params={"hl": hl, "tz": "0", "req": json.dumps(explore_req)},
            )
            explore.raise_for_status()
            widgets = _strip_prefix(explore.text).get("widgets") or []
            ts_widget = next((w for w in widgets if w.get("id") == "TIMESERIES"), None)
            if not ts_widget:
                return empty

            multiline = await client.get(
                _MULTILINE,
                params={
                    "hl": hl,
                    "tz": "0",
                    "req": json.dumps(ts_widget.get("request") or {}),
                    "token": ts_widget.get("token", ""),
                },
            )
            multiline.raise_for_status()
            timeline = (
                _strip_prefix(multiline.text).get("default") or {}
            ).get("timelineData") or []
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        log.info("google_trends_failed", keywords=terms, reason=str(exc))
        return empty

    data: list[dict] = []
    for point in timeline:
        ts = point.get("time")
        try:
            ts_int = int(ts)
        except (TypeError, ValueError):
            continue
        data.append({"timestamp": ts_int, "values": point.get("value") or []})

    log.info("google_trends", keywords=terms, points=len(data))
    return DfsResult(
        result=[
            {
                "keywords": terms,
                "items": [
                    {"type": "google_trends_graph", "keywords": terms, "data": data}
                ],
            }
        ],
        cost_cents=0,
    )
