# User Guide

Everything you can do in the FourDM SEO platform, page by page.

**Live app:** https://seo.fourdm.services

---

## Getting started

### Sign in / register
- **Register** creates your account *and* your organization (you become its owner).
  When email is configured, registration sends a 6-digit code you confirm before
  the account activates; otherwise it's instant.
- **Login** with email + password, or **Sign in with Google**. Sessions use JWT
  tokens that auto-refresh; use the avatar menu (top-right) to log out.
- **Forgot password?** Request a reset link from the login page.
- Dark mode: moon/sun toggle in the top bar. Your choice is remembered.

### Finding your way around
- **Sidebar** (collapsible via the bottom toggle) lists every module.
- **⌘K / Ctrl+K** opens the command palette — jump to any page or run a quick
  SERP search by typing a keyword.
- **Cached / live badge:** most results show a small badge. **cached** means the
  result was served from the platform's cache instantly; **live** means a fresh
  upstream lookup was made.
- **Daily limit:** free accounts get a set number of live analyses per day
  (paid plans raise it). Cached repeats never count. When you hit the limit the
  app tells you and points to **Billing**.

---

## Dashboard

Your landing page:
- **Quick SERP search** — type a keyword, press Search, and you land on SERP
  Ranking with results loading.
- **Quick actions** — one-click tiles into All-in-One and Site Report.
- **Data sources** — which provider backs each module (DataForSEO premium vs.
  free sources).
- **Recent projects** — jump back into saved work.

---

## All-in-One / Workspace (the single-page analysis)

Enter **one keyword + one domain**, pick a market, press **Run full analysis**.
Every tool runs at once and renders on the same page:

1. **Bento scorecards** — site health gauge, organic keywords, traffic value,
   rank for your keyword, pages analyzed.
2. **AI SEO Advisor** — press *Get AI suggestions* for a prioritized action plan
   (see [AI SEO Advisor](#ai-seo-advisor)).
3. Key findings & recommendations.
4. SERP results + People Also Ask.
5. Keyword metrics (volume, CPC, competition) + 12-month trend chart.
6. Content sentiment.
7. Google Trends.
8. Top pages, ranked keywords, competitors.

Each section loads independently — if one data source hiccups, the rest of the
page still fills in. Repeat runs for the same keyword + domain come largely from
cache and are much faster.

## SERP Ranking

- Keyword + market + **depth** (Top 10 / 20 / 50 / 100 results) + a **Live**
  checkbox that bypasses the cache and fetches fresh (billed) data.
- This page is the single home of **People Also Ask**.
- Results table: position, title (clickable), brand, brand search volume, URL,
  description. Sortable columns; **CSV** export button above the table.
- **Save to project** stores this exact result for $0 reopening later.

## Keyword Research

- Volume, CPC, competition scorecards, 12-month search-volume trend.
- **Google Trends** chart with period filters (today, this week, last month,
  this year, etc.).
- Suggestion tabs: long-tail suggestions, related keywords, keyword ideas — all
  with volume data, sortable, CSV-exportable.
- **Bulk keyword analysis** — paste up to 100 keywords (one per line or
  comma-separated) and get volume / CPC / competition for all of them in one
  call, with CSV export.

## Domain Analytics

- Opens with a **Domain Authority strip** — a 0–100 authority ring plus
  backlinks, referring domains, and dofollow counts.
- Domain overview (organic/paid keywords, estimated traffic value) and every
  ranked keyword, plus WHOIS, detected technologies, and rank history.
- Competitor comparison and the keyword gap live on the **Competitors** page
  (linked from the form).

## Backlinks

- Enter any domain for its **link profile**: authority ring, total backlinks,
  referring domains, dofollow split, new/lost links, spam score — plus tabs for
  the strongest backlinks, referring domains, **anchor texts**, and a
  competitor **link gap**.
- Requires the DataForSEO **Backlinks subscription** (app.dataforseo.com →
  Plans & Subscriptions); the page tells you if it isn't active yet.

## Local

- Search **Google business listings** for a query + location: name, category,
  rating, reviews, address, and contact details.

## Competitors

- Your domain vs. a rival, head-to-head: authority rings, organic keywords, and
  traffic value side by side.
- **Keyword gap** — keywords the competitor ranks for that you don't (their
  position vs. yours), CSV-exportable.
- Also lists your wider competitor set. A misspelled or unranked domain gets a
  clear warning on its card instead of silent dashes.

## On-Page

- Enter a URL (bare domains are fine — `https://` is added automatically).
- Summary scorecards + tabbed detail: content score breakdown, readability,
  Google snippet pixel-preview, image/alt audit, indexability checks, keyword
  placement, and a competitive benchmark vs. the top-ranking pages.
- A **Lighthouse** performance report is available for the URL.

## Content Analysis

- Sentiment and emotional connotation mix for a keyword/brand across the web,
  plus top citations (who's talking about it) and phrase trends.

## Rank Tracking

- **Track** a domain + keyword pair; each check records the current Google
  position.
- History chart shows movement over time with up/down deltas. Optional daily
  auto-checks alert you when a tracked keyword moves past a threshold.

## Site Report

The one-click composite audit:

- Enter a domain (keyword optional but recommended), press **Generate report**.
- **Bento header:** health gauge (average on-page score of the site's most
  valuable pages), organic keywords, traffic value, rank, pages analyzed.
  - If the gauge shows **N/A — "site blocked crawling"**, the target site
    rejects automated page fetches; API-based metrics still populate.
- **AI SEO Advisor** card — one click for an AI action plan built from this report.
- Key findings + recommendations.
- Tabbed tables: top pages (with per-page scores & issues), ranked keywords,
  competitors.
- **Print / PDF** button produces a clean printable report.
- **Save to project** and **schedule** it (below) for recurring runs. The
  page has a **Live** checkbox to force fresh (billed) data.

## Site Audit

- **Full-site technical crawl**: pick 5–200 pages and start the audit; a
  progress bar tracks the crawler.
- Results: site-health gauge, **Errors / Warnings / Notices** severity tiles,
  a severity-sorted issues table (pages affected per issue), and a crawled
  pages table sorted worst-first with per-page failed checks.
- Costs a few cents per crawl (billed per page requested).

## AI Visibility

- Check whether a domain is **cited by Google's AI Overview / AI Mode** for your
  target queries — start a check and poll for the result.
- Also surfaces LLM **mention** metrics, AI keyword search **volume**, and lets
  you **ask** an LLM a question and inspect the response.

## Tools (local, $0)

Six lightweight, in-process analyzers that never hit a billed API:

- **URL** — full single-page analysis. **Keyword** — placement/usage in a page.
- **Heading** — heading structure. **Image** — image/alt audit.
- **Meta** — title/description/robots. **Sitemap** — crawl a sitemap and
  analyze the pages it lists.

## Schedules

Automate Site Reports:

- Create a schedule from the **Site Report** page (frequency daily / weekly /
  monthly + optional email recipient); the **Schedules** page is the single
  place to list, run-now, and delete them.
- Each run saves the report to the project (reopenable at $0) and — if email is
  configured — sends a summary email including **findings, recommendations, and
  the AI action plan**.
- The Schedules page lists every schedule with next/last run; **Run now**
  triggers immediately; delete stops it.

## Projects

- Create projects to organize work (e.g. one per client or site).
- Any result page has **Save to project**; saved runs reopen instantly and never
  re-bill — they're snapshots.
- A project page lists its runs with module, parameters, and date.

## Billing

- **Plans** — compare tiers and their daily analysis limits.
- **Checkout** runs through Razorpay; on success your subscription activates
  immediately and your daily limit rises.
- **Invoices** — download GST invoices (PDF) for any payment. Your billing
  address / GSTIN is stored once and reused.

---

## AI SEO Advisor

The Advisor turns analysis data into a **prioritized action plan**: a short
executive summary plus specific suggestions, each tagged HIGH / MEDIUM / LOW
priority.

- Where: **All-in-One**, **Site Report**, and **scheduled report emails**.
- Click **Get AI suggestions** after an analysis has loaded; **Regenerate** asks
  again with the same data.
- Powered by Google Gemini's free tier by default (no per-use cost). If you see
  *"model is experiencing high demand"*, that's the free tier momentarily
  throttling — try again in a few seconds.

---

## Admin (platform admins only)

Visible only to emails listed in the `ADMIN_EMAILS` setting; sign in at
`/admin`. What each admin can see is governed by their **RBAC permissions**.

- **Users** — every user across all organizations, biggest API spender first:
  spend this month / all-time, API call count, last active, org, role, joined
  date. Sortable + CSV export. Create users, edit (name, role, org, reset
  password, active toggle — you can't deactivate your own account), and assign
  admin **roles/permissions**.
- **Plans & subscriptions** — create/edit plans, grant or extend subscriptions.
- **Payments** — view payments, mark/refund, download invoices.
- **Website settings** — company name, support email, logo, social links for the
  public site.
- **Content** — a blog CMS (categories + rich-text posts with images) and web
  stories.
- **Contact submissions** — the public contact-form inbox: read, reply, export.
- **Email logs** — every email the platform sent, with status and retry.
- **Usage history** — platform-wide billed/cached call history, exportable.

---

## The public site

Signed-out visitors get a marketing site on the same domain: landing, features,
pricing, about, help, contact form, a blog, web stories, guides, and the
legal pages (privacy / terms / cookies).

---

## Tips

- **Costs:** live DataForSEO lookups cost fractions of a cent; cached repeats are
  free and don't count against your daily limit.
- **Same query twice?** The second run is instant and free — the cache holds
  SERP results ~6h, search volume ~3 days, Labs/keyword analytics ~2 days.
- **Printing:** Site Report is print-optimized — use Print / PDF for client-ready
  output.
