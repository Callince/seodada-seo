# FourDM SEO Platform

The **unified FourDM SEO platform** — the merge of *data for seo* (FastAPI + React
SEO intelligence on the **DataForSEO API v3**) and *SEO RENEW*/seodada (AI content
factory, advanced scraper, Razorpay billing, and public marketing site). A
multi-tenant SaaS SEO console with a FastAPI backend, a React 19 + TypeScript
frontend, a provider-agnostic AI advisor, and a three-tier cost & performance
engine that makes repeat queries effectively free — plus Razorpay billing
(India/GST), a public marketing site, and an admin back-office.

**Live:** https://seo.fourdm.services (DigitalOcean droplet, Docker Compose, Caddy auto-HTTPS)

---

## Documentation

| Guide | What's inside |
|---|---|
| [User Guide](docs/USER_GUIDE.md) | How to use every page — analyses, projects, schedules, AI advisor, admin |
| [API Reference](docs/API.md) | Every REST endpoint with request/response examples |
| [Configuration](docs/CONFIGURATION.md) | Every environment variable, what it does, safe defaults |
| [Architecture](docs/ARCHITECTURE.md) | System design — cost engine, providers, scraper, scheduler, AI service, data model |
| [Development](docs/DEVELOPMENT.md) | Local setup, tests, migrations, conventions |
| [Deployment](docs/DEPLOYMENT.md) | Production deploy to a DigitalOcean droplet, HTTPS, backups, day-2 ops |

---

## Modules (authenticated app)

| Module | What it does |
|---|---|
| **All-in-One / Workspace** | One form (keyword + domain) runs every tool below on a single page, topped with AI suggestions. |
| **SERP Ranking** | Top organic results for a keyword, plus People Also Ask. |
| **Keyword Research** | Search volume & 12-month history, Google Trends with time-period filters, long-tail suggestions, related keywords, and keyword ideas. |
| **Domain Analytics** | Domain authority strip, organic/paid overview, and every ranked keyword. |
| **Backlinks** | Authority score, strongest backlinks, referring domains, and anchor texts. |
| **Local** | Business-listings search for a query and location. |
| **On-Page** | Weighted content score with sub-scores, readability, SERP snippet preview, image/alt + indexability audit, keyword placement, and a competitive benchmark + content-gap vs. the top results. |
| **Content Analysis** | Sentiment, emotional connotations, and top citations for a keyword or brand. |
| **Rank Tracking** | Track a domain's Google position for a keyword over time, with a position-history chart and up/down movement. |
| **Site Report** | One-click composite audit: health gauge, top pages scored, ranked keywords, competitors, findings & recommendations — printable, schedulable, AI-enhanced. |
| **Site Audit** | Full-site crawl: errors/warnings/notices by severity, per-page scores and failed checks. |
| **AI Visibility** | Checks whether a domain is cited in Google's AI Overview / AI Mode. |
| **Schedules** | Recurring (daily/weekly/monthly) automated reports, saved to a project and emailed with an AI action plan. |
| **Projects** | Save any result to a workspace and reopen it later — always $0, served from cache. |
| **Competitors** | Head-to-head domain comparison with authority rings and the keyword gap. |
| **Billing** | Plans, Razorpay checkout, subscriptions, and GST invoices. |
| **Tools** | Six local, $0 analysis tools: URL, Keyword, Heading, Image, Meta, Sitemap. |
| **AI SEO Advisor** | Provider-agnostic insights (Gemini free tier / Claude / local Ollama): a summary + prioritized, specific recommendations generated from your analysis data. |
| **Admin** | Back-office for platform admins (see below). |

---

## Public site (no auth)

Landing, features, pricing, about, help, contact, blog + blog posts, webstories,
guides, and privacy / terms / cookies pages.

## Admin back-office

RBAC with 10 permission slugs. Manage users, plans, subscriptions,
payments/invoices, website settings, the blog + webstory CMS, contact
submissions, email logs, usage history, and roles.

---

## The cost & performance engine

DataForSEO bills per API call, so every billed request flows through
`services/usage.metered()` → `engine.resolve()`
(`backend/app/services/engine.py`):

1. **L1 — Redis/memory hot tier.** Sub-millisecond repeat reads, cost $0.
2. **Singleflight lock.** N simultaneous identical requests collapse to **one** upstream call.
3. **L2 — Postgres durable tier** (`api_cache`, JSONB). Survives restarts; repeat reads cost $0.
4. **Stale-while-revalidate.** A 7-day SWR window serves stale rows instantly while a background refresh runs; a 30-day stale fallback still serves if upstream fails.
5. **Upstream fetch + persist.** Response stored as JSONB, cost recorded, hot tier primed.

A **batch coalescer** fuses *concurrent* `search_volume` fetches into a single
upstream call with proportional cost splitting. TTLs are tuned by data volatility
(SERP 6h, search volume 3d, Labs 2d, on-page 30m, backlinks 3d, domain meta 7d).
Every response carries a `meta` block (`from_cache`, `cost_cents`, `source`,
`latency_ms`) that the UI surfaces as a **cached / live badge**. Per-user spend is
recorded in `usage_log` and surfaced to platform admins.

**Quota** is a **daily analysis-count limit** enforced as **HTTP 402** (not a
monthly cents quota). The free tier allows 10 analyses/day; paid plans set
`usage_per_day`. Platform admins are exempt, and cached reads are $0 and don't
count against the limit.

**Free data providers** can replace DataForSEO per module, at $0: Brave Search
(SERP), Google Trends public API (trends), in-process fetch + parse via the
scraper (On-Page / local tools), VADER (content sentiment), and OpenPageRank
(domain authority 0–100). See [Configuration](docs/CONFIGURATION.md).

---

## The advanced scraper

A tiered crawler (`backend/app/integrations/scraper/`): canonicalize →
politeness/robots → conditional GET → `curl_cffi` fetch → JS-detection → optional
Playwright render → parse → extract. It powers **Site Audit** and the local $0
Tools.

---

## Tech stack

**Backend:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0 (async) +
asyncpg/aiosqlite, Alembic (12 migrations), httpx (HTTP/2), Redis, JWT auth
(python-jose + bcrypt) with Google OAuth, structlog, orjson, tenacity. Scraper:
`curl_cffi` + selectolax + trafilatura + Playwright. Billing: reportlab (GST
invoice PDFs). Content: vaderSentiment. An in-process scheduler loop runs
recurring reports (`python -m app.scheduler_main`; a dedicated container in
production).

**Frontend:** React 19 + Vite + TypeScript, React Router v7, TanStack Query v5,
Tailwind CSS 3 (CSS-variable design tokens, class-based dark mode), Recharts + d3,
framer-motion, axios, Zustand, react-hook-form + zod, and CKEditor 5 (admin CMS).
Routes are lazy-loaded; ⌘K command palette and bento-grid dashboards.

**AI:** provider-agnostic — Google Gemini (`gemini-2.5-flash`, free) / Anthropic
Claude (`claude-haiku-4-5`) / local Ollama — switched by one env var
(`AI_PROVIDER`).

**Billing:** Razorpay checkout + webhooks, GST-inclusive invoicing (reportlab
PDF), and plans/subscriptions/payments. Money is integer cents everywhere;
Razorpay/billing amounts are INR paise.

---

## Quick start

### Option A — Docker (full stack)

```bash
cp .env.example .env          # fill in DFS_LOGIN / DFS_PASSWORD
docker compose up --build
```

- API docs (Swagger): http://localhost:8000/docs
- Services: `db` (Postgres 16), `redis`, `migrate` (one-shot Alembic), `api` (:8000), `web` (:5173).

### Option B — Zero-infrastructure local dev

Set `DATABASE_URL=sqlite+aiosqlite:///./dev.db` and `CACHE_BACKEND=memory` in `.env`, then:

```bash
# Backend
cd backend && pip install -e ".[dev]" && uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend && npm install && npm run dev    # proxies /api to :8000
```

Full details in [Development](docs/DEVELOPMENT.md).

---

## Testing

```bash
cd backend && python -m pytest -q
```

38 test files covering the cost engine, quota, rate limiting, auth rules, Google
OAuth, billing, the scheduler, crawler/scraper blocking, the free providers, the
per-module DataForSEO parsing, and the admin API.

---

## Production

The live deployment runs on a DigitalOcean droplet via `docker-compose.prod.yml`:
Postgres + Redis + API (`SCHEDULER_ENABLED=false`) + a dedicated scheduler
container + an nginx-served prebuilt SPA, fronted by Caddy with automatic
Let's Encrypt HTTPS. The frontend is built locally and shipped prebuilt (small
droplets OOM on the Vite build). See [Deployment](docs/DEPLOYMENT.md).
