# Configuration Reference

All settings are environment variables, loaded from `.env` (local dev) or
`.env.production` (production compose). Templates: `.env.example` and
`.env.production.example`. **Both real env files are git-ignored — never commit
credentials.** Each variable name is the settings field name uppercased.

## DataForSEO (primary data provider)

| Variable | Default | Purpose |
|---|---|---|
| `DFS_LOGIN` | — | DataForSEO API login (usually your account email) |
| `DFS_PASSWORD` | — | DataForSEO **API** password (≠ your account login password — see app.dataforseo.com → API Access) |
| `DFS_USE_SANDBOX` | `true` | `true` hits the free sandbox (mock data, $0). Set `false` for real, billed data. A `dfs_base_url` property switches host accordingly. |

## Per-module data providers (free alternatives)

| Variable | Values | Default |
|---|---|---|
| `SERP_PROVIDER` | `dataforseo` \| `brave` | `dataforseo` |
| `ONPAGE_PROVIDER` | `dataforseo` \| `local` (in-process fetch+parse, $0) | `dataforseo` |
| `TRENDS_PROVIDER` | `dataforseo` \| `google` (public Trends API, $0) | `dataforseo` |
| `CONTENT_PROVIDER` | `dataforseo` \| `local` (VADER sentiment, $0) | `dataforseo` |
| `BRAVE_API_KEY` | — | Free key from brave.com/search/api; required for `SERP_PROVIDER=brave` |
| `OPENPAGERANK_API_KEY` | — | Free key from domcop.com/openpagerank; maps 0–10 → 0–100 domain authority at $0 |

## Database & cache

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite+aiosqlite:///./dev.db` | `postgresql+asyncpg://user:pass@host:5432/db` (prod) |
| `CACHE_BACKEND` | `memory` | `redis` (prod, shared across workers) or `memory` (single-process dev) |
| `REDIS_URL` | `redis://localhost:6379/0` | Used when `CACHE_BACKEND=redis` |

## Auth

| Variable | Default | Purpose |
|---|---|---|
| `JWT_SECRET` | dev value | **Must** be a long random string in production (`openssl rand -hex 32`) |
| `JWT_ALGORITHM` | `HS256` | Token signing algorithm |
| `ACCESS_TOKEN_MINUTES` | `30` | Access-token lifetime |
| `REFRESH_TOKEN_DAYS` | `7` | Refresh-token lifetime |
| `RESET_TOKEN_MINUTES` | `30` | Password-reset token lifetime |

## Google OAuth / Gmail (optional)

Enables "Sign in with Google" and Gmail-based email sending.

| Variable | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth client credentials |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL |
| `GOOGLE_GMAIL_REFRESH_TOKEN` | Refresh token for sending mail via Gmail |

## Quotas (daily analysis limits)

| Variable | Default | Purpose |
|---|---|---|
| `QUOTA_ENABLED` | `true` | Master switch for daily-limit enforcement |
| `FREE_DAILY_ANALYSES` | `10` | Daily billed-analysis limit for the free tier; paid plans override via the plan's `usage_per_day`. Over-limit returns **HTTP 402**. Platform admins are exempt; cached reads don't count. |
| `DEFAULT_ORG_QUOTA_CENTS` | `5000` | Per-org monthly cents ceiling stored on `organizations` |

## Platform admins

| Variable | Default | Purpose |
|---|---|---|
| `ADMIN_EMAILS` | empty | Comma-separated emails allowed into the `/admin` portal and `/auth/admin/login`. Org roles do **not** grant this. Fine-grained admin RBAC is stored per-user in `admin_permissions`. |

## Rate limiting

| Variable | Default | Purpose |
|---|---|---|
| `RATE_LIMIT_ENABLED` | `true` | Master switch |
| `RATE_LIMIT_PER_MINUTE` | `120` | Per-organization, billed module routes |
| `LOGIN_RATE_LIMIT_PER_MINUTE` | `10` | Per-IP, auth routes |

## Scheduler & rank watch

| Variable | Default | Purpose |
|---|---|---|
| `SCHEDULER_ENABLED` | `true` | Runs the recurring-job loop. In production compose the **api** container sets this `false` and a dedicated **scheduler** container sets it `true` — keep it that way so scaled API replicas never double-run jobs. |
| `SCHEDULER_INTERVAL_SECONDS` | `300` | How often due schedules are checked |
| `RANK_AUTOCHECK_ENABLED` | `true` | Daily automatic rank re-checks |
| `RANK_ALERT_DELTA` | `3` | Position-move threshold that triggers a rank alert |

## Crawler / scraper (Site Audit + local tools)

| Variable | Default | Purpose |
|---|---|---|
| `CRAWL_CONCURRENCY` | `6` | Concurrent page fetches per job |
| `CRAWL_MAX_CONCURRENT_JOBS` | `2` | Simultaneous crawl jobs |
| `CRAWL_TOTAL_TIMEOUT_SECONDS` | `150` | Whole-job budget |
| `CRAWL_TIMEOUT_SECONDS_PER_PAGE` | `15.0` | Per-page timeout |
| `CRAWL_MAX_DEPTH` | `5` | Max link depth from the seed |
| `CRAWL_USER_AGENT` / `CRAWL_USER_AGENT_TAG` | — | Crawler UA string / tag |
| `SCRAPER_CACHE_DB` | — | Scraper conditional-GET cache location |
| `SCRAPER_RENDER_JS` | `false` | Set `true` to use Playwright JS rendering |

## Email delivery (optional)

Leave `SMTP_HOST` blank to disable; scheduled reports are still saved, just not
emailed. An `emails_enabled` property reflects whether SMTP is configured.

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
| `GEMINI_MODEL` | `gemini-2.5-flash` | Primary model |
| `GEMINI_FALLBACK_MODEL` | `gemini-2.5-flash-lite` | Used when the primary is throttled |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | — / `claude-haiku-4-5` | Paid alternative |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | `http://localhost:11434` / — | Local models |

With no provider configured, the Advisor returns a helpful 503 and the rest of
the app works normally.

## Content factory (automated blog generation, optional)

| Variable | Default | Purpose |
|---|---|---|
| `BLOG_GENERATION_ENABLED` | — | Master switch for scheduled blog generation |
| `BLOG_AUTO_PUBLISH` | — | Publish generated posts automatically vs. leave as drafts |
| `BLOG_GENERATION_HOUR` | `3` | Hour of day to generate posts |
| `BLOG_KEYWORD_RESEARCH_HOUR` | `2` | Hour of day to refresh keyword research |
| `BLOG_NICHE_REFRESH_WEEKDAY` | `0` | Weekday to refresh the niche set (0 = Monday) |
| `IMAGE_PROVIDER` | — | `together` \| `replicate` \| `unsplash` |
| `TOGETHER_API_KEY` / `REPLICATE_API_TOKEN` / `UNSPLASH_ACCESS_KEY` | — | Credentials for the chosen image provider |
| `CONTENT_UPLOAD_DIR` | — | Where uploaded/generated images are stored |

## Billing & GST (Razorpay — India)

| Variable | Default | Purpose |
|---|---|---|
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | — | Razorpay API keys |
| `RAZORPAY_WEBHOOK_SECRET` | — | Verifies incoming Razorpay webhook signatures |
| `GST_RATE_PERCENT` | `18.0` | GST rate applied to invoices |
| `INVOICE_COMPANY_NAME` | `FourDM` | Company name on invoices |
| `SELLER_NAME` / `SELLER_GSTIN` / `SELLER_STATE` / `SELLER_STATE_CODE` / `SELLER_PAN` / `SELLER_CIN` / `SELLER_HSN` / `SELLER_ADDRESS` | — | Seller identity printed on GST invoices |

## Site / misc

| Variable | Default | Purpose |
|---|---|---|
| `SITE_URL` | `https://seo.fourdm.services` | Used in emails, OAuth callbacks, and invoices |
| `CORS_ORIGINS` | — | Comma-separated allowed origins → parsed into `cors_origin_list` |

## Production-only (compose interpolation)

Used by `docker-compose.prod.yml` / `Caddyfile`, not read by the app itself:

| Variable | Purpose |
|---|---|
| `DOMAIN` | Public site, e.g. `seo.fourdm.services` — Caddy auto-provisions HTTPS for it |
| `TLS_EMAIL` | Let's Encrypt account email (expiry notices) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Postgres container credentials — must match `DATABASE_URL` |
