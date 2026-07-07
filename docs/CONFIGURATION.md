# Configuration Reference

All settings are environment variables, loaded from `.env` (local dev) or
`.env.production` (production compose). Templates: `.env.example` and
`.env.production.example`. **Both real env files are git-ignored — never commit
credentials.**

## DataForSEO (primary data provider)

| Variable | Default | Purpose |
|---|---|---|
| `DFS_LOGIN` | — | DataForSEO API login (usually your account email) |
| `DFS_PASSWORD` | — | DataForSEO **API** password (≠ your account login password — see app.dataforseo.com → API Access) |
| `DFS_USE_SANDBOX` | `true` | `true` hits the free sandbox (mock data, $0). Set `false` for real, billed data. |

## Per-module data providers (free alternatives)

| Variable | Values | Default |
|---|---|---|
| `SERP_PROVIDER` | `dataforseo` \| `brave` | `dataforseo` |
| `ONPAGE_PROVIDER` | `dataforseo` \| `local` (in-process fetch+parse, $0) | `dataforseo` |
| `TRENDS_PROVIDER` | `dataforseo` \| `google` (public Trends API, $0) | `dataforseo` |
| `CONTENT_PROVIDER` | `dataforseo` \| `local` (VADER sentiment, $0) | `dataforseo` |
| `BRAVE_API_KEY` | — | Free key from brave.com/search/api (~2k queries/mo); required for `SERP_PROVIDER=brave` |

## Database & cache

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | sqlite dev URL | `postgresql+asyncpg://user:pass@host:5432/db` (prod) or `sqlite+aiosqlite:///./dev.db` (dev) |
| `CACHE_BACKEND` | `memory` | `redis` (prod, shared across workers) or `memory` (single-process dev) |
| `REDIS_URL` | `redis://localhost:6379/0` | Used when `CACHE_BACKEND=redis` |

## Auth

| Variable | Default | Purpose |
|---|---|---|
| `JWT_SECRET` | dev value | **Must** be a long random string in production (`openssl rand -hex 32`) |
| `JWT_ALGORITHM` | `HS256` | Token signing algorithm |
| `ACCESS_TOKEN_MINUTES` | `30` | Access-token lifetime |
| `REFRESH_TOKEN_DAYS` | `7` | Refresh-token lifetime |

## Platform admins

| Variable | Default | Purpose |
|---|---|---|
| `ADMIN_EMAILS` | empty | Comma-separated emails allowed to open `/admin` (user roster with per-user spend, user create/edit). Org roles do **not** grant this. |

## Rate limiting

| Variable | Default | Purpose |
|---|---|---|
| `RATE_LIMIT_ENABLED` | `true` | Master switch |
| `RATE_LIMIT_PER_MINUTE` | `120` | Per-organization, billed module routes |
| `LOGIN_RATE_LIMIT_PER_MINUTE` | `10` | Per-IP, auth routes |

## Scheduler (recurring reports)

| Variable | Default | Purpose |
|---|---|---|
| `SCHEDULER_ENABLED` | `true` | Runs the recurring-job loop. In production compose the **api** container sets this `false` and a dedicated **scheduler** container sets it `true` — keep it that way so scaled API replicas never double-run jobs. |
| `SCHEDULER_INTERVAL_SECONDS` | `300` | How often due schedules are checked |

## Email delivery (optional)

Leave `SMTP_HOST` blank to disable; scheduled reports are still saved, just not emailed.

| Variable | Default | Purpose |
|---|---|---|
| `SMTP_HOST` / `SMTP_PORT` | — / `587` | e.g. `smtp.gmail.com` (use a Gmail **app password**) |
| `SMTP_USER` / `SMTP_PASSWORD` | — | Credentials |
| `SMTP_FROM` | — | From address |
| `SMTP_USE_TLS` | `true` | STARTTLS |

## AI SEO Advisor (optional)

| Variable | Default | Purpose |
|---|---|---|
| `AI_PROVIDER` | `gemini` | `gemini` (free) \| `ollama` (free, local) \| `anthropic` (paid) |
| `GEMINI_API_KEY` | — | Free key from aistudio.google.com/apikey |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Current free-tier model. ⚠️ Google retires it 2026-10-16 → switch to its successor then. |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | `http://localhost:11434` / `llama3.1` | Local models (needs ~6–8 GB RAM for good quality) |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | — / `claude-haiku-4-5` | Paid alternative |

With no provider configured, the Advisor returns a helpful 503 and the rest of
the app works normally.

## Production-only (compose interpolation)

Used by `docker-compose.prod.yml` / `Caddyfile`, not the app itself:

| Variable | Purpose |
|---|---|
| `DOMAIN` | Public site, e.g. `seo.fourdm.services` — Caddy auto-provisions HTTPS for it |
| `TLS_EMAIL` | Let's Encrypt account email (expiry notices) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Postgres container credentials — must match `DATABASE_URL` |
| `CORS_ORIGINS` | Comma-separated allowed origins, e.g. `https://seo.fourdm.services` |
