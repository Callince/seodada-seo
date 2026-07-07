"""RFC 7807 Problem Details error handling.

Converts every error into `application/problem+json` with a stable, documented
`type` URI, a human `title`, the HTTP `status`, an actionable `detail`, and the
request `instance` path. Validation failures additionally carry a field-level
`errors[]` array. The `detail` field is preserved so existing clients that read
`detail` keep working.
"""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import log
from app.integrations.dataforseo.client import DataForSEOError

PROBLEM_JSON = "application/problem+json"
TYPE_BASE = "https://docs.seo-intelligence.app/errors/"

# status -> (type slug, title)
_CATALOG: dict[int, tuple[str, str]] = {
    400: ("bad-request", "Bad Request"),
    401: ("unauthorized", "Unauthorized"),
    402: ("quota-exceeded", "Payment Required"),
    403: ("forbidden", "Forbidden"),
    404: ("not-found", "Not Found"),
    409: ("conflict", "Conflict"),
    422: ("validation-error", "Unprocessable Entity"),
    429: ("rate-limited", "Too Many Requests"),
    500: ("internal-error", "Internal Server Error"),
    502: ("upstream-error", "Bad Gateway"),
    503: ("unavailable", "Service Unavailable"),
}


def _meta(status: int) -> tuple[str, str]:
    slug, title = _CATALOG.get(status, ("error", "Error"))
    return TYPE_BASE + slug, title


def _problem(status: int, detail: str, instance: str, **extra) -> JSONResponse:
    type_uri, title = _meta(status)
    body = {"type": type_uri, "title": title, "status": status, "detail": detail, "instance": instance}
    body.update(extra)
    return JSONResponse(status_code=status, content=body, media_type=PROBLEM_JSON)


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    resp = _problem(exc.status_code, detail, request.url.path)
    for k, v in (getattr(exc, "headers", None) or {}).items():
        resp.headers[k] = v  # preserve e.g. WWW-Authenticate / Retry-After
    return resp


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = [
        {
            "field": ".".join(str(p) for p in e.get("loc", []) if p != "body") or "body",
            "message": e.get("msg", "invalid"),
        }
        for e in exc.errors()
    ]
    summary = "; ".join(f"{e['field']}: {e['message']}" for e in errors)
    detail = f"Request validation failed — {summary}" if summary else "Request validation failed."
    return _problem(422, detail, request.url.path, errors=errors)


async def dataforseo_exception_handler(request: Request, exc: DataForSEOError) -> JSONResponse:
    """Surface upstream DataForSEO errors as readable responses instead of a 500."""
    log.info("dataforseo_error", path=request.url.path, code=exc.status_code, message=exc.message)
    # Subscription-gated API (e.g. Backlinks) — tell the user how to enable it.
    if "plans and subscriptions" in exc.message.lower():
        return _problem(
            403,
            "This feature needs the DataForSEO Backlinks subscription. Activate it at "
            "app.dataforseo.com (Plans & Subscriptions → Backlinks) and it will work immediately.",
            request.url.path,
            upstream_code=exc.status_code,
        )
    # Bad user input (not a provider outage) — explain it as such.
    if "domain not found" in exc.message.lower():
        return _problem(
            400,
            "That domain could not be found. Check the spelling — e.g. example.com "
            "(a real, registered domain with no spaces).",
            request.url.path,
            upstream_code=exc.status_code,
        )
    detail = f"The data provider rejected this request: {exc.message}"
    return _problem(502, detail, request.url.path, upstream_code=exc.status_code)


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    log.error("unhandled_exception", path=request.url.path, error=repr(exc))
    return _problem(500, "An internal error occurred. Please try again later.", request.url.path)


def register_error_handlers(app: FastAPI) -> None:
    # FastAPI's HTTPException subclasses Starlette's, so this covers both.
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(DataForSEOError, dataforseo_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
