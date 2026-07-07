# API Reference

Base URL: `https://seo.fourdm.services/api/v1` (production) · `http://localhost:8000/api/v1` (dev)

Interactive Swagger docs are served at **`/docs`** on the API host.

## Conventions

- **Auth:** every endpoint except `/auth/*` requires `Authorization: Bearer <access_token>`.
- **Content type:** JSON in, JSON out.
- **Errors:** RFC 7807 `application/problem+json` —
  `{"type", "title", "status", "detail", "instance"}`. Upstream provider
  failures surface as **502** with a readable `detail`; an unconfigured AI
  provider returns **503**.
- **Rate limits:** 120 requests/min per organization on billed module routes;
  10/min per IP on auth routes. Exceeding returns **429**.
- **`meta` block:** module responses include
  `{"from_cache": bool, "cost_cents": int, "source": str, "latency_ms": int}`.
- **Markets:** `location_code` is a DataForSEO location (2840 = United States),
  `language_code` an ISO code (`en`).

---

## Auth

| Method & path | Body | Returns |
|---|---|---|
| `POST /auth/register` | `{email, password, full_name, org_name}` | `201` — access + refresh tokens + user (creates a new organization; caller becomes `owner`) |
| `POST /auth/login` | `{email, password}` | tokens + user (incl. `is_admin`) |
| `POST /auth/refresh` | `{refresh_token}` | new token pair |
| `GET /auth/me` | — | current user + organization |

```bash
curl -X POST $API/auth/login -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"…"}'
# → {"access_token":"…","refresh_token":"…","token_type":"bearer","user":{…,"is_admin":true}}
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

Bodies follow `{keyword | keywords, location_code, language_code, …}` — see `/docs`.

## Domains

| Path | Purpose |
|---|---|
| `POST /domains/overview` | Organic/paid metrics for a domain |
| `POST /domains/ranked-keywords` | Keywords the domain ranks for |
| `POST /domains/competitors` | Competing domains |
| `POST /domains/intersection` | Keyword gap between two domains |

## On-Page

`POST /onpage/analyze` — `{"url": "example.com", "keyword": "optional"}`.
Bare domains are auto-prefixed with `https://`. Returns the weighted content
score, sub-scores, audits (snippet preview, images/alt, indexability, keyword
placement), and a competitive benchmark when a keyword is given.

## Content

`POST /content/analyze` — `{"keyword": "brand or phrase", …}` → sentiment,
connotation mix, citations.

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
| `POST /backlinks/summary` | Authority (0–100, mapped from provider rank 0–1000), backlinks, referring domains, dofollow split |
| `POST /backlinks/list` | Strongest backlinks, one per referring domain |
| `POST /backlinks/referring-domains` | Referring domains with their own authority |
| `POST /backlinks/anchors` | Anchor texts pointing at the target |

Bodies: `{target, limit?, force_live?}`. Without the subscription these return
**403** with activation instructions.

## Site Audit

| Path | Purpose |
|---|---|
| `POST /audit/start` | Start a crawl — `{domain, max_crawl_pages: 5–200}` → `{task_id, cost_cents}` (billed per page) |
| `GET /audit/status/{task_id}` | Poll progress; when `progress == "finished"` includes `onpage_score`, severity totals, `issues[]`, and `pages[]` |

## AI Insights

`POST /ai/insights` — `{"context": { …any analysis data… }}` →

```json
{"summary": "…", "suggestions": [{"title": "…", "detail": "…", "priority": "high|medium|low"}],
 "model": "gemini-2.5-flash"}
```

`503` if no AI provider is configured; `502` if the provider errors (e.g.
free-tier throttling — retry).

## Projects

| Path | Purpose |
|---|---|
| `GET /projects` / `POST /projects` | List / create projects |
| `GET /projects/{id}` / `DELETE /projects/{id}` | Detail / delete |
| `POST /projects/{id}/runs` | Save a result snapshot `{module, params, result}` |
| `GET /projects/{id}/runs` | List runs (cursor-paginated) |
| `GET /projects/{id}/runs/{run_id}` | Reopen a snapshot — always $0 |

## Schedules

| Path | Purpose |
|---|---|
| `GET /schedules` / `POST /schedules` | List / create — `{project_id, frequency: daily|weekly|monthly, params: {domain, keyword?, email?, …}}` |
| `PATCH /schedules/{id}` | Update (e.g. `{active: false}` to pause) |
| `POST /schedules/{id}/run` | Run immediately |
| `DELETE /schedules/{id}` | Delete |

Each run saves a ProjectRun and (when SMTP is configured) emails the report —
including the AI action plan when an AI provider is enabled.

## Usage

`GET /usage/summary` — month-to-date usage for your organization, broken down by
endpoint, plus the active data providers per module.

## Admin (requires `ADMIN_EMAILS` membership)

| Path | Purpose |
|---|---|
| `GET /admin/users` | All users across all orgs, sorted by total spend: per-user month/total cents, call count, last active |
| `POST /admin/users` | Create a user `{email, password, full_name?, role?, org_name?}` (blank org = yours; new name creates an org) |
| `PATCH /admin/users/{id}` | Partial update: `full_name`, `role`, `password` (reset), `is_active`, `org_name` (move/create). Self-deactivation is rejected (400). |

Non-admin callers receive **403**; unauthenticated **401**.

---

## Status & errors quick reference

| Code | Meaning |
|---|---|
| 401 | Missing/expired token, bad credentials, or deactivated account |
| 403 | Authenticated but not allowed (e.g. Admin routes) |
| 404 | Resource not found |
| 409 | Conflict (e.g. email already registered) |
| 422 | Validation error (problem+json lists the fields) |
| 429 | Rate limit exceeded |
| 502 | Upstream provider rejected the request (detail explains) |
| 503 | Feature not configured (e.g. AI provider key missing) |
