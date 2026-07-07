# SEO Intelligence Platform

A multi-tenant SaaS SEO console built on the **DataForSEO API v3**, with a FastAPI
backend, a React + TypeScript frontend, and a free-tier **AI SEO Advisor**
(Google Gemini). A dozen modules sit on top of a three-tier cost &
performance engine that makes repeat queries effectively free.

**Live:** https://seo.fourdm.services (DigitalOcean droplet, Docker Compose, auto-HTTPS)

---

## Documentation

| Guide | What's inside |
|---|---|
| [User Guide](docs/USER_GUIDE.md) | How to use every page — analyses, projects, schedules, AI advisor, admin |
| [API Reference](docs/API.md) | Every REST endpoint with request/response examples |
| [Configuration](docs/CONFIGURATION.md) | Every environment variable, what it does, safe defaults |
| [Architecture](docs/ARCHITECTURE.md) | System design — cost engine, providers, scheduler, AI service, data model |
| [Development](docs/DEVELOPMENT.md) | Local setup, tests, migrations, conventions |
| [Deployment](docs/DEPLOYMENT.md) | Production deploy to a DigitalOcean droplet, HTTPS, backups, day-2 ops |

---

## Modules

| Module | What it does |
|---|---|
| **All-in-One** | One form (keyword + domain) runs every tool below on a single page, topped with AI suggestions. |
| **SERP Ranking** | Top 10–100 organic results for a keyword with brand name + brand search volume, plus People Also Ask. |
| **Keyword Research** | Search volume & 12-month history, Google Trends with time-period filters, long-tail suggestions, related keywords, and keyword ideas. |
| **Domain Analytics** | Domain authority strip, organic/paid overview, and every ranked keyword. |
| **Backlinks** | Authority score (0–100), strongest backlinks, referring domains, anchor texts (needs the DataForSEO Backlinks subscription). |
| **Competitors** | Head-to-head domain comparison with authority rings and the keyword gap. |
| **On-Page** | Weighted content score with sub-scores, readability, SERP snippet pixel-preview, image/alt + indexability audit, keyword placement, and a competitive benchmark + content-gap vs. the top results. |
| **Content Analysis** | Sentiment, emotional connotations, and top citations for a keyword or brand. |
| **Rank Tracking** | Track a domain's Google position for a keyword over time, with a position-history chart and up/down movement. |
| **Site Report** | One-click composite audit: health gauge, top pages scored, ranked keywords, competitors, findings & recommendations — printable, schedulable, AI-enhanced. |
| **Site Audit** | Ahrefs-style full-site crawl (25–200 pages): errors/warnings/notices by severity, per-page scores and failed checks. |
| **Schedules** | Recurring (daily/weekly/monthly) automated Site Reports, saved to a project and emailed with an AI action plan. |
| **Projects** | Save any result to a workspace and reopen it later — always $0, served from cache. |
| **AI SEO Advisor** | Provider-agnostic insights (Gemini free tier / Claude / local Ollama): a summary + prioritized, specific recommendations generated from your analysis data. Appears on All-in-One, Site Report, and in scheduled emails. |
| **Admin** | Platform admins see every user with per-user API spend and can create, edit, deactivate, and reset users. |

---

## The cost & performance engine

DataForSEO bills per API call, so every billed request flows through one
orchestrator (`backend/app/services/engine.py`):

1. **L1 — Redis/memory hot tier.** Sub-millisecond repeat reads, cost $0.
2. **Singleflight lock.** N simultaneous identical requests collapse to **one** upstream call.
3. **L2 — Postgres durable tier.** Survives restarts; repeat reads cost $0.
4. **Stale-while-revalidate.** Expired-but-recent rows serve instantly while a refresh runs.
5. **Upstream fetch + persist.** Response stored as JSONB, cost recorded, hot tier primed.

A **batch coalescer** further fuses *concurrent* `search_volume` fetches for
different keyword sets into a single upstream call (cost split exactly across
callers), and competitor corpora for On-Page benchmarking are cached per keyword.

TTLs are tuned by data volatility (SERP 24h, search volume 14d, Labs 7d, on-page 1h).
Every response carries a `meta` block (`from_cache`, `cost_cents`, `source`, `latency_ms`)
that the UI surfaces as a **cached / live badge**. Per-user spend is recorded in a
usage log and surfaced to platform admins on the Admin page.

**Free data providers** can replace DataForSEO per module: Brave Search (SERP),
Google Trends public API (trends), in-process page fetch + parse (On-Page), and
VADER sentiment (content) — see [Configuration](docs/CONFIGURATION.md).

---

## Tech stack

**Backend:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0 (async) + asyncpg/aiosqlite,
Alembic, httpx (HTTP/2), Redis, JWT auth (python-jose + bcrypt), structlog, orjson.
An in-process scheduler loop runs recurring reports (a dedicated container in production).

**Frontend:** React + Vite + TypeScript, React Router v7, TanStack Query v5,
Tailwind CSS (CSS-variable design tokens, class-based dark mode), Recharts, axios,
Zustand. Routes are code-split with `React.lazy`; toasts, command palette (⌘K),
collapsible sidebar, and a bento-grid dashboard layout.

**AI:** provider-agnostic service — Google Gemini (`gemini-2.5-flash`, free tier),
Anthropic Claude (`claude-haiku-4-5`), or local Ollama — switched by one env var.

---

## Quick start

### Option A — Docker (full stack)

```bash
cp .env.example .env          # fill in DFS_LOGIN / DFS_PASSWORD
docker compose up --build
```

- Web UI: http://localhost:5173
- API docs (Swagger): http://localhost:8000/docs
- Services: `db` (Postgres 16), `redis`, `migrate` (one-shot Alembic), `api`, `web`.

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
cd backend && python -m pytest -q     # 75 tests
```

Covers the DataForSEO client, cache-engine tier fallthrough and $0 repeat reads,
free providers, On-Page scoring, the batch coalescer, rank tracking, scheduling +
email, the AI service (all three providers, mocked), and the admin API.

---

## Production

The live deployment runs on a DigitalOcean droplet via `docker-compose.prod.yml`:
Postgres + Redis + API + dedicated scheduler + nginx-served SPA, fronted by Caddy
with automatic Let's Encrypt HTTPS. The frontend is built locally and shipped
prebuilt (small droplets can't run the Vite build). See [Deployment](docs/DEPLOYMENT.md).
