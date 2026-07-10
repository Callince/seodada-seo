# Development Guide

## Prerequisites

- Python **3.12+**, Node **20+**
- Nothing else for the zero-infra path (SQLite + in-memory cache)
- Optional: Docker (Postgres + Redis parity with production)

## First-time setup

```bash
git clone <repo> && cd <repo>
cp .env.example .env
```

For zero-infrastructure dev, set in `.env`:

```
DATABASE_URL=sqlite+aiosqlite:///./dev.db
CACHE_BACKEND=memory
DFS_USE_SANDBOX=true        # free mock data — flip to false only when you want real lookups
```

### Backend

```bash
cd backend
pip install -e ".[dev]"
uvicorn app.main:app --reload        # http://localhost:8000  (Swagger at /docs)
```

SQLite auto-creates tables on startup. On Postgres, run `alembic upgrade head`
first.

### Frontend

```bash
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

The Vite dev server proxies `/api` → `localhost:8000`, so no CORS setup is
needed and the SPA uses relative URLs everywhere.

### Optional: full Docker parity

```bash
docker compose up --build            # db + redis + migrate + api + web
```

## Tests

```bash
cd backend
python -m pytest -q                  # full suite (38 test files, all offline/mocked)
python -m pytest tests/test_ai.py -q # one file
```

Conventions: route handlers are called **directly** with `(body, db, user)` —
no HTTP client needed; a fresh in-memory SQLite db per test (`conftest.py`);
external HTTP is mocked with `respx`; settings are tweaked via
`monkeypatch.setattr(settings, …)`.

Frontend checks:

```bash
cd frontend
npx tsc --noEmit                     # type-check (build runs this too)
npm run lint
npm run build                        # tsc -b && vite build → dist/
```

## Database migrations (Alembic)

```bash
cd backend
alembic upgrade head                           # apply
alembic revision --autogenerate -m "message"   # after editing db/models.py
alembic downgrade -1                           # roll back one
```

`DATABASE_URL` from `.env` drives both the app and Alembic.

## Project conventions

- **Money is integer cents** end-to-end (`cost_cents`, `traffic_cost`).
- **Every billed call** goes through `services/usage.metered(...)` /
  `engine.resolve(...)` — never call the DataForSEO client directly from a route.
- **Errors:** raise `HTTPException` or let typed exceptions
  (`DataForSEOError`, `AiError`) bubble — handlers in `core/errors.py` convert
  them to problem+json.
- **New module checklist:** schema (`schemas/`), parser
  (`integrations/dataforseo/` or `integrations/free/`), route (`api/v1/` +
  register in `router.py` with the `_metered` dependency), TTL in
  `engine.TTL`, frontend hook (`api/hooks/`), page (`routes/` + `router.tsx` +
  `lib/nav.ts`), tests.
- **Frontend data:** TanStack Query for all server state; Zustand only for
  auth/toasts. Use the shared `DataTable`, `StatCard`, `Section` patterns —
  don't hand-roll tables.
- **Design tokens only:** colors come from the CSS variables in `index.css`
  (`text-primary`, `bg-surface`, …) — never hard-code hex values in components.
- **Vite chunking:** keep the `manualChunks` vendor block in `vite.config.ts`
  (Recharts/CJS interop breaks without it — production-only crash).

## Deploying your changes

Production builds the **backend image on the droplet** but serves a **locally
prebuilt frontend** (small droplet ⇒ no Vite build server-side):

```bash
cd frontend && npm run build         # 1. build dist/ locally
# 2. package the repo (incl. dist/, excl. node_modules/.env*) and upload —
#    see docs/DEPLOYMENT.md "Redeploy after a code change"
```

## Useful local URLs

| URL | What |
|---|---|
| http://localhost:5173 | SPA (dev server, HMR) |
| http://localhost:8000/docs | Swagger UI |
| http://localhost:8000/health | Health + active providers |
