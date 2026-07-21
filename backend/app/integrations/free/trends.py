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

import asyncio
import json

import httpx

from app.core.logging import log
from app.integrations.dataforseo.client import DfsResult


class TrendsUnavailable(Exception):
    """Google refused or broke — as distinct from genuinely having no data.

    These two used to be one outcome: every failure returned an empty graph and
    the UI said "No Google Trends series". Google rate-limits this endpoint
    (HTTP 429) intermittently, so that made throttling indistinguishable from a
    keyword nobody searches for — the chart confidently reported an absence
    that was really our own failed request. Raising instead lets the caller
    fall back to a paid provider rather than present a blank chart as fact.
    """

_EXPLORE = "https://trends.google.com/trends/api/explore"
_MULTILINE = "https://trends.google.com/trends/api/widgetdata/multiline"
_HOME = "https://trends.google.com/trends/"

# DataForSEO location_code → Google Trends geo (ISO-3166 alpha-2, "" = worldwide).
#
# DataForSEO country codes are ISO-3166 numeric + 2000, so these are derived
# rather than guessed. Covers every country the location picker offers plus the
# common remainder: the table previously held 15 entries while the UI offered
# 52 countries, so 37 of them silently fell through to the "US" default — a
# query scoped to Brazil or Japan returned United States interest data, labelled
# as the country the user picked. Wrong data is worse than slow data, which is
# why this had to be fixed before the free provider became the default.
_GEO_BY_LOCATION = {
    2004: "AF", 2008: "AL", 2012: "DZ", 2032: "AR", 2036: "AU", 2040: "AT",
    2050: "BD", 2056: "BE", 2068: "BO", 2076: "BR", 2100: "BG", 2124: "CA",
    2144: "LK", 2152: "CL", 2156: "CN", 2170: "CO", 2188: "CR", 2191: "HR",
    2203: "CZ", 2208: "DK", 2214: "DO", 2218: "EC", 2222: "SV", 2233: "EE",
    2246: "FI", 2250: "FR", 2276: "DE", 2288: "GH", 2300: "GR", 2320: "GT",
    2344: "HK", 2348: "HU", 2352: "IS", 2356: "IN", 2360: "ID", 2372: "IE",
    2376: "IL", 2380: "IT", 2392: "JP", 2398: "KZ", 2404: "KE", 2410: "KR",
    2422: "LB", 2428: "LV", 2440: "LT", 2458: "MY", 2484: "MX", 2504: "MA",
    2524: "NP", 2528: "NL", 2554: "NZ", 2558: "NI", 2566: "NG", 2578: "NO",
    2586: "PK", 2591: "PA", 2600: "PY", 2604: "PE", 2608: "PH", 2616: "PL",
    2620: "PT", 2642: "RO", 2643: "RU", 2682: "SA", 2688: "RS", 2702: "SG",
    2703: "SK", 2705: "SI", 2710: "ZA", 2724: "ES", 2752: "SE", 2756: "CH",
    2764: "TH", 2780: "TT", 2788: "TN", 2792: "TR", 2800: "UG", 2804: "UA",
    2784: "AE", 2818: "EG", 2826: "GB", 2840: "US", 2858: "UY", 2862: "VE",
    2704: "VN", 2716: "ZW",
}

# City-level location codes have no Google Trends equivalent — the widget API
# takes countries and sub-regions, not metros. Every city the picker offers is
# Indian, so they resolve to India: country-level interest for a city query is
# a coarser answer, but it is a TRUE one, where falling through to the US
# default was simply a different country.
_CITY_TO_COUNTRY_GEO = {
    1007809: "IN",  # Chennai
    1007785: "IN",  # Mumbai
    9075215: "IN",  # Delhi
    1007768: "IN",  # Bengaluru
    1007740: "IN",  # Hyderabad
    1007828: "IN",  # Kolkata
    1007788: "IN",  # Pune
    1007753: "IN",  # Ahmedabad
}
_ATTEMPTS = 3
_BACKOFF_S = 0.8

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
    """Google Trends geo for a DataForSEO location code.

    Unknown codes resolve to "" (worldwide), NOT to a country. A wrong country
    is indistinguishable from a right one in the chart — the user sees a normal
    series for the region they picked — whereas worldwide is at least a real
    answer to a broader question, and the log line says which code went
    unmapped so it can be added.
    """
    geo = _GEO_BY_LOCATION.get(location_code) or _CITY_TO_COUNTRY_GEO.get(location_code)
    if geo is None:
        log.info("google_trends_unmapped_location", location_code=location_code)
        return ""
    return geo


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

    # Google 429s this endpoint intermittently even at low volume — measured a
    # throttle on 1 of 3 sequential calls. A fresh client (new NID cookie) on a
    # short backoff clears it most of the time, which is far cheaper than
    # failing over to a paid provider, so retry before giving up.
    last_exc: Exception | None = None
    for attempt in range(_ATTEMPTS):
        if attempt:
            await asyncio.sleep(_BACKOFF_S * attempt)
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
                    # Google answered and offered no timeseries: a real "no data
                    # for this term", not a failure. Empty is the honest result.
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
            break
        except (httpx.HTTPError, ValueError, KeyError) as exc:
            last_exc = exc
            log.info(
                "google_trends_attempt_failed",
                keywords=terms, attempt=attempt + 1, reason=str(exc)[:200],
            )
    else:
        # Every attempt failed — surface it so the caller can fall back rather
        # than render an empty chart that reads as "nobody searches this".
        raise TrendsUnavailable(str(last_exc)) from last_exc

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
