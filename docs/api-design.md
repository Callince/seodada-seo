# API Design — FourDM SEO Platform API

REST, resource-oriented, JSON over HTTPS, JWT-authenticated, versioned under
`/api/v1`. The machine-readable contract is [`openapi.yaml`](./openapi.yaml)
(OpenAPI 3.1, validated with `npx @redocly/cli lint docs/openapi.yaml`).

---

## 1. Resource model

Persistent entities (PostgreSQL; see `app/db/models.py`). PKs are UUID strings;
JSON columns are `JSONB` on Postgres, `JSON` on SQLite.

| Resource | Key fields | Relationships |
|---|---|---|
| **Organization** | `id`, `name`, `plan`, `monthly_quota_cents` | 1—N Users, Projects, UsageLog, RankSnapshots, Subscriptions |
| **User** | `id`, `email`, `role` (`owner`/`member`), `org_id`, `is_active`, `is_verified`, `is_staff`, `admin_permissions[]` | N—1 Organization |
| **Project** | `id`, `org_id`, `name`, `type` | 1—N ProjectRun |
| **ProjectRun** | `id`, `project_id`, `module`, `params`, `result_ref` | N—1 Project; `result_ref` → ApiCache |
| **RankSnapshot** | `id`, `org_id`, `keyword`, `domain`, `position`, `device`, `created_at` | N—1 Organization |
| **Schedule** | `id`, `org_id`, `project_id`, `kind`, `frequency`, `next_run_at`, `last_status` | N—1 Organization/Project |
| **ApiCache** | `params_hash` (unique), `response` (JSONB), `cost_cents`, `expires_at` | referenced by ProjectRun |
| **UsageLog** | `org_id`, `user_id`, `endpoint`, `cost_cents`, `from_cache` | N—1 Organization/User |
| **Plan** | `slug` (unique), `price_cents` (paise), `period_days`, `usage_per_day`, `tier`, `features` | 1—N Subscription/Payment |
| **Subscription** | `org_id`, `plan_id`, `status`, `current_period_end`, `razorpay_subscription_id` | N—1 Organization/Plan |
| **Payment** | `org_id`, `plan_id`, `razorpay_order_id`, `razorpay_payment_id`, `amount_cents`, `tax_cents`, `invoice_number` | N—1 Organization/Plan |
| **InvoiceAddress** | `org_id` (unique), `name`, `gstin`, `address`, `state_code`… | N—1 Organization |
| **WebsiteSettings / BlogCategory / Blog / WebStory / ContactSubmission / EmailLog** | site config + marketing CMS + contact inbox + email audit | — |

```
Organization 1─┬─< User
               ├─< Project 1─< ProjectRun ──> ApiCache
               ├─< RankSnapshot
               ├─< Subscription >── Plan ──< Payment
               └─< UsageLog
```

**Research resources** (SERP, keyword metrics, domain analytics, on-page,
content, rank) are *computed* views over the DataForSEO upstream + the cost
engine — not stored rows. Every such response embeds a `meta` envelope.

### The `meta` envelope (every data response)

```json
{ "from_cache": true, "cost_cents": 0, "source": "redis", "latency_ms": 3 }
```
`source` ∈ `redis | postgres | revalidating | live`. All research money is
integer **USD cents**; billing amounts are **INR paise**.

---

## 2. Endpoints

Full reference in [API.md](API.md). Groups under `/api/v1`:

| Group | Representative operations |
|---|---|
| `auth` | `register`, `signup/verify`, `login`, `admin/login`, `refresh`, `password/forgot`, `password/reset`, `google/login`, `google/callback`, `me` |
| `serp` | `ranking` (top-N organic + brand + PAA) |
| `keywords` | `volume`, `trends`, `suggestions`, `related`, `ideas`, `paa`, `overview` |
| `domains` | `overview`, `ranked-keywords`, `competitors`, `intersection`, `history`, `whois`, `technologies` |
| `onpage` / `analyze` | `onpage/analyze`, `onpage/lighthouse`; local $0 `analyze/page`, `analyze/sitemap` |
| `content` | `analyze`, `sentiment`, `phrase-trends` |
| `rank` | `track`, `tracked`, `history` |
| `report` | `site` (composite audit) |
| `backlinks` | `summary`, `list`, `referring-domains`, `anchors`, `history`, `new-lost`, `competitors`, `spam-score`, `link-gap` |
| `local` | `listings` |
| `audit` | `start`, `status/{task_id}` |
| `ai-visibility` | `check`, `status/{task_id}`, `mentions`, `ai-volume`, `ask` |
| `ai` | `insights` |
| `projects` | CRUD + `runs` (save/list/reopen — reopen is $0) |
| `schedules` | CRUD + `run` |
| `usage` | `summary`, `dashboard` |
| `billing` | `plans`, `subscription`, `checkout`, `verify`, `payments`, `payments/{id}/invoice` |
| `admin` | users/plans/subscriptions/payments/settings/blogs/webstories/contacts/email-logs/usage-history/roles |
| `public` | `contact`, `blog`, `blog/{slug}`, `webstories`, `plans` (no auth) |
| `webhooks` | `razorpay` (no auth, HMAC-verified) |
| — | `GET /health` (liveness + active providers, public) |

---

## 3. Authentication & authorization

- **Scheme:** JWT Bearer (`Authorization: Bearer <access_token>`).
- **Token types:** access (30 min), refresh (7 days), reset (30 min).
  `/auth/refresh` mints a new access token; the axios client auto-refreshes on
  401. **Google OAuth** (`/auth/google/*`) is CSRF-guarded by a signed state
  token and upserts a verified user.
- **Public operations** (`security: []`): `register`, `login`, `refresh`,
  `password/*`, `google/*`, `health`, everything under `/public/*`, and
  `/webhooks/*`. Everything else requires a valid access token.
- **Tenancy:** every authenticated request is scoped to the user's `org_id`.
  Cross-org access returns **404** (not 403) so resource existence isn't leaked.
- **Roles:** `owner` vs `member`; destructive project operations are owner-gated.
- **Platform admin:** membership in `ADMIN_EMAILS` plus fine-grained RBAC
  (`admin_permissions` slugs), enforced per-route by a longest-prefix
  path→permission map in `deps.py`.
- **Rate limiting:** fixed-window, cache-backed (shared across workers via
  Redis). Billed module groups are limited **per organization**
  (`rate_limit_per_minute`, default 120); unauthenticated `auth` routes are
  throttled **per client IP** (`login_rate_limit_per_minute`, default 10).
  Exceeding a window returns **429**.

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
`errors[]` array on 422. `detail` is always present. Implemented globally in
`app/core/errors.py`.

| Status | When | Notes |
|---|---|---|
| **400** | Malformed request / self-deactivation | |
| **401** Unauthorized | Missing/expired/invalid token, deactivated account | Triggers client refresh-and-retry |
| **402** Payment Required | **Daily analysis limit exhausted** | Returned **before** any billed upstream call |
| **403** Forbidden | Missing admin RBAC permission; inactive Backlinks subscription | |
| **404** Not Found | Resource absent or out-of-tenant | Used instead of 403 to avoid leakage |
| **409** Conflict | e.g. email already registered | |
| **422** Unprocessable | Body/param validation failed | Field-level `errors[]` |
| **429** Too Many Requests | Rate/limit window exceeded | |
| **502** | Upstream/DataForSEO failure | Mapped to a friendly message |
| **503** | Feature not configured (e.g. AI provider key missing) | |

Example:

```json
{
  "type": "https://seo.fourdm.services/errors/daily-limit",
  "title": "Payment Required",
  "status": 402,
  "detail": "Daily analysis limit reached. Upgrade your plan for more.",
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
rank history, keyword lists by `limit`).

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

### Known REST divergences
1. **POST used for read-style research calls** (cacheable reads) — complex JSON
   bodies (keyword arrays, location/lang) exceed practical query-string limits.
   Consider `Idempotency-Key` support and documented cacheability, or GET
   aliases for the simple single-keyword cases. *(open)*
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
