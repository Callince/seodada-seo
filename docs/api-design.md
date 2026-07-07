# API Design — DataForSEO Intelligence API

REST, resource-oriented, JSON over HTTPS, JWT-authenticated, versioned under
`/api/v1`. The machine-readable contract is [`openapi.yaml`](./openapi.yaml)
(OpenAPI 3.1, validated with `npx @redocly/cli lint docs/openapi.yaml`).

---

## 1. Resource model

Persistent entities (PostgreSQL; see `app/db/models.py`):

| Resource | Key fields | Relationships |
|---|---|---|
| **Organization** | `id`, `name`, `plan`, `monthly_quota_cents` | 1—N Users, Projects, UsageLog, RankSnapshots |
| **User** | `id`, `email`, `role` (`owner`/`member`), `org_id` | N—1 Organization |
| **Project** | `id`, `org_id`, `name`, `type` | 1—N ProjectRun |
| **ProjectRun** | `id`, `project_id`, `module`, `params`, `result_ref` | N—1 Project; `result_ref` → ApiCache |
| **RankSnapshot** | `id`, `org_id`, `keyword`, `domain`, `position`, `created_at` | N—1 Organization |
| **ApiCache** | `params_hash` (unique), `response` (JSONB), `cost_cents`, `expires_at` | referenced by ProjectRun |
| **UsageLog** | `org_id`, `user_id`, `endpoint`, `cost_cents`, `from_cache` | N—1 Organization/User |

```
Organization 1─┬─< User
               ├─< Project 1─< ProjectRun ──> ApiCache
               ├─< RankSnapshot
               └─< UsageLog
```

**Research resources** (SERP, keyword metrics, domain analytics, on-page,
content, rank) are *computed* views over the DataForSEO upstream + the cost
engine — not stored rows. Every such response embeds a `meta` envelope.

### The `meta` envelope (every data response)

```json
{ "from_cache": true, "cost_cents": 0, "source": "redis", "latency_ms": 3 }
```
`source` ∈ `redis | postgres | stale | live`. All money is integer **USD cents**.

---

## 2. Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/auth/register` | Create org + owner, return token pair |
| POST | `/api/v1/auth/login` | Exchange credentials for tokens |
| POST | `/api/v1/auth/refresh` | New access token from refresh token |
| GET | `/api/v1/auth/me` | Current user + organization |
| POST | `/api/v1/serp/ranking` | Top-N organic + brand + PAA |
| POST | `/api/v1/keywords/volume` | Search volume + 12-month history |
| POST | `/api/v1/keywords/trends` | Google / DataForSEO trend series |
| POST | `/api/v1/keywords/{suggestions,related,ideas}` | Keyword expansion |
| POST | `/api/v1/keywords/paa` | People Also Ask |
| POST | `/api/v1/domains/ranked-keywords` | Keywords a domain ranks for |
| POST | `/api/v1/domains/competitors` | Competing domains |
| POST | `/api/v1/domains/overview` | Organic/paid overview metrics |
| POST | `/api/v1/domains/intersection` | Keyword gap between two domains |
| POST | `/api/v1/onpage/analyze` | Content score, audits, benchmark |
| POST | `/api/v1/content/analyze` | Sentiment + citations |
| POST | `/api/v1/rank/track` | Record a domain's position for a keyword |
| GET | `/api/v1/rank/history?keyword=&domain=` | Position history |
| GET | `/api/v1/rank/tracked` | Tracked keywords with latest + delta |
| GET/POST | `/api/v1/projects` | List / create projects |
| GET/PUT/DELETE | `/api/v1/projects/{project_id}` | Read / update / delete |
| GET/POST | `/api/v1/projects/{project_id}/runs` | List / save runs |
| GET | `/api/v1/projects/{project_id}/runs/{run_id}` | Reopen a saved run ($0) |
| GET | `/api/v1/usage/summary` | Spend, quota, breakdown |
| GET | `/health` | Liveness + active providers (public) |

---

## 3. Authentication & authorization

- **Scheme:** JWT Bearer (`Authorization: Bearer <access_token>`).
- **Tokens:** short-lived access (30 min) + refresh (7 days). `/auth/refresh`
  mints a new access token; the axios client auto-refreshes on 401.
- **Public operations** (`security: []`): `register`, `login`, `refresh`, `health`.
  Everything else requires a valid access token.
- **Tenancy:** every authenticated request is scoped to the user's `org_id`.
  Cross-org access returns **404** (not 403) so resource existence isn't leaked.
- **Roles:** `owner` vs `member`; destructive project operations are owner-gated.
- **Rate limiting:** fixed-window, cache-backed (shared across workers via Redis).
  Billed groups (`serp`/`keywords`/`domains`/`onpage`/`content`/`rank`) are limited
  **per organization** (`rate_limit_per_minute`, default 120); the unauthenticated
  `auth` routes are throttled **per client IP** (`login_rate_limit_per_minute`,
  default 10). Exceeding a window returns **429** with a `Retry-After` header.

```
register/login ──> { access_token, refresh_token }
        │
        ▼ Authorization: Bearer <access>
   protected endpoints ──401──> POST /auth/refresh ──> new access ──> retry
```

---

## 4. Error catalog

Errors use **RFC 7807 Problem Details** (`application/problem+json`):
`{ "type", "title", "status", "detail", "instance" }`, plus a field-level
`errors[]` array on 422. `detail` is always present, so clients reading `detail`
keep working. Implemented globally in `app/core/errors.py`.

| Status | When | Notes |
|---|---|---|
| **400** | Malformed request | |
| **401** Unauthorized | Missing/expired/invalid token | Triggers client refresh-and-retry |
| **402** Payment Required | Org monthly quota exhausted | Returned **before** any billed upstream call |
| **404** Not Found | Resource absent or out-of-tenant | Used instead of 403 to avoid leakage |
| **422** Unprocessable | Body/param validation failed | Field-level `detail[]` |
| **429** Too Many Requests | Upstream rate limit | `Retry-After` header |
| **5xx** | Upstream/DataForSEO failure | Mapped to a friendly message |

Example:

```json
{
  "type": "https://docs.seo-intelligence.app/errors/quota-exceeded",
  "title": "Payment Required",
  "status": 402,
  "detail": "Monthly organization quota exhausted.",
  "instance": "/api/v1/serp/ranking"
}
```

---

## 5. Pagination & filtering

**Cursor (keyset) pagination** is implemented for the unbounded collections —
`GET /projects` and `GET /projects/{id}/runs` — with a uniform envelope:

```json
{ "data": [ ... ], "pagination": { "next_cursor": "…", "has_more": true } }
```

Query params: `?cursor=<opaque>&limit=<1..100>` (default 50). The opaque cursor
encodes the last item's `(timestamp, id)`; the next page uses a keyset predicate
(`ts < c.ts OR (ts = c.ts AND id < c.id)`) — stable under inserts and fast at any
depth (no OFFSET). Other collections stay bounded server-side (SERP `depth ≤ 100`,
rank history ≤ 90, keyword lists by `limit`) and can adopt the same envelope as
they grow.

---

## 6. Versioning & deprecation strategy

- **URI versioning:** `/api/v1/...`. Breaking changes ship under `/api/v2`; the
  two run side-by-side during migration.
- **Additive changes are non-breaking** and stay within `v1` (new optional
  fields, new endpoints). Clients must ignore unknown fields.
- **Deprecation policy:** mark superseded operations with `deprecated: true` in
  the spec and a `Deprecation` + `Sunset` HTTP header; minimum **90-day** window
  with changelog notice before removal.
- **Contract is the source of truth:** `openapi.yaml` is regenerated from the
  running app (`python backend/scripts/build_openapi.py`) and linted in CI.

### Known REST divergences + recommendations
1. **POST used for read-style research calls** (cacheable reads). Rationale:
   complex JSON bodies (keyword arrays, location/lang) exceed practical query
   limits and keep request signing simple. *Recommendation:* keep POST but add
   `Idempotency-Key` support and document cacheability; or expose GET aliases
   for the simple single-keyword cases. *(open)*
2. ~~No cursor pagination~~ — **done** for projects/runs (§5).
3. ~~Errors not RFC 7807~~ — **done**, global `application/problem+json` (§4).

---

## 7. Validate & mock

```bash
# Regenerate the contract from the running API
python backend/scripts/build_openapi.py

# Lint (0 errors expected)
npx @redocly/cli lint docs/openapi.yaml

# Mock server for contract testing
npx @stoplight/prism-cli mock docs/openapi.yaml
```
