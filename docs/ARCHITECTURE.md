# Architecture

> **Companion:** [DATA_AND_ALGORITHMS.md](./DATA_AND_ALGORITHMS.md) — column-level
> data structures, the full request lifecycle, and every non-trivial algorithm
> (AIMD crawl concurrency, the coalescer's cost split, the scoring rubric's
> weights, keyword dedup, keyset cursors, the FX failure ladder) with the
> reasoning behind each. This file covers *what the pieces are*; that one covers
> *how they work*.

This repo is the **unified FourDM SEO platform** — the merge of "data for seo"
(FastAPI + React SEO intelligence on DataForSEO v3) and "SEO RENEW"/seodada,
which adds Razorpay/GST billing, a public marketing site, an admin CMS/back-office,
an advanced web scraper, an automated content factory, and Google OAuth. One SPA
and one API serve the authenticated app, the public site, and the admin portal.

## System overview

```
                        Browser (React SPA)
                              │ same-origin /api/v1/*
                        ┌─────▼─────┐
                        │   Caddy   │  auto-HTTPS edge (prod)
                        └──┬─────┬──┘
                 /api/* ───┘     └─── /* (static SPA via nginx)
                ┌──────────▼──────────┐
                │     FastAPI api     │  JWT auth · RBAC · rate limits · RFC7807 errors
                └─┬───────┬─────────┬─┘
                  │       │         │
        ┌─────────▼─┐ ┌───▼────┐ ┌──▼───────────────────────────┐
        │ Postgres  │ │ Redis  │ │ External APIs                 │
        │ (L2 cache,│ │ (L1 +  │ │ DataForSEO v3 · Razorpay ·    │
        │  app data)│ │ locks) │ │ Gemini/Anthropic/Ollama ·     │
        └───────────┘ └────────┘ │ Brave · Google Trends ·       │
                                 │ OpenPageRank                   │
                                 └───────────────────────────────┘
                ┌─────────────────────┐
                │  scheduler (1 repl) │  recurring Site Reports → save + email
                └─────────────────────┘
```

Production runs each box as a Docker Compose service; only Caddy publishes
ports. Locally, SQLite + in-memory cache replace Postgres + Redis with zero
infrastructure. The public marketing site (`/`, blog, webstories, pricing…) and
the admin back-office (`/admin`) are the same SPA and API as the app.

## Backend layout (`backend/app/`)

| Package | Responsibility |
|---|---|
| `api/v1/` | One router per module — `auth`, `serp`, `keywords`, `domains`, `onpage`, `analyze` (local $0), `content`, `rank`, `report`, `ai`, `backlinks`, `local`, `audit`, `ai_visibility`, `projects`, `schedules`, `usage`, `admin`, `billing` (+ public plans router), `public_content` (no-auth marketing content), `webhooks` (Razorpay HMAC) — plus `deps.py` (auth + admin-RBAC guards) and `limiter.py` (fixed-window rate limits) |
| `core/` | `config.py` (pydantic-settings, all env), `security.py` (JWT access/refresh/reset + bcrypt), `errors.py` (problem+json handlers), `logging.py` (structlog) |
| `db/` | SQLAlchemy async models + session (`base.py`, `models.py`, `session.py`); Alembic migrations in `backend/alembic/` (12 versions) |
| `integrations/dataforseo/` | Async `client.py` (envelope unwrap, USD→cents, tenacity retry) + per-API wrappers/parsers: `serp`, `keywords`, `labs`, `backlinks`, `onpage`, `audit`, `content`, `domain_meta`, `local`, `ai_optimization`, `ai_visibility` |
| `integrations/free/` | Zero-cost providers shaped to the DataForSEO parsers: `brave` (SERP), `trends` (Google Trends), `local_onpage`, `openpagerank` (domain authority) |
| `integrations/razorpay/` | `client.py` — order creation + HMAC verification (checkout `HMAC_SHA256("{order}|{payment}")`, webhook `HMAC_SHA256(raw_body)`, constant-time compare) |
| `integrations/scraper/` | The tiered crawler: `blocking`, `cache`, `fetcher` (curl_cffi), `frontier`, `humanizer`, `politeness` (robots), `renderer` (Playwright), `sitemap`, `parser`, and `extractors/` (headings, images, links, meta, schema, text) |
| `services/` | The business core — see below |

### The cost engine (`services/engine.py`)

Single entry point for every billed call:

```
resolve(endpoint, params, ttl, fetch_fn):
  hash (endpoint, params) with SHA-256
  L1 hot cache (Redis/memory) ──hit──► return ($0)
  singleflight lock (collapse concurrent identical calls); re-check L1
  L2 durable cache (api_cache table) ──fresh────► return ($0)
                                     ──stale ≤7d─► serve stale now + background revalidate
  past SWR ──► upstream fetch (30-day stale copy = fallback on failure)
              → persist (cost recorded) → prime L1
```

`resolve` returns `Resolved(data, cost_cents, from_cache, source, latency_ms,
fetched_at)`, where `source ∈ redis | postgres | revalidating | live`. TTLs are
tuned by data volatility (SERP 6h, search volume 3d, Labs 2d, on-page 30m,
backlinks 3d, domain meta 7d); the SWR window is 7 days, the stale fallback
window 30 days.

`services/usage.py` wraps it: `metered()` = `assert_within_quota` →
`engine.resolve` → `record` (writes `usage_log`, 0 cents if served from cache),
and spawns a deduped background SWR revalidation. Quota compares today's
**non-cached** call count against the daily limit (the active plan's
`usage_per_day`, else `FREE_DAILY_ANALYSES` = 10); platform admins are exempt;
exceeding it raises **HTTP 402** before any billed upstream call.

`services/coalescer.py` merges concurrent search-volume requests into one
upstream call with exact cost splitting. `services/providers.py` picks
DataForSEO vs. free provider per module (degrading to DataForSEO when free
credentials are missing). `services/cache_backend.py` is the L1 hot-cache +
distributed-lock abstraction (`redis` | `memory`).

### Composite & other services

- `services/report.py` — the Site Report: sequential billed Labs/SERP calls +
  concurrent local page scoring (`density.py` SSRF-guarded fetch → `scoring.py`
  0–100 rubric → `pixels.py` SERP-snippet pixel-width truncation), aggregated
  into a health score, findings, and recommendations.
- `services/scheduler.py` + `app/scheduler_main.py` — the recurring-job loop.
  Due schedules are **claimed atomically** (conditional UPDATE on `next_run_at`)
  so multiple replicas never double-run a job. Each run: site report → optional
  AI enrichment → ProjectRun snapshot → optional email (`services/email.py`,
  stdlib SMTP off the event loop). Production runs it as a standalone container.
- `services/rank_watch.py` — daily rank re-checks + movement alerts
  (delta ≥ `RANK_ALERT_DELTA`).
- `services/ai.py` — provider-agnostic AI insights: shared system prompt + JSON
  normalization; `_gemini` / `_anthropic` / `_ollama` backends selected by
  `AI_PROVIDER`, returning `{summary, suggestions[], model}`.
- `services/ai_visibility.py` — background job: is a domain cited in Google
  AI Overview / AI Mode.
- `services/billing.py` + `services/invoices.py` — plans, Razorpay checkout,
  GST-inclusive activation (idempotent via callback + webhook), and reportlab
  GST invoice PDFs.
- `services/brand.py` — domain→brand-name + brand search-volume enrichment for
  SERP rows.
- `services/page_analysis.py` — the six local ($0) tools (URL / Keyword /
  Heading / Image / Meta / Sitemap) driven by the scraper.
- `services/competitive.py` — SERP benchmarking + content-gap. `sentiment.py` —
  VADER. `pagination.py` — keyset cursor pagination. `normalize.py` /
  `ranking.py` — domain normalizers.

### Data model (main tables)

| Table | Purpose |
|---|---|
| `organizations` | Tenant; `plan`, `monthly_quota_cents`; users belong to exactly one |
| `users` | Email + bcrypt hash, org-scoped `role` (owner/member), `is_active`, `is_verified`, `is_staff`, `admin_permissions` (JSON list of RBAC slugs) |
| `api_cache` | L2 cache: endpoint + params-hash → JSONB response, cost, `fetched_at`, `expires_at` |
| `usage_log` | Every billed/cached call: user, org, endpoint, `cost_cents`, `from_cache` |
| `projects` / `project_runs` | Saved workspaces; a run's `result_ref` is a params-hash into `api_cache` (reopen = $0) |
| `rank_snapshots` | Rank-tracking history (keyword, domain, position, device) |
| `schedules` | Recurring jobs: kind, params, frequency, active, next/last run, last status |
| `plans` | Billing plans: slug, `price_cents` (paise), `period_days`, `usage_per_day`, tier, features |
| `subscriptions` | Org subscription: status, `current_period_end`, `razorpay_subscription_id` |
| `payments` | Razorpay order/payment ids, `amount_cents`, `tax_cents`, status, `invoice_number` |
| `invoice_addresses` | Per-org billing identity (GSTIN, address…) |
| `website_settings` | Single-row public-site config |
| `blog_categories` / `blogs` / `web_stories` | Marketing CMS content |
| `contact_submissions` / `email_logs` | Contact-form inbox + email delivery audit |

Platform-admin status is **not** a column — it's the `ADMIN_EMAILS` env list,
checked per request. Fine-grained admin RBAC uses each user's
`admin_permissions` slugs (`dashboard`, `user_management`, `content_management`,
`subscription_management`, `payments`, `contact_submissions`, `email_logs`,
`search_history`, `website_settings`, `manage_roles`) resolved by a
longest-prefix path→permission map in `deps.py`.

## Frontend layout (`frontend/src/`)

| Folder | Responsibility |
|---|---|
| `api/` | axios client (JWT header + auto-refresh on 401, problem+json → readable messages) and ~22 TanStack Query hook files, one per module |
| `router.tsx` | React Router v7 `createBrowserRouter`: standalone auth routes, a public marketing shell, `RequireAuth → AppShell` for the app (all pages lazy-loaded), and a separate `AdminShell` portal at `/admin` |
| `components/layout/` | AppShell (sidebar + topbar + toaster), collapsible Sidebar, TopBar with user menu |
| `components/public/` | Marketing-site building blocks (hero, landing kit) |
| `components/shared/` | Cross-page blocks: DataTable (sort + CSV), StatCard, ScoreGauge, TrendChart, AiAdvisor, CommandPalette, CacheBadge, SaveToProject, LocationLanguagePicker |
| `components/ui/` | shadcn-style primitives (Button, Card, Input, Select, Badge, Skeleton, Tabs, Toaster) + RichEditor (CKEditor 5) for the admin CMS |
| `store/` | Zustand: `auth` (persisted JWT + user), `toast` |
| `lib/` | nav registry (sidebar + ⌘K share it), formatters, period + seo helpers |
| `content/` | seodada landing-page copy (JSON + typed loaders) |

Design system: CSS-variable tokens in `index.css` (light/dark) consumed by
Tailwind (`darkMode: "class"`), Inter / JetBrains Mono, bento-grid layouts on
Dashboard / Site Report / All-in-One.

Build note: `vite.config.ts` forces all node_modules into one `vendor` chunk —
Recharts' CommonJS deps break when auto-split (`t is not a function` in
production only). Don't remove that `manualChunks` block.

## Security

- JWT access (30 min) + refresh (7 d) + reset (30 min); bcrypt password hashing
  (72-byte truncation); inactive users rejected at the dependency level.
- Google OAuth sign-in with a CSRF-guarded signed state token.
- Admin routes gated by `ADMIN_EMAILS` membership **and** per-permission RBAC.
- Per-org and per-IP rate limiting; RFC 7807 errors never leak stack traces.
- SSRF guard on local page fetching (public-host check before any URL fetch).
- Razorpay webhook signatures verified (HMAC, constant-time).
- Secrets live only in env files (git-ignored, excluded from the Docker build
  context); API containers run as a non-root user.
- CORS locked to configured origins; Caddy adds HSTS and security headers.

## Production topology

See [DEPLOYMENT.md](DEPLOYMENT.md). Summary: one droplet, Compose services
`db`, `redis`, `migrate` (one-shot Alembic), `api` (with
`SCHEDULER_ENABLED=false`), `scheduler` (single replica,
`python -m app.scheduler_main`), `web` (nginx serving a **locally prebuilt**
SPA), and `caddy` (auto-HTTPS). The frontend is built on the dev machine because
the Vite build OOMs small droplets.
