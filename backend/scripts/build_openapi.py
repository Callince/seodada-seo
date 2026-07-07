"""Build a curated, standalone OpenAPI 3.1 contract from the live FastAPI schema.

Pulls the runtime spec (the source of truth for every schema), then enriches it
with production metadata, a Bearer-JWT security scheme, tag descriptions, and a
standardized error catalog (401/402/404/422/429) wired into each operation.

Run:  python scripts/build_openapi.py   # writes ../docs/openapi.yaml
"""
from __future__ import annotations

import json
import os
import urllib.request

import yaml

SRC = os.environ.get("OPENAPI_SRC", "http://127.0.0.1:8000/openapi.json")
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "docs", "openapi.yaml")

PUBLIC = {  # (method, path) operations that do NOT require auth
    ("post", "/api/v1/auth/register"),
    ("post", "/api/v1/auth/login"),
    ("post", "/api/v1/auth/refresh"),
    ("get", "/health"),
}
# Metered endpoints can return 402 (quota exhausted) and are rate-limit aware (429).
METERED_PREFIXES = (
    "/api/v1/serp", "/api/v1/keywords", "/api/v1/domains",
    "/api/v1/onpage", "/api/v1/content", "/api/v1/rank/track",
)

TAGS = [
    {"name": "auth", "description": "Registration, login, token refresh, and the current user/org."},
    {"name": "serp", "description": "Google SERP rankings with brand enrichment and People Also Ask."},
    {"name": "keywords", "description": "Search volume, trends (Google/DataForSEO/seasonal), suggestions, related, ideas, and PAA."},
    {"name": "domains", "description": "Domain-level analytics: ranked keywords, competitors, overview, and keyword gap."},
    {"name": "onpage", "description": "On-page content scoring, audits, SERP snippet preview, and competitive benchmarking."},
    {"name": "content", "description": "Sentiment, connotations, and citations for a keyword or brand."},
    {"name": "rank", "description": "Track a domain's position for a keyword over time."},
    {"name": "projects", "description": "Saved workspaces; reopen any saved run for $0 from cache."},
    {"name": "usage", "description": "Per-organization spend, quota, and usage breakdown."},
    {"name": "health", "description": "Liveness and active-provider probe."},
]


def main() -> None:
    spec = json.load(urllib.request.urlopen(SRC))

    spec["openapi"] = "3.1.0"
    spec["info"] = {
        "title": "DataForSEO Intelligence API",
        "version": "1.0.0",
        "summary": "Multi-tenant SEO research API on top of DataForSEO v3.",
        "description": (
            "A multi-tenant SaaS SEO platform. Every billed call flows through a "
            "three-tier cost engine (Redis -> Postgres -> upstream) with singleflight "
            "coalescing and stale-while-revalidate, so repeat reads are $0.\n\n"
            "**Conventions**\n"
            "- All endpoints are versioned under `/api/v1`.\n"
            "- Every data response embeds a `meta` object "
            "(`from_cache`, `cost_cents`, `source`, `latency_ms`).\n"
            "- All money values are integer **USD cents**.\n"
            "- Auth is JWT Bearer; access tokens are short-lived, refreshed via `/auth/refresh`.\n"
            "- Per-organization monthly quota is enforced before any billed call (HTTP 402)."
        ),
        "contact": {"name": "API Support", "email": "support@example.com"},
        "license": {"name": "Proprietary"},
    }
    spec["servers"] = [
        {"url": "http://localhost:8000", "description": "Local development"},
        {"url": "https://api.example.com", "description": "Production"},
    ]
    spec["tags"] = TAGS

    comps = spec.setdefault("components", {})
    schemas = comps.setdefault("schemas", {})
    schemas["Problem"] = {
        "type": "object",
        "description": "RFC 7807 Problem Details (media type `application/problem+json`).",
        "required": ["type", "title", "status", "detail"],
        "properties": {
            "type": {"type": "string", "format": "uri",
                     "examples": ["https://docs.seo-intelligence.app/errors/quota-exceeded"]},
            "title": {"type": "string", "examples": ["Payment Required"]},
            "status": {"type": "integer", "examples": [402]},
            "detail": {"type": "string", "examples": ["Monthly organization quota exhausted."]},
            "instance": {"type": "string", "examples": ["/api/v1/serp/ranking"]},
            "errors": {
                "type": "array",
                "description": "Field-level validation failures (422 only).",
                "items": {
                    "type": "object",
                    "properties": {"field": {"type": "string"}, "message": {"type": "string"}},
                },
            },
        },
    }

    # Security: Bearer JWT (keep the FastAPI OAuth2 scheme for the docs login flow).
    comps.setdefault("securitySchemes", {})["BearerAuth"] = {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "JWT access token from `/auth/login` or `/auth/refresh`.",
    }
    spec["security"] = [{"BearerAuth": []}]

    # Reusable error responses (all RFC 7807 problem+json).
    comps.setdefault("responses", {}).update({
        "Unauthorized": _resp("Missing or invalid access token.", "#/components/schemas/Problem"),
        "PaymentRequired": _resp(
            "Monthly organization quota exhausted — top up or wait for the next cycle.",
            "#/components/schemas/Problem",
        ),
        "NotFound": _resp("The requested resource does not exist or is not visible to you.", "#/components/schemas/Problem"),
        "TooManyRequests": _resp(
            "Upstream rate limit hit; retry after the indicated delay.",
            "#/components/schemas/Problem",
            headers={"Retry-After": {"schema": {"type": "integer"}, "description": "Seconds to wait before retrying."}},
        ),
        "ValidationFailed": _resp("Request body or parameters failed validation.", "#/components/schemas/Problem"),
    })

    for path, ops in spec["paths"].items():
        for method, op in ops.items():
            if method not in ("get", "post", "put", "delete", "patch"):
                continue
            responses = op.setdefault("responses", {})
            # Normalize FastAPI's inline 422 to the shared component.
            if "422" in responses:
                responses["422"] = {"$ref": "#/components/responses/ValidationFailed"}

            if path.startswith("/api/v1/auth"):  # per-IP login throttle (incl. public routes)
                responses.setdefault("429", {"$ref": "#/components/responses/TooManyRequests"})

            if (method, path) in PUBLIC:
                op["security"] = []  # override the global requirement
                continue

            responses.setdefault("401", {"$ref": "#/components/responses/Unauthorized"})
            if any(path.startswith(p) for p in METERED_PREFIXES):
                responses.setdefault("402", {"$ref": "#/components/responses/PaymentRequired"})
                responses.setdefault("429", {"$ref": "#/components/responses/TooManyRequests"})
            if any(seg in path for seg in ("{project_id}", "{run_id}", "{schedule_id}")):
                responses.setdefault("404", {"$ref": "#/components/responses/NotFound"})

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        yaml.safe_dump(spec, fh, sort_keys=False, allow_unicode=True, width=100)
    print(f"wrote {os.path.abspath(OUT)} ({len(spec['paths'])} paths)")


def _resp(description: str, schema_ref: str, headers: dict | None = None) -> dict:
    r = {
        "description": description,
        "content": {"application/problem+json": {"schema": {"$ref": schema_ref}}},
    }
    if headers:
        r["headers"] = headers
    return r


if __name__ == "__main__":
    main()
