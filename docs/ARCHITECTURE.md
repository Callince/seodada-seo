# Architecture

## System overview

```
                        Browser (React SPA)
                              │ same-origin /api/v1/*
                        ┌─────▼─────┐
                        │   Caddy   │  auto-HTTPS edge (prod)
                        └──┬─────┬──┘
                 /api/* ───┘     └─── /* (static SPA via nginx)
                ┌──────────▼──────────┐
                │     FastAPI api     │  JWT auth · rate limits · RFC7807 errors
                └─┬───────┬─────────┬─┘
                  │       │         │
        ┌─────────▼─┐ ┌───▼────┐ ┌──▼──────────────┐
        │ Postgres  │ │ Redis  │ │ External APIs    │
        │ (L2 cache,│ │ (L1 +  │ │ DataForSEO v3    │
        │  app data)│ │ locks) │ │ Gemini / Brave / │
        └───────────┘ └────────┘ │ Google Trends    │
                                 └─────────────────┘
                ┌─────────────────────┐
                │  scheduler (1 repl) │  recurring Site Reports → save + email
                └─────────────────────┘
```

Production runs each box as a Docker Compose service; only Caddy publishes
ports. Locally, SQLite + in-memory cache replace Postgres + Redis with zero
infrastructure.

## Backend layout (`backend/app/`)

| Package | Responsibility |
|---|---|
| `api/v1/` | One router per module (`serp`, `keywords`, `domains`, `onpage`, `content`, `rank`, `report`, `ai`, `projects`, `schedules`, `usage`, `admin`, `auth`) + `deps.py` (auth/admin guards) and `limiter.py` (fixed-window rate limits) |
| `core/` | `config.py` (pydantic-settings, all env), `security.py` (JWT + bcrypt), `errors.py` (problem+json handlers), `logging.py` (structlog) |
| `db/` | SQLAlchemy async models + session; Alembic migrations in `backend/alembic/` |
| `integrations/dataforseo/` | Thin async client (`client.py` — envelope unwrap, error mapping) + per-API wrappers/parsers (`serp`, `labs`, `keywords`, …) |
| `integrations/free/` | Zero-cost providers shaped to match the DataForSEO parsers: `brave` (SERP), `trends` (Google Trends), `local_onpage`, VADER sentiment |
| `services/` | The business core — see below |

### The cost engine (`services/engine.py`)

Single entry point for every billed call:

```
resolve(endpoint, params, ttl, fetch_fn):
  L1 hot cache (Redis/memory) ──hit──► return ($0)
  singleflight lock (collapse concurrent identical calls)
  L2 durable cache (api_cache table) ──fresh──► return ($0)
                                     ──stale──► serve + refresh in background
  fetch_fn() → upstream → persist (cost recorded) → prime L1
```

`services/usage.py` wraps it with per-user spend recording (`usage_log` table).
`services/coalescer.py` merges concurrent search-volume requests into one
upstream call with exact cost splitting. `services/providers.py` picks
DataForSEO vs. free provider per module.

### Composite services

- `services/report.py` — the Site Report: sequential billed Labs/SERP calls +
  concurrent local page scoring (`density.py` fetch → `scoring.py` rubric),
  aggregated into health score, findings, recommendations.
- `services/scheduler.py` — the recurring-job loop. Due schedules are **claimed
  atomically** (conditional UPDATE on `next_run_at`) so multiple replicas can
  never double-run a job. Each run: site report → optional AI enrichment →
  ProjectRun snapshot → optional email (`services/email.py`, stdlib SMTP in a
  worker thread).
- `services/ai.py` — provider-agnostic AI: shared system prompt + JSON
  normalization; `_gemini` / `_anthropic` / `_ollama` backends selected by
  `AI_PROVIDER`. Gemini runs with JSON response mode and thinking disabled.

### Data model (main tables)

| Table | Purpose |
|---|---|
| `organizations` | Tenant; users belong to exactly one |
| `users` | Email + bcrypt hash, org-scoped `role` (owner/member), `is_active` |
| `api_cache` | L2 cache: endpoint + params-hash → JSONB response, cost, expiry |
| `usage_log` | Every billed/cached call: user, org, endpoint, cost_cents, from_cache |
| `projects` / `project_runs` | Saved workspaces; runs reference an `api_cache` snapshot (reopen = $0) |
| `rank_snapshots` | Rank-tracking history |
| `schedules` | Recurring jobs: frequency, params, next/last run, last status |

Platform-admin status is **not** a column — it's the `ADMIN_EMAILS` env list,
checked per request (`deps.require_admin`).

## Frontend layout (`frontend/src/`)

| Folder | Responsibility |
|---|---|
| `api/` | axios client (JWT header + auto-refresh on 401, problem+json → readable messages) and TanStack Query hooks per module |
| `routes/` | One lazy-loaded page per module; `router.tsx` guards everything behind login |
| `components/layout/` | AppShell (sidebar + topbar + toaster), collapsible Sidebar, TopBar with user menu |
| `components/shared/` | Cross-page building blocks: DataTable (sort + CSV), StatCard, ScoreGauge, TrendChart, AiAdvisor, CommandPalette, LocationLanguagePicker, CacheBadge, SaveToProject |
| `components/ui/` | Primitives (Button with loading state, Card, Input, Select, Badge, Skeleton, Tabs, Toaster) |
| `store/` | Zustand: `auth` (persisted JWT + user), `toast` |
| `lib/` | nav registry (sidebar + ⌘K share it), formatters, period helpers |

Design system: CSS-variable tokens (Emerald Growth palette, light/dark) consumed
by Tailwind; bento-grid layouts on Dashboard / Site Report / All-in-One.

Build note: `vite.config.ts` forces all node_modules into one `vendor` chunk —
Recharts' CommonJS deps break when auto-split (`t is not a function` in
production only). Don't remove that `manualChunks` block.

## Security

- JWT access (30 min) + refresh (7 d); bcrypt password hashing; inactive users
  rejected at dependency level.
- Per-org and per-IP rate limiting; RFC 7807 errors never leak stack traces.
- SSRF guard on local page fetching (public-host check before any URL fetch).
- Secrets live only in env files (git-ignored, excluded from Docker build
  context); API containers run as a non-root user.
- CORS locked to configured origins; Caddy adds HSTS and security headers.

## Production topology

See [DEPLOYMENT.md](DEPLOYMENT.md). Summary: one droplet, seven compose services
(`db`, `redis`, `migrate` one-shot, `api` with `SCHEDULER_ENABLED=false`,
`scheduler` single replica, `web` nginx serving a **locally prebuilt** SPA,
`caddy` for auto-HTTPS). Frontend is built on the dev machine because the Vite
build OOMs small droplets.
