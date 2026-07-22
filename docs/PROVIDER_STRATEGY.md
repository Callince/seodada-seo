# Provider strategy

Which upstream serves each module, what it costs, and what to change.

Grounded in **actual usage** from `usage_log` (1,030 calls, 419 cached, 1,312.87¢
= $13.13 spent) and in live cost/parity probes against the APIs themselves — not
in list prices or docs.

---

## 1. Where the money actually goes

Top lines by spend, with cost per *live* (uncached) call:

| endpoint | live calls | cache hit | ¢ / live call | total ¢ | % spend |
|---|---:|---:|---:|---:|---:|
| **keywords.search_volume** | 56 | 48% | **8.68** | **486.00** | **37.0%** |
| serp.organic | 93 | 48% | 1.41 | 130.70 | 10.0% |
| domains.history | 7 | 0% | 12.96 | 90.72 | 6.9% |
| domains.whois | 5 | 17% | 12.02 | 60.12 | 4.6% |
| backlinks.* (9 endpoints) | ~86 | ~45% | 2.0–2.8 | ~187 | 14.3% |
| ai_visibility.mentions | 4 | 50% | 10.00 | 40.00 | 3.0% |
| labs.* (6 endpoints) | ~120 | ~50% | 1.0–1.6 | ~139 | 10.6% |
| content.* (4 endpoints) | ~40 | ~15% | 2.00 | ~90 | 6.9% |
| onpage.* (6 endpoints) | ~120 | ~40% | **0.015** | ~0 | **0.0%** |

Three things fall out of this immediately:

1. **One endpoint is 37% of all spend**, and its per-call cost (8.68¢) is **6×
   the next-highest** — `search_volume` is flat-rated per call regardless of how
   many keywords you send.
2. **SERP is already cheap** — 1.41¢/call, 10% of spend across the most-used
   endpoint in the app (178 calls).
3. **The local/free paths are working.** `onpage.*` is effectively free
   (0.015¢ — DataForSEO's `instant_pages` really is that cheap), and trends
   moved to free Google this month.

---

## 2. Current assignment

| module | provider | ¢/call | status |
|---|---|---|---|
| SERP | DataForSEO | 1.41 | keep — see §4.1 |
| On-page | DataForSEO | 0.015 | keep — already negligible |
| **Trends** | **Google (free)** | **0** | switched; was 1.03¢ |
| Content | DataForSEO | 2.00 | optional — see §4.3 |
| Keywords volume | DataForSEO google_ads | **8.68** | **change — §3** |
| Domain authority | OpenPageRank (free) | 0 | configured, working |

Free alternatives are wired for content (VADER), trends (Google) and domain
authority (OpenPageRank). **SERP has none** — Brave was the only candidate and it
was removed once it stopped being free (§7.1).

---

## 3. The change — done

### `search_volume` moved from google_ads to Labs `keyword_overview`

Verified against both APIs on the same five keywords, same day:

| | `keywords_data/google_ads/search_volume` | `dataforseo_labs/google/keyword_overview` |
|---|---|---|
| cost | **9.00¢** | **1.26¢** |
| volumes | baseline | **identical on all 5** |
| monthly history | **12 months** | **92–93 months (~8 years)** |
| keyword difficulty | ✗ | ✓ |
| search intent | ✗ | ✓ |
| batch ceiling | ~1,000 | 700 |

**This is not just cheaper — it is strictly better data.** The Trends tab shows a
12-month window because that is all google_ads returns; Labs would give it eight
years of seasonality. Intent and difficulty come free, where today the app pays
a *separate* `labs.keyword_overview` call (17.86¢ historically) to get them.

**Impact:** 37% of spend × 86% saving ≈ **32% of total spend removed**, while the
product gets better. On the observed usage that is 486¢ → ~70¢.

**How it was done.** The swap is contained to `services/coalescer.py`. It calls
Labs, then flattens each nested item back into the flat google_ads row shape
(`_flatten`), so `kw.parse_volume_rows`, `kw.parse_search_volume`, the
`/keywords/volume` route and brand enrichment in `services/brand.py` are all
untouched. That also makes the cache backward-compatible: entries written by the
old provider are already in that shape and keep parsing correctly until their TTL
expires.

`keywords_data/google_ads/search_volume` is deleted, not left as a fallback — it
is the same vendor, so it does not survive an outage Labs would not.

Measured through the real code path (two concurrent waiters, one coalesced call):
**1.236¢ against 9.000¢**, 93 months of history, shared keyword consistent across
both waiters.

**Three things this turned up that had to be handled:**

1. **Competition scale.** google_ads reports `competition_index` on 0–100, Labs
   reports `competition` on 0–1, and the table renders `"{competition}/100"`.
   Without the ×100 every keyword under 0.5 competition renders as "0/100".
   (Same conversion `labs.parse_keywords_overview` already makes.)
2. **The 700-keyword ceiling.** `keyword_overview` slices silently at 700, and
   while no single request comes close, the union across concurrent waiters can
   — waiters would have received a partial set with no error. The union is now
   chunked.
3. **A real billing bug the swap exposed.** The cost split used bare `round()`,
   which returns an *integer*. At 9¢ per call the distortion was small; at 1.2¢
   it charged one waiter 1.000¢ and another 0.236¢ for an equal share of the
   same call. Now split at 4dp with the remainder to the last waiter, so the
   attributed costs still sum to the real upstream cost exactly.

All three are pinned by tests in `backend/tests/test_coalescer.py` (11 tests),
each mutation-checked — reverting any of the three fixes fails a test.

**Not a parity failure:** Labs returns a null volume for keywords it has no data
on (e.g. "backlink checker"). Checked directly — google_ads returns null for the
same keywords. Parity holds.

---

## 4. Deliberate non-changes

### 4.1 Do **not** *replace* Google with Brave — add engines instead

This was written when Brave was free. **It is not any more** (§7.1), which makes
the case against substitution stronger, not weaker:

- **It costs more, not less.** Brave bills ~0.5¢ per search against DataForSEO's
  0.200¢ for Google or Bing. Swapping would *raise* SERP spend by 2.5×.
- **Different index.** Brave returns *Brave's* results. Data that answers a
  different question is not a substitute at any price.
- **A prepaid balance is a hard stop.** Once the $5 monthly credit is gone,
  requests 429 — a silent cap on the product's core feature.

The trends switch worked precisely because the data was *identical* and free
(DataForSEO relays Google Trends). Neither half of that holds here.

**What was built instead (§7):** engine as a *dimension*, not a swap. The user
picks which engines to crawl and sees rank-per-engine side by side. Brave was
briefly one of those options; once its pricing was checked properly it failed
the same test as substitution and was removed altogether (§7.1). **Bing** filled
the role instead — a genuinely different index at exactly Google's price.

### 4.2 Do **not** move on-page to local

`instant_pages` costs **0.015¢** — 580× cheaper than the search_volume call. The
local path exists and is good, but switching saves nothing measurable and gives
up DataForSEO's technical score. Keep the local path for the free public tools,
where it already runs.

### 4.3 Content → VADER is optional, and it is a product decision

`content.*` is ~90¢ (6.9%) at 2.00¢/call. The local VADER path is $0 and returns
the same response shape. But sentiment from a lexicon is not the same as
DataForSEO's model, and this powers a user-facing analysis. Worth a side-by-side
on real content before switching — this is a quality call, not an obvious win.

---

## 5. Cache, the second lever

Overall hit rate is **41%** (419/1,030). Every hit is a call that cost nothing,
so cache policy is worth as much as provider choice.

Endpoints with **0% hit rate** on real traffic:

| endpoint | live calls | ¢/call | note |
|---|---:|---:|---|
| domains.history | 7 | 12.96 | most expensive call in the app |
| backlinks.list | 15 | 2.80 | |
| backlinks.new_lost / history | 10 | 2.00 | |
| local.listings | 6 | 2.33 | |

These are low-volume today, so the absolute waste is small — but `domains.history`
at 12.96¢ with zero reuse is the one to watch. Its TTL (`domain_meta`, 7 days) is
already long; the misses are distinct domains, not repeats. **No change
recommended yet** — revisit when volume grows, and check whether the UI is
re-requesting with slightly different params (the cache key is params-sensitive,
so an unnormalized field would cause exactly this signature).

---

## 6. The strategy, stated plainly

**Principle: swap a provider only when the data is equivalent or better. Never
trade correctness for cost.**

That is the line the trends switch respected (identical data, faster, free) and
the line a Brave SERP switch would cross (different index).

**Tiers:**

| tier | rule | current members |
|---|---|---|
| **Free-first** | free source is equivalent or better; paid is fallback | trends (Google), domain authority (OpenPageRank), free public tools (local scraper) |
| **Cheapest-equivalent** | same data, pick the cheaper endpoint | search_volume → Labs (§3, done) |
| **Paid, no substitute** | correctness depends on this exact source | SERP (Google index), backlinks, domain history/whois |
| **Negligible** | too cheap to optimise | on-page (0.015¢) |

**Every switch must satisfy all four:**

1. **Parity proven on live data**, not documentation — same query, same day, same parser.
2. **Failure is loud.** A free source that fails must raise and fall back to paid, never return an empty result. (Google Trends 429s ~1 in 3 calls; the retry-then-fallback exists for exactly this.)
3. **Scale conversions checked.** Providers disagree about units — competition 0–1 vs 0–100, USD vs INR, minor vs major units. This has already caused one bug per boundary.
4. **Cost recorded either way.** A free provider still logs through `usage.metered` so the switch's effect is measurable in the same table this analysis came from.

**Order of work:**

1. ~~`search_volume` → Labs~~ — **done** (§3). ~32% of spend, better data.
2. ~~Wire Brave as a SERP fallback~~ — **dropped** (§7.1). It stopped being free; at 2.5× Google/Bing on a separate invoice it is not worth it. Bing was added instead, at the same price as Google.
3. **When volume grows** — re-run this analysis. The right target changes as usage shifts; today's 37% line item may not be next quarter's.
4. **Evaluate** — content → VADER, side by side on real content, as a quality decision.
5. **Before adding any non-DataForSEO paid provider** — add a `provider` column to `usage_log` first. Without it, `month_to_date_cents` sums every row and the admin's DataForSEO figure silently absorbs another vendor's spend.

**Verifying #1 landed.** `keywords.search_volume` keeps its endpoint label in
`usage_log` on purpose — renaming it would split the series and make before/after
incomparable. Re-run the query below: cost-per-live-call on that row should fall
from 8.68¢ toward ~1.3¢ as new calls accumulate.

---

## 7. Multi-engine SERP ranking

Which engines DataForSEO can actually serve, probed live rather than read off a
price list:

| engine | path | cost @ depth 10 | organic | SERP features |
|---|---|---:|---:|---|
| Google | `/serp/google/organic/live/advanced` | 0.200¢ | 8 | AI Overview, PAA, video, related |
| **Bing** | `/serp/bing/organic/live/advanced` | **0.200¢** | 10 | **organic only** |
| Yahoo | `/serp/yahoo/organic/live/advanced` | 0.350¢ | 10 | organic only |
| Brave | — (own API) | ~0.5¢ — **dropped, see §7.1** | 20 max | organic only |
| DuckDuckGo | — | — | — | **`40402 Invalid Path`** |

Brave and DuckDuckGo both return **`40402 Invalid Path`** from DataForSEO; only
Brave has a usable direct API, priced as in §7.1 — which is why it is no longer
offered.

**The picker ships Google + Bing.** Yahoo works and the API supports it, but it
is 75% dearer for markedly less search share, so it is not exposed either.

Bing costs exactly what Google costs, takes an identical payload (device, depth
and non-US `location_code` all verified), and `parse_organic` consumes it with no
changes at all. Yahoo works too and is supported by the API, but is not offered
in the UI.

**Brave is not on DataForSEO**, and its own API is no longer free, so it was
removed from the codebase entirely (§7.1).

### 7.1 Brave is no longer free — corrected 2026-07-22

The original build treated Brave as the free engine. That is out of date, and the
correction matters because it inverts the reason to pick it. Verified against
brave.com/search/api:

| | old assumption | actual |
|---|---|---|
| price | free | **$5 per 1,000 requests** (~0.5¢ each) |
| card required | no | **yes** — the standalone free tier is retired |
| free allowance | ~2,000/month | **$5/month credit** ≈ 1,000 searches |
| rate limit | 1 req/sec | **50 queries/sec** (Search plan) |

**Decision: Brave was removed from the SERP engine picker.** At 2.5× Google or
Bing, requiring a card, and billing on an invoice the cost engine cannot see, it
failed the §6 test — a provider is only worth adding when the data is equivalent
or better *and* the cost is justified. Its independent index is real, but not at
that price for this product.

Brave was removed from the application entirely, not merely hidden:

| removed | detail |
|---|---|
| `integrations/free/brave.py` | deleted |
| `SERP_PROVIDER` setting | gone — SERP had no other alternative provider |
| `BRAVE_API_KEY` setting | gone |
| `providers.serp_provider()` | gone; `active()["serp"]` is now the constant `"dataforseo"` |
| Brave branches | collapsed in `serp.py`, `content.py`, `rank.py`, `competitive.py`, `rank_watch.py` |
| `Engine` / `SearchEngine` literals | now `google \| bing \| yahoo` |
| tests | Brave provider + engine tests removed; conftest no longer pins the key |

Two details worth keeping in mind:

- **The `"provider"` cache-key entry was kept as the literal `"dataforseo"`** in
  the four collapsed call sites. It is a constant now, but dropping it would
  change every `params_hash` and invalidate the whole SERP cache, re-billing
  calls that were already paid for. One dead word is cheaper than that.
- **Removing Brave also removed a cost-reporting hazard.** Brave billed on its
  own invoice, so `brave.organic()` reported `cost_cents=0` and its spend never
  reached `usage_log` — while `month_to_date_cents` sums every row with no
  provider filter, which is what the admin presents as DataForSEO spend. The
  hazard returns the moment any non-DataForSEO *paid* provider is added; do the
  `provider` column first (order of work, item 5).

**Design:** engine is a request field (`engines: ["google","bing"]`), defaulting
to Google alone so an unchanged request costs exactly what it did before. Engines
run concurrently behind one quota check, each with its own `usage_log` label
(Google keeps `serp.organic` so its cost history stays one series). The response
folds them into `comparison` — one row per **URL**, with that URL's rank on each
engine.

**Keyed by URL, not domain**, because a domain can hold several slots on one SERP
and merging them would report a rank it does not hold. An engine missing from a
row's `ranks` means "not in the top N that engine returned" — deliberately
distinct from a bad rank, and rendered as "—" rather than a number.

**Live result** for "best running shoes", US, depth 10 — the reason this feature
is worth having:

```
                          GOOGLE   BING
www.runnersworld.com           1      1     ← ranked by both
www.reddit.com                 2      —
www.wired.com                  —      2
runrepeat.com                  3      —
www.outdoorgearlab.com         —      3
…
16 URLs total — exactly 1 ranked by both engines
```

The two SERPs are almost disjoint. That is normal (separate indexes), and it is
precisely what a single-engine tool cannot show you.

**Cost is linear in engines chosen** — Google+Bing is 0.4¢/keyword against 0.2¢.
The UI states this before the run and defaults to one engine.

---

**How to re-run this analysis:**

```sql
SELECT endpoint,
       COUNT(*)                                    AS calls,
       SUM(CASE WHEN from_cache THEN 1 ELSE 0 END) AS cached,
       ROUND(SUM(cost_cents), 2)                   AS cents,
       ROUND(SUM(cost_cents) / NULLIF(COUNT(*) - SUM(CASE WHEN from_cache THEN 1 ELSE 0 END), 0), 2) AS cents_per_live
FROM usage_log
GROUP BY endpoint
ORDER BY cents DESC;
```

The whole point of routing every billed call through `usage.metered` is that this
query is always available and always true. Decide from it, not from list prices.
