# API Reference

Base URL: `https://seo.fourdm.services/api/v1` (production) · `http://localhost:8000/api/v1` (dev)

Interactive Swagger docs are served at **`/docs`** on the API host.

## Conventions

- **Auth:** every endpoint except `/auth/*`, `/public/*`, and `/webhooks/*`
  requires `Authorization: Bearer <access_token>`.
- **Content type:** JSON in, JSON out.
- **Errors:** RFC 7807 `application/problem+json` —
  `{"type", "title", "status", "detail", "instance"}`. Upstream provider
  failures surface as **502** with a readable `detail`; an unconfigured AI
  provider returns **503**. The **daily analysis limit exhausted** returns
  **402**, raised *before* any billed upstream call.
- **Rate limits:** 120 requests/min per organization on billed module routes;
  10/min per IP on auth routes. Exceeding returns **429**.
- **`meta` block:** module responses include
  `{"from_cache": bool, "cost_cents": int, "source": str, "latency_ms": int}`
  where `source ∈ redis | postgres | revalidating | live`.
- **Money:** DataForSEO amounts are integer USD cents; billing amounts are
  INR paise.
- **Markets:** `location_code` is a DataForSEO location (2840 = United States),
  `language_code` an ISO code (`en`).

---

## Auth

| Method & path | Body | Returns |
|---|---|---|
| `POST /auth/register` | `{email, password, full_name, org_name}` | new user + organization (caller becomes `owner`) |
| `POST /auth/signup/verify` | `{email, otp}` | verify signup — 6-digit OTP when email is enabled |
| `POST /auth/login` | `{email, password}` | access + refresh tokens + user |
| `POST /auth/admin/login` | `{email, password}` | tokens — platform admins only |
| `POST /auth/refresh` | `{refresh_token}` | new token pair |
| `POST /auth/password/forgot` | `{email}` | sends a reset link/code |
| `POST /auth/password/reset` | `{token, new_password}` | resets the password |
| `GET /auth/google/login` | — | redirect to Google OAuth |
| `GET /auth/google/callback` | — | OAuth callback → tokens |
| `GET /auth/me` | — | current user + organization |

```bash
curl -X POST $API/auth/login -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"…"}'
# → {"access_token":"…","refresh_token":"…","token_type":"bearer","user":{…}}
```

Access tokens last 30 min; refresh tokens 7 days. Deactivated users get 401.

---

## SERP

`POST /serp/ranking`

```json
{"keyword": "running shoes", "location_code": 2840, "language_code": "en", "depth": 100, "force_live": false}
```

`force_live: true` bypasses every cache read and fetches fresh, billed data
(also supported on `POST /report/site`).

`depth` 1–100 (default 10). Returns `results[]` (position, title, url, domain,
brand_name, brand_volume), `paa[]` (People Also Ask), `meta`.

## Keywords

| Path | Purpose |
|---|---|
| `POST /keywords/volume` | Search volume, CPC, competition + 12-month monthly history |
| `POST /keywords/trends` | Google Trends series — accepts `period` (e.g. `today`, `7d`, `30d`, `12m`, `5y`) or explicit `date_from`/`date_to` |
| `POST /keywords/suggestions` | Long-tail suggestions with volume |
| `POST /keywords/related` | Related keywords |
| `POST /keywords/ideas` | Keyword ideas |
| `POST /keywords/paa` | People Also Ask for a keyword |
| `POST /keywords/overview` | Combined keyword overview metrics |

Bodies follow `{keyword | keywords, location_code, language_code, …}` — see `/docs`.

## Domains

| Path | Purpose |
|---|---|
| `POST /domains/overview` | Organic/paid metrics for a domain |
| `POST /domains/ranked-keywords` | Keywords the domain ranks for |
| `POST /domains/competitors` | Competing domains |
| `POST /domains/intersection` | Keyword gap between two domains |
| `POST /domains/history` | Historic domain metrics |
| `POST /domains/whois` | WHOIS record data |
| `POST /domains/technologies` | Detected technology stack |

## On-Page

`POST /onpage/analyze` — `{"url": "example.com", "keyword": "optional"}`.
Bare domains are auto-prefixed with `https://`. Returns the weighted content
score, sub-scores, audits (snippet preview, images/alt, indexability, keyword
placement), and a competitive benchmark when a keyword is given.

`POST /onpage/lighthouse` — Lighthouse performance report for a URL.

## Local Analysis (in-process, $0)

| Path | Purpose |
|---|---|
| `POST /analyze/page` | Fetch + analyze a single URL |
| `POST /analyze/sitemap` | Crawl + analyze a sitemap |

## Content

| Path | Purpose |
|---|---|
| `POST /content/analyze` | Sentiment, connotation mix, citations |
| `POST /content/sentiment` | Sentiment scoring |
| `POST /content/phrase-trends` | Phrase trends over time |

## Rank Tracking

| Path | Purpose |
|---|---|
| `POST /rank/track` | Record the current position for `{domain, keyword, location_code, language_code}` |
| `GET /rank/tracked` | All tracked pairs for your org |
| `GET /rank/history?domain=…&keyword=…` | Position history + deltas |

## Site Report

`POST /report/site`

```json
{"domain": "acme.com", "keyword": "optional target", "location_code": 2840,
 "language_code": "en", "max_pages": 5}
```

Composite, multi-call report: `health_score`, `overview`, `pages[]` (scored),
`top_keywords[]`, `competitors[]`, `ranking`, `findings[]`, `recommendations[]`,
`meta` (total cost). `health_score` is `null` when the target site blocks
crawling (a finding explains this).

## Backlinks (requires the DataForSEO Backlinks subscription)

| Path | Purpose |
|---|---|
| `POST /backlinks/summary` | Authority, backlinks, referring domains, dofollow split |
| `POST /backlinks/list` | Strongest backlinks, one per referring domain |
| `POST /backlinks/referring-domains` | Referring domains with their own authority |
| `POST /backlinks/anchors` | Anchor texts pointing at the target |
| `POST /backlinks/history` | Backlink profile history |
| `POST /backlinks/new-lost` | New and lost backlinks |
| `POST /backlinks/competitors` | Backlink competitors |
| `POST /backlinks/spam-score` | Spam score for the target |
| `POST /backlinks/link-gap` | Link gap versus a competitor |

Bodies: `{target, limit?, force_live?}`. Without the subscription these return
**403** with activation instructions.

## Local Listings

`POST /local/listings` — Google business listings search.

## Site Audit

| Path | Purpose |
|---|---|
| `POST /audit/start` | Start a crawl — `{domain, max_crawl_pages: 5–200}` → `{task_id, cost_cents}` (billed per page) |
| `GET /audit/status/{task_id}` | Poll progress; when finished includes `onpage_score`, severity totals, `issues[]`, and `pages[]` |

## AI Visibility

| Path | Purpose |
|---|---|
| `POST /ai-visibility/check` | Start a job: is the domain cited in Google AI Overview / AI Mode → `task_id` |
| `GET /ai-visibility/status/{task_id}` | Poll the job |
| `POST /ai-visibility/mentions` | LLM mention metrics |
| `POST /ai-visibility/ai-volume` | AI keyword search volume |
| `POST /ai-visibility/ask` | Query an LLM response |

## AI Insights

`POST /ai/insights` — `{"context": { …any analysis data… }}` →

```json
{"summary": "…", "suggestions": [{"title": "…", "detail": "…", "priority": "high|medium|low"}],
 "model": "…"}
```

`503` if no AI provider is configured; `502` if the provider errors.

## Projects (not rate-limited)

| Path | Purpose |
|---|---|
| `GET /projects` / `POST /projects` | List / create projects |
| `GET /projects/{id}` / `PUT /projects/{id}` / `DELETE /projects/{id}` | Detail / update / delete |
| `POST /projects/{id}/runs` | Save a result snapshot `{module, params, result}` |
| `GET /projects/{id}/runs` | List runs (cursor-paginated) |
| `GET /projects/{id}/runs/{run_id}` | Reopen a snapshot — always $0 |

## Schedules

| Path | Purpose |
|---|---|
| `GET /schedules` / `POST /schedules` | List / create — `{project_id, frequency: daily|weekly|monthly, params: {domain, keyword?, email?}}` |
| `PATCH /schedules/{id}` | Update (e.g. `{active: false}` to pause) |
| `POST /schedules/{id}/run` | Run immediately |
| `DELETE /schedules/{id}` | Delete |

Each run saves a ProjectRun and (when SMTP is configured) emails the report —
including the AI action plan when an AI provider is enabled.

## Usage

| Path | Purpose |
|---|---|
| `GET /usage/summary` | Month-to-date usage by endpoint + active providers per module |
| `GET /usage/dashboard` | Dashboard statistics |

## Billing (authed)

| Path | Purpose |
|---|---|
| `GET /billing/plans` | Available plans |
| `GET /billing/subscription` | Current subscription |
| `POST /billing/checkout` | Create a Razorpay order |
| `POST /billing/verify` | Verify payment signature + activate |
| `GET /billing/payments` | Payment history |
| `GET /billing/payments/{payment_id}/invoice` | GST invoice PDF |

Public plans list (no auth): `GET /public/plans`.

## Webhooks (no auth, HMAC-verified)

`POST /webhooks/razorpay` — Razorpay payment events.

## Public Content (no auth)

| Path | Purpose |
|---|---|
| `POST /public/contact` | Contact form |
| `GET /public/blog` | Blog post list |
| `GET /public/blog-categories` | Blog categories |
| `GET /public/blog/{slug}` | Single blog post |
| `GET /public/webstories` | Web story list |
| `GET /public/webstories/{slug}` | Single web story |

## Admin (requires `ADMIN_EMAILS` membership + RBAC permission per route)

Non-admin callers receive **403**; unauthenticated **401**.

- **Users:** `GET/POST /admin/users`, `GET/PATCH/DELETE /admin/users/{id}`,
  `POST /admin/users/{id}/reset-password` — self-deactivation is rejected (400).
- **Stats:** `GET /admin/stats`.
- **Plans:** `GET/POST /admin/plans`, `PATCH/DELETE /admin/plans/{id}`.
- **Subscriptions:** `GET/POST /admin/subscriptions`,
  `POST /admin/subscriptions/{id}/extend`, `PATCH /admin/subscriptions/{id}`.
- **Payments:** `GET /admin/payments`, `PATCH /admin/payments/{id}`,
  `POST /admin/payments/{id}/refund`, `GET /admin/payments/{id}/invoice`.
- **Settings:** `GET/PUT /admin/settings` (website settings).
- **Blog categories:** CRUD.
- **Blogs:** CRUD + `POST /admin/blogs/upload-image`.
- **Web stories:** CRUD.
- **Contact submissions:** list / export / detail / patch / reply / delete.
- **Email logs:** list / export / detail / retry.
- **Usage history:** `GET /admin/usage-history`, `GET /admin/usage-history/export`.
- **Me:** `GET /admin/me`.
- **Roles:** `GET/POST /admin/roles`, `PATCH/DELETE /admin/roles/{user_id}`.

## Health

`GET /health` (public) — liveness + active providers.

---

## Status & errors quick reference

| Code | Meaning |
|---|---|
| 401 | Missing/expired token, bad credentials, or deactivated account |
| 402 | Daily analysis limit exhausted — raised before any billed call |
| 403 | Authenticated but not allowed (missing RBAC permission, Admin route, or inactive Backlinks subscription) |
| 404 | Resource not found or outside your tenant |
| 409 | Conflict (e.g. email already registered) |
| 422 | Validation error (problem+json lists the fields) |
| 429 | Rate limit exceeded |
| 502 | Upstream provider rejected the request (detail explains) |
| 503 | Feature not configured (e.g. AI provider key missing) |
