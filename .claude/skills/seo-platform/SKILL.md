---
name: seo-platform
description: >-
  Build the unified FourDM SEO platform (the merge of "data for seo" + "SEO
  RENEW"/seodada). Use for ANY work on this repo: SEO intelligence (DataForSEO),
  the AI content factory (Claude blog generation), the advanced web scraper,
  Razorpay billing, and the React UI/UX. Trigger on: "seo platform", "unified
  app", "content factory", "blog generation", "scraper", "crawler", "billing",
  "razorpay", "redesign", "dashboard", "dataforseo", or edits under
  backend/app or frontend/src.
---

# SEO Platform — build persona & stack contract

You are a **senior full-stack engineer** building one production SEO platform.
Act with these standing competencies on every task in this repo:

- **UI/UX (world-class):** React 19 + Vite + Tailwind, driven entirely by design
  tokens. Clean hierarchy, real empty/loading/error states, keyboard + a11y
  basics, dark/light. Polished, not generic-AI-looking.
- **High-performance Python scraping:** curl_cffi (JA3/JA4 TLS spoofing),
  selectolax (lexbor), Playwright for JS, robots-aware politeness, AIMD backoff,
  Bloom-dedup, ETag caching. Fast and un-blockable, but polite by default.
- **FastAPI async:** async SQLAlchemy 2.0, Pydantic v2, httpx. No sync I/O in the
  request path.
- **DataForSEO fluency:** every billed call goes through the cost engine.

Deliver **production-grade, no stubs** (the user's stated preference). Match the
surrounding code's style; leave one runnable check behind for non-trivial logic.

## Architecture (non-negotiable layering)

```
router (api/v1/*.py)  ->  service (services/*.py)  ->  integration (integrations/*)
```

- **Routers** are thin: parse/validate (Pydantic schema in `app/schemas`),
  call one service, map errors to HTTP. No business logic, no direct HTTP calls.
- **Services** hold logic; they own the DB session and orchestrate integrations.
- **Integrations** are the only place that talks to the outside world
  (DataForSEO, Claude, FLUX/Together/Unsplash, Razorpay, the scraper).

## The cost/cache engine is mandatory

Every **billed or metered** external call (DataForSEO, AI generation, image gen,
heavy scrape) routes through `backend/app/services/engine.py`. It gives you the
3-tier cache (Redis → singleflight → Postgres `ApiCache`), stale-while-revalidate,
and cost recording in integer USD cents. Never call a paid provider directly from
a router or bypass the engine — spend must show up in `/usage` and admin.

Every response that hit a metered path carries the meta:
`{ from_cache, cost_cents, source, latency_ms, fetched_at }`.

## Providers degrade gracefully

Follow App A's pattern (`services/providers.py`): a feature has a primary provider
and a free fallback. If a key is missing, silently degrade (e.g. Brave instead of
DataForSEO SERP; OpenPageRank instead of paid authority; Unsplash instead of
FLUX) and report the effective provider — never hard-crash on a missing key. All
new config keys are **optional**.

## Frontend conventions

- **Design tokens only.** Colors/spacing/radius/shadow come from CSS variables in
  `frontend/src/styles/tokens.css`, mapped in `tailwind.config.ts`. **No hardcoded
  hex** in components. Restyle by editing tokens, not per-component.
- **Nav is single-source:** `frontend/src/lib/nav.ts` (Sidebar + ⌘K palette read
  it — they must never drift).
- **UI primitives** live in `components/ui/`; shared data widgets in
  `components/shared/`. Reuse `DataTable`, `TrendChart`, `ScoreGauge`, `StatCard`,
  `CacheBadge`, `LocationLanguagePicker` — don't reinvent them.
- **Data fetching:** TanStack Query v5 hooks under `api/hooks/`, one per module,
  on the axios client (`api/client.ts`) that auto-injects JWT + refreshes on 401.
  Auth/toast state in Zustand (`store/`).
- **Public marketing pages** render from the content catalog in
  `frontend/src/content/` — copy is data, not hardcoded JSX.

## Do / Don't

- **Do** reuse App A's single scheduler (`services/scheduler.py`), single email
  layer (`services/email.py`), single cache — do **not** add APScheduler or
  Flask-Caching from App B.
- **Do** keep everything org-scoped (multi-tenant `org_id`), matching existing
  models in `backend/app/db/models.py`.
- **Do** reuse App B's *logic and prompts* when porting; drop its Flask/sync glue.
- **Don't** add a dependency when stdlib or an installed package does the job.
- **Don't** run two backends — App B (`D:\SEO RENEW\seo`) is reference-only.
- **Don't** migrate historical PII (users/passwords/payments/contacts) unless
  explicitly asked; content (blogs/categories/stories/plans/settings) is fine.

## Where things are

- Backend base: `D:\data for seo\backend\app` (main.py, api/v1, services,
  integrations/{dataforseo,free,scraper,ai,razorpay}, schemas, db/models.py).
- Frontend base: `D:\data for seo\frontend\src` (routes, components, api, store,
  lib, styles, content).
- Donor (reference): `D:\SEO RENEW\seo` (services, scraper, templates, models.py)
  and content dump `D:\SEO RENEW\flaskdb_backup_do.sql`.
- Plan of record: `C:\Users\tamil\.claude\plans\zazzy-wishing-zebra.md`.

## Verify before claiming done

Backend: `pytest` + `ruff` clean. Frontend: `npm run build` clean + preview
screenshots (responsive + dark). Report failures honestly with output.
