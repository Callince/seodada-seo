# Data structures, data flow & algorithms

Companion to [ARCHITECTURE.md](./ARCHITECTURE.md). That document says *what the
pieces are and where they live*; this one says *what the data looks like, how a
request moves through it, and how each algorithm actually works*.

Every number here (TTL, weight, threshold, rate) was read from the source, not
recalled. Where a value has a reason that isn't obvious, the reason is given —
those are the lines that stop someone "simplifying" a deliberate choice.

---

## Part 1 — Data structures

20 tables. Two rules hold everywhere:

- **Money is stored in minor units** (paise / cents), never formatted strings.
- **`cost_cents` is a FLOAT, not an integer.** DataForSEO prices sub-cent calls
  (an AI Overview lookup is $0.002 = 0.2¢). Integer cents rounded those to zero
  and real spend went unrecorded. This applies to `api_cache.cost_cents` and
  `usage_log.cost_cents`.

### Tenancy

```
Organization 1──n User
     │                 role: owner | member          ← tenant-level
     │                 is_staff + admin_permissions  ← platform-level (separate axis)
     └── everything else scopes by org_id
```

A tenant `owner` has **no** admin-panel access; platform admin is a different
axis entirely (`ADMIN_EMAILS` env for super-admins, `admin_permissions` slugs
for staff).

| table | notable columns | why it matters |
|---|---|---|
| `users` | `unlimited_usage` | quota exemption, admin-granted — checked before the daily gate |
| `refresh_tokens` | `jti`, `revoked`, `expires_at` | one row per session; makes logout and rotation possible |

### Engine tables

| `api_cache` | |
|---|---|
| `params_hash` | **unique** — SHA-256 of `endpoint + sorted(params)` |
| `response` | JSONB (Postgres) / JSON (SQLite) |
| `cost_cents` | float — see above |
| `fetched_at` / `expires_at` | drive freshness, SWR and the 30-day fallback |

| `usage_log` | |
|---|---|
| `cost_cents`, `from_cache` | a cached read logs cost 0 but still records the call |
| index `(org_id, created_at)` | serves the quota check *and* admin spend views |

### Product data

```
rank_snapshots:  keyword × domain × location × device → position, url, created_at
                 position IS NULLABLE
```

`NULL` position means **"checked, not found"** — a different fact from "never
checked" (no row). The rank chart needs to distinguish them; collapsing `NULL`
to 0 would draw a domain as rank 0 (better than #1) or as a gap.

```
projects 1──n project_runs
                result_ref ──► api_cache.params_hash
```

A run stores a **pointer**, not a copy. Reopening a saved analysis is $0 and
cannot drift from what was actually fetched.

### Billing

`plans` (price in paise, `usage_per_day`, `tier`) → `subscriptions` (status,
`current_period_end`) → `payments` (`amount_cents`, `tax_cents`,
`invoice_number`) + `invoice_addresses` (GSTIN etc. for the tax invoice).

**Currency invariant**: Razorpay charges INR; every stored amount is INR minor
units. `website_settings.display_currency` converts figures **for reading only**.

---

## Part 2 — Data flow

### A billed request, end to end

```
POST /api/v1/keywords/volume        {keywords:["SEO","seo"], location, language}
  │
  ├─ deps.current_user       JWT → User      (401 → client refreshes once, retries)
  │
  ├─ router                  NORMALIZE: strip, lowercase, dedupe, SORT
  │                          └─ this is load-bearing: it decides the cache key
  │
  └─ usage.metered(db, user, endpoint, params, ttl, fetch_fn)
       │
       ├─ 1  assert_within_quota(db, user)
       │       skip if: quota disabled | platform admin | user.unlimited_usage
       │       else daily_calls(org) >= daily_limit(org) → 429
       │
       ├─ 2  engine.resolve(...)
       │       key = sha256(endpoint | orjson(params, sort_keys))
       │
       │       L1  Redis/memory ────────────────────► HIT  source=redis   (~0ms, $0)
       │            │ miss
       │       ┌────▼──── singleflight lock on key ────────────────┐
       │       │  re-check L1  (a waiter may have filled it)       │
       │       │  L2  Postgres api_cache                           │
       │       │      ├ expires_at > now      → prime L1, return   │  source=postgres
       │       │      ├ within SWR (7 days)   → return stale NOW   │  source=stale
       │       │      │                          + background revalidate
       │       │      └ within 30 days        → hold as fallback   │
       │       │  MISS → fetch_fn() upstream                       │  source=live, $
       │       │      ├ ok   → persist L2 (cost) → prime L1        │
       │       │      └ fail → serve the ≤30d fallback if we have one
       │       └───────────────────────────────────────────────────┘
       │
       ├─ 3  usage_log row  (user, org, endpoint, cost_cents, from_cache)
       │
       └─ 4  Resolved{data, cost_cents, from_cache, source, latency_ms, fetched_at}
              │
              └─ router: provider payload → response model + meta{...}
```

`meta` reaches the browser on **every** response and drives the cache badge — a
user can always see whether a number was live or cached, and what it cost.

### Frontend flow

```
Component ─► hook (useVolume/useTrends/…) ─► useMeteredMutation ─► axios
                                                     │
   client.ts interceptor: 401 → refresh ONCE → retry │  (2nd 401 → logout, no loop)
                                                     ▼
                              onSuccess → invalidate ["usage","summary"]
                                          so the spend meter updates immediately
```

**State ownership** — deliberately split, never mixed:

| concern | owner |
|---|---|
| server data | TanStack Query (cache, retry, invalidation) |
| auth, toasts | Zustand (+ persist for auth) |
| UI that must survive navigation | `usePersistedState` → localStorage |

### Background flows

```
scheduler_main (1 replica)
  └─ every N s: claim_due()  ── conditional UPDATE on next_run_at = the lock
       └─ site report → optional AI enrichment → ProjectRun → optional email

rank_watch
  └─ daily: due_pairs() → fetch position → _should_alert(old,new,threshold) → email
```

`claim_due` **advances `next_run_at` as it selects**, so the claim itself is the
lock — two replicas cannot run one schedule twice.

---

## Part 3 — Algorithms

### 3.1 Cache key: sorted-params hashing

```python
params_hash = sha256(endpoint + b"|" + orjson.dumps(params, OPT_SORT_KEYS))
```

Sorting makes the hash **order-independent**, so `{a:1,b:2}` and `{b:2,a:1}` hit
one entry. Routers normalize *before* hashing — without it, `["SEO","seo"]` is a
second paid call for identical data.

### 3.2 Three-tier cache + stale-while-revalidate

```
 fresh              SWR window (7 d)            hard fallback (30 d)
├──────────────┼───────────────────────────┼────────────────────────────┤
 serve L2       serve stale IMMEDIATELY,     fetch synchronously;
                revalidate in background     use old copy ONLY if fetch fails
```

TTL by volatility: `on_page` 30 m · `serp` 6 h · `content` 6 h · `trends` 12 h ·
`ai_mentions` 24 h · `local` 24 h · `labs` 2 d · `backlinks` 3 d ·
`search_volume` 3 d · `domain_meta` 7 d.

Two subtleties:

- The background refresh is owned by **`metered()`, not `resolve()`** — so its
  cost is still attributed to a user rather than vanishing.
- A stale serve primes L1 for only **60 s** (`SWR_L1_TTL`), so the refreshed
  value takes over quickly instead of being masked for the full TTL.

### 3.3 Singleflight

One async lock per `params_hash`. Ten users hitting the same cold keyword
produce **one** upstream call.

The lock is taken *after* the first L1 probe, and **L1 is re-checked inside it** —
without that re-check every waiter would fetch again the moment the lock released,
which is the bug this pattern exists to prevent.

### 3.4 Batch coalescing (`coalescer.py`)

Sits *behind* the engine; keyword search volume only. Upstream is Labs
`keyword_overview`, chunked at its 700-keyword ceiling — the union across
concurrent waiters can exceed what any single request asks for, and the endpoint
truncates silently. See `docs/PROVIDER_STRATEGY.md` §3.

```
t=0     req A wants [a,b]      ─┐
t=20ms  req B wants [b,c]       ├─ 60 ms window
t=45ms  req C wants [d]        ─┘
t=60ms  ONE upstream call for {a,b,c,d} → rows fanned back to A, B, C
```

Cost is split **proportionally by keyword count at 4dp, with the remainder given
to the last waiter**, so attributed costs sum to the real upstream cost *exactly*.

The 4dp matters: `cost_cents` is a float because DataForSEO bills sub-cent, and
this call now costs ~1.2¢. Rounding to whole cents charged one waiter 1.000¢ and
another 0.236¢ for an equal share of the same call.

### 3.5 Quota

```
assert_within_quota:
    if not quota_enabled or is_platform_admin or user.unlimited_usage:  return
    if daily_calls(org, today) >= daily_limit(org):  429
```

`metered_parallel(check_quota=False)` exists for billed **sub-lookups inside an
already-gated request** (brand volume during a SERP call). Re-checking would
count one user action twice against their limit.

### 3.6 On-page score (`scoring.py`)

Weighted 0–100, provider-independent — same model whether the page came from
DataForSEO `instant_pages` or the local $0 fetch.

| component | weight |
|---|---|
| Keyword optimization | 22 |
| Title | 18 |
| Content depth | 18 |
| Headings (H1/H2) | 16 |
| Meta description | 14 |
| Readability | 12 |

Sub-scores come from `_band(value, [(threshold, score), …])` — **banded, not
step** — so a near-miss scores near-full instead of falling off a cliff.

Technical signals (noindex, alt coverage, schema, link counts) generate
**recommendations without re-weighting** the score. They are advice, not grade —
mixing them in would make the number incomparable between pages.

### 3.7 Pixel-width truncation (`pixels.py`)

Google truncates titles and descriptions by **pixel width, not character count**.
A short-but-wide title (`WWW Mmm…`) truncates while a longer thin one fits.
Approximates Arial glyph widths (Google's desktop font) to predict truncation and
render a realistic snippet preview. Character limits alone mislabel both cases.

### 3.8 Keyword density (`density.py`)

`tokenize → n-grams(1..3) → filter → rank`

`_phrase_ok` rejects phrases that **begin or end** on a stopword ("of the best")
while keeping internal ones ("best of breed"), and requires ≥1 non-stopword.
Without it the top ten fills with "of the", "in the".

`_is_public_host` resolves the host and rejects private/loopback/reserved ranges
**before any fetch** — SSRF guard on a user-supplied URL.

### 3.9 AI keyword dedup (`ai_optimization.py`)

The reverse lookup returns near-duplicates: a live sample spent **3 of its top
10** on one intent — "keyword research", "keyword keyword research", "research
keywords".

```
key(q) = " ".join(sorted({ singular(w) for w in words(q) }))
singular(w) = w[:-1] if len(w) > 3 and w.endswith("s") and not w.endswith("ss")
```

Word-**set** kills order and repetition; naive singularization kills plurals. The
4-char floor matters: `ads → ad` is right, `is → i` is not.

On collapse, the **highest-volume phrasing wins** and platforms are **unioned** —
the same prompt genuinely appears on several engines, and dropping that would
understate reach. Merged 4 of 20 rows on live data.

Deliberately conservative: `best seo tools` and `worst seo tools` stay separate.
Over-merging hides real keywords, which is worse than showing a duplicate.

### 3.10 Adaptive crawl politeness (`scraper/politeness.py`)

Three independent gates, all of which must pass:

**1 · robots.txt** — fetched once per host, cached, per-URL check, `Crawl-delay`
wired into the governor's minimum delay.

**2 · AIMD concurrency** — TCP-congestion control, per host:

```
start:    concurrency = 2.0            (float — growth must be gradual)
success:  c += 1 / c                   additive, decelerating as c rises
failure:  c  = max(1.0, c / 2)         multiplicative decrease
```

No hardcoded worker count — the crawler *discovers* each host's tolerance and
backs off the moment it over-steps.

**3 · Circuit breaker** — after N consecutive failures the host is refused for a
cooldown; `Retry-After` is honoured when the server sends one. The failure
counter **resets when the breaker opens**, so the host is retried after cooldown
rather than permanently blacklisted.

### 3.11 Crawl frontier (`scraper/frontier.py`)

Priority heap on `(depth, score, tiebreak)` — breadth-first with a relevance
tiebreak, so shallow useful pages come first.

Dedup is **bloom filter + SQLite**, and both are needed:

| | role |
|---|---|
| bloom | O(1) in-memory "seen?" for the common case |
| SQLite `seen_urls` | authoritative — rebuilds the bloom after restart, and resolves false positives via `has_seen_exact` |

A bloom alone would silently **skip** pages on a false positive; SQLite alone
would be a disk hit per URL.

### 3.12 Rank tracking (`ranking.py`, `rank_watch.py`)

`find_position` normalizes both sides before matching, so `www.`/protocol/case
variants don't read as "not found". `_should_alert(old, new, threshold)` fires
only on a **material** move — daily ±1 noise doesn't email anyone.

### 3.13 Keyset pagination (`pagination.py`)

Opaque cursor encoding `(sort_timestamp, id)`; the next page is a keyset
predicate, not `OFFSET`.

| | OFFSET | keyset |
|---|---|---|
| cost at depth | O(offset) | O(1) |
| under concurrent insert/delete | skips or repeats rows | stable |

### 3.14 Local sentiment (`sentiment.py`)

VADER over the SERP corpus (title + snippet per result) plus a small emotion
lexicon — $0, and shaped **identically to the DataForSEO Content Analysis
response**, so the route and response model don't change with the provider.

### 3.15 FX conversion (`fx.py` + `frontend/src/lib/currency.ts`)

Base is **INR** — the currency Razorpay actually charges. Rates from
`open.er-api.com`: no key, 166 currencies, ~50 ms. Cross-checked against
frankfurter (ECB) the same day: USD 0.01036 vs 0.01037.

Failure ladder, deliberately loud:

```
fresh (≤6 h)          → serve
stale (≤7 days)       → serve, FLAGGED stale so the UI can say so
older / never fetched → raise RatesUnavailable — never fabricate
unknown currency      → None → formatter falls back to the true INR amount
```

A foreign symbol over an unconverted number is indistinguishable from a correct
conversion and wrong by ~80×. Falling back visibly beats converting invisibly.

**Admin USD spend** is a separate path: DataForSEO bills in USD, Razorpay in INR,
and the admin panel shows both. It uses the **inverse** rate (0.01036 → 96.53) and
reads the **full rate table**, not the site's active display currency — the two
are unrelated, and wiring it to the display currency made it silently do nothing
when the site was on INR.

### 3.16 Auth (`core/security.py`, `api/v1/auth.py`)

Short-lived access JWT + long-lived refresh token carrying a `jti` that maps to a
`refresh_tokens` row.

- **Rotation**: refreshing revokes the old row and issues a new one — a stolen
  refresh token is single-use.
- **Revocation**: logout and password reset revoke *every* row for that user.
- **Client**: refreshes **once** per request then retries; a second 401 logs out
  rather than looping.

### 3.17 Razorpay verification (`integrations/razorpay/client.py`)

```
checkout callback:  HMAC_SHA256("{order_id}|{payment_id}", secret)
webhook:            HMAC_SHA256(raw_request_body,          secret)
compare:            constant-time
```

The webhook must hash the **raw body**, not re-serialized JSON — key order or
whitespace changes would break an otherwise valid signature. Activation is
idempotent across both paths, since either can arrive first (or twice).

---

## Part 4 — Provider strategy

Each module can independently swap to a free source:

| module | paid | free | default |
|---|---|---|---|
| SERP | DataForSEO (Google · Bing · Yahoo) | — | DataForSEO, engine per request |
| On-page | DataForSEO | local fetch+parse | DataForSEO |
| **Trends** | DataForSEO — 4.7–12.3 s, 1.1¢ | **Google Trends — 1.4–2.1 s, $0** | **Google** |
| Content | DataForSEO | VADER over SERP corpus | DataForSEO |

Trends measured identical on both providers — 53 points, same date range, values
within 1 — because DataForSEO relays Google Trends. Going direct is the same data,
several times faster, free.

**Never silently degrade.** Google 429s roughly 1 in 3 sequential calls, so the
free provider retries 3× with backoff, then raises `TrendsUnavailable`, and the
endpoint **falls back to DataForSEO**. An empty chart would be indistinguishable
from "nobody searches this" — the one failure mode a trends view must not have.

---

## Part 5 — Invariants

Break these and the failure is silent:

1. **Normalize before hashing.** Un-normalized params = paying twice for one answer.
2. **`cost_cents` stays a float.** Integers round sub-cent calls to zero; spend disappears.
3. **Never call an integration directly for billed work.** Bypassing `metered()` loses cost, cache and quota in one move.
4. **New fields on a cached payload are OPTIONAL at the consumer.** Analyses persist in localStorage *and* server-side, so code shipped after a shape change still receives the old shape. (Real bug: `k.blocks.map` threw on a payload cached before `blocks` existed — and the type said it was required, so the compiler approved it.)
5. **Two currencies in admin.** DataForSEO = USD, Razorpay = INR. Converting the wrong set double-converts.
6. **`NULL` rank ≠ rank 0.** "Checked, not found" and "never checked" are different facts.
7. **A visibly-degraded answer beats a plausibly-wrong one.** Every fallback here — worldwide geo, INR amounts, raising on missing rates, refusing to invent a conversion — takes that trade deliberately.
