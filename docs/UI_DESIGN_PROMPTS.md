# FourDM SEO Platform — UI/UX Design Prompt System

A ready-to-use prompt kit for redesigning the app to a **modern, futuristic,
gallery-grade** look that stays **effortlessly usable and accessible**. Every
prompt here is grounded in the real stack (React 19 + Vite + TypeScript,
Tailwind with CSS-variable tokens, Recharts, framer-motion) so you can paste it
straight into a UI generator (v0 / Lovable / Figma Make) **or** hand it to a
coding agent working in this repo.

> **North star:** data is the hero; futurism is the frame, not the noise.
> Restrained sci-fi — glass, aurora glow, a whisper of grid — never neon soup.
> One "wow" moment per screen. If a first-time user hesitates for a second,
> the design failed, no matter how beautiful.

---

## 0. How to use this kit

1. **Always prepend [§1 Master Design Language](#1-master-design-language).** It is
   the system prompt — it locks the brand, tokens, motion, and accessibility
   rules so pages never drift.
2. Append the **[per-page prompt](#3-per-page-prompts)** you want.
3. If the page uses a shared block (stat card, table, gauge, form), also pull the
   matching **[§2 building block](#2-shared-building-block-prompts)** so the
   generator reuses the pattern instead of reinventing it.

---

## 1. Master Design Language

> **ROLE:** You are a senior product designer + front-end engineer building the
> FourDM SEO intelligence app — a premium, multi-tenant SaaS. Produce a UI that
> looks like it belongs in a design-award gallery yet reads instantly to a busy
> marketer. Modern, futuristic, confident, quietly luxurious. Never trendy-for-
> trendy's-sake, never cluttered.
>
> **BRAND & TOKENS — use these, never hardcode hex.** All color comes from CSS
> variables (light + dark both defined in `src/index.css`), surfaced through
> Tailwind utilities. Palette is a navy → ocean-blue → cyan brand system.
> - Surfaces: `bg-app-bg` (canvas), `bg-surface`, `bg-surface-2`; borders `border-border`.
> - Text: `text-text`, `text-text-muted`.
> - Brand: `text-primary`/`bg-primary`, `bg-primary-soft`, `accent`; states `success`, `warning`, `danger`, `info`.
> - Focus ring: `ring-ring` (token `--ring`). Gradients: `.gradient-text`, `.gradient-fill`, `--grad-a/b/c`.
> - Ready-made effects in `index.css`: `.glass-card`, `.app-canvas`, `.aurora-bg`,
>   `.cyber-grid`, `.dot-grid`, `.spotlight`, `.lp-shadow`, `.lp-shadow-lg`,
>   `.lp-card` (hover lift), `.gradient-text-anim`, `.blur-in`, `.animate-fade-rise`.
>   Prefer composing these over inventing new CSS.
>
> **CORNERS — partly rounded, calm, NOT pill-like.** Radius scale is
> `md 8px · lg 12px · xl 14px · 2xl 16px`. Cards/containers use `rounded-2xl`
> (16px). Inputs/buttons `rounded-xl`/`rounded-lg`. Reserve `rounded-full` for
> avatars, badges, and icon chips only. Never round a large container past 16px.
>
> **ELEVATION.** Depth comes from soft, layered shadows (`.lp-shadow`,
> `shadow-md`, `.lp-shadow-lg`) + hairline borders + glass, not heavy drop
> shadows. Hovering an interactive card lifts it 4–6px (`.lp-card`).
>
> **LAYOUT.** 8px spacing grid; generous whitespace. Max content width 1440px
> (already set in AppShell). Every module page opens with a **page header**
> (title + one-line purpose + primary action) then a **bento/asymmetric grid** of
> cards — scorecards on top, detail below. Responsive: 1 col mobile → 2 → 3/4 on
> wide. Tables scroll inside their own container; the page never scrolls sideways.
>
> **MOTION (framer-motion + the CSS anims above).** Buttery, purposeful, cheap.
> Page enters with a 200ms fade-rise (already wired per route). Cards stagger-
> reveal with `.blur-in`. Numbers count up on first paint. Charts draw on
> (`.lp-draw`) / bars grow (`.lp-bar`). Hover = spotlight glow + lift. Nothing
> loops forever in the work area (save perpetual motion for hero/marketing).
> **Honor `prefers-reduced-motion`** (already globally dampened).
>
> **DATA VISUALS (Recharts).** Charts are first-class citizens, not afterthoughts.
> Series colors come from tokens (`--primary`, `--accent`, `--grad-*`, state
> colors); grid lines are faint `border`; tooltips are glass cards. Provide
> sparklines in stat cards, a radial `ScoreGauge` for 0–100 scores, area/line for
> trends, and horizontal bars for rankings. Always label axes and give a legend.
>
> **ACCESSIBILITY (WCAG 2.1 AA — non-negotiable).** Text contrast ≥ 4.5:1 (≥3:1
> large); never encode meaning in color alone (pair with icon/label). Visible
> focus ring on every interactive element (`focus-visible:ring-2 ring-ring`).
> Full keyboard operability; logical tab order; ⌘K palette reachable. Touch
> targets ≥ 44px. Semantic HTML + ARIA for tabs, dialogs, tables, live regions
> (toast + async results announce). Respect reduced motion. Dark mode must be as
> polished as light — verify both.
>
> **COMPONENT CONTRACT — reuse, don't reinvent.** Build from the existing
> primitives: `Card`/`CardHeader`/`CardTitle`/`CardBody`, `Button` (has loading
> state), `Input`, `Select`, `Badge`, `Skeleton`, `Tabs`, `Toaster`, and the
> shared blocks `StatCard`, `DataTable` (sortable + CSV), `ScoreGauge`,
> `TrendChart`, `AuthorityBadge`, `MetricBar`, `CacheBadge`, `SaveToProject`,
> `AiAdvisor`, `LocationLanguagePicker`, `PAAList`, `KeywordTable`. New visual
> ideas should extend these, not fork them.
>
> **EVERY DATA VIEW HAS FOUR STATES:** loading (skeleton that matches final
> layout, never a spinner-on-blank), empty (friendly illustration + one-line
> guidance + the action that fills it), error (plain-language message from the
> RFC-7807 `detail`, plus retry), and success. Results carry a **cache/live
> badge** (`from_cache`, `cost_cents`). When the daily analysis limit is hit
> (HTTP 402), show a graceful upsell that links to Billing — never a dead end.

---

## 2. Shared building-block prompts

Paste alongside a page prompt when the page uses the block.

**Page header** — `Sticky-friendly header row: gradient-tinted eyebrow icon,
H1 title (18–20px, font-semibold, tracking-tight), muted one-line description,
and a right-aligned primary action (Run/Generate/Track). On analysis pages, the
search/params form lives directly under the header in a glass Card.`

**StatCard** — `Compact glass card: small uppercase muted label, a big
count-up metric (tabular-nums), a delta chip (green ▲ / red ▼ with icon, not
color alone), and an inline sparkline. Optional accent left-border or icon chip.
Hover lifts with a spotlight glow. Used in bento rows of 3–5.`

**DataTable** — `Dense but breathable table: sticky header, zebra-free rows with
hairline dividers, sortable columns (aria-sort), numeric columns right-aligned
tabular-nums, sticky first column on overflow, row hover highlight, and a
toolbar with search + CSV export. Wrap in overflow-x-auto. Pagination or
"load more" for long lists. Skeleton rows while loading.`

**ScoreGauge** — `Radial 0–100 gauge: animated arc that draws on, color ramps
red→amber→green by value (with a numeric label so it's not color-only), subtle
inner glow at high scores. Center shows the number + a tiny qualitative label
(Poor/Fair/Good/Excellent).`

**Analysis form** — `Glass Card with the query inputs (keyword/domain/URL),
a LocationLanguagePicker, advanced options in a collapsible row, a "Live"
toggle (bypass cache, billed), and a primary Button with loading state.
Validate inline; disable submit until valid; remember last-used market.`

**Empty / error / loading** — see the four-states rule in §1. Use `Skeleton`
shaped like the real content; empty states get a lightweight line-art glyph and
a single clear CTA.

---

## 3. Per-page prompts

Grouped by the sidebar's real workflow: **Overview → Research → Audit →
Optimize → Track → Manage → Free tools.**

### Overview

**Dashboard** (`/dashboard`)
> Design the command-center landing. A welcoming hero strip (greeting + the
> user's org, on an `.aurora-bg`/`.cyber-grid` backdrop) with a prominent quick
> SERP search. Below, a **bento grid**: quick-action tiles into All-in-One and
> Site Report; a "Data sources" panel showing which provider backs each module
> (premium DataForSEO vs. free) as status chips; a "Recent projects" list to
> resume work; and an at-a-glance usage/quota meter (analyses used today vs.
> daily limit) with a subtle upsell when near the cap. Make it feel alive and
> personal without burying the primary search.

**All-in-One / Workspace** (`/workspace`)
> The flagship single-page analysis. One hero form (keyword + domain + market +
> "Run full analysis"). On submit, a cinematic staggered reveal of an
> asymmetric bento: (1) a row of bento **scorecards** (health gauge, organic
> keywords, traffic value, keyword rank, pages analyzed) with count-ups; (2) the
> **AI SEO Advisor** card (prominent, gradient-edged); (3) findings &
> recommendations; (4) SERP + People-Also-Ask; (5) keyword metrics + 12-month
> trend chart; (6) content sentiment; (7) Google Trends; (8) top pages / ranked
> keywords / competitors tabs. Each section loads independently with its own
> skeleton — a hiccup in one never blocks the rest. This page should make people
> screenshot it.

### 1 · Research

**Keyword Research** (`/keywords`)
> Header + form (keyword + market). Results: scorecards for Volume / CPC /
> Competition, a 12-month search-volume area chart, and a **Google Trends** line
> with period filters (today/7d/30d/12m/5y). Tabbed suggestion tables (long-tail,
> related, ideas) — all sortable, CSV-exportable. A "Bulk analysis" mode: paste
> up to 100 keywords → one metrics table. Trends and suggestions should feel
> exploratory and fast.

**SERP Ranking** (`/serp`)
> Header + form (keyword + market + depth 10/20/50/100 + Live toggle). A ranked
> results table (position, clickable title, brand + brand search volume, URL,
> description) with sort + CSV + Save-to-project. Below, a **People Also Ask**
> accordion. Show the cache/live badge and the exact result depth. Make position
> #1–3 visually special (subtle medal accent).

**Domain Analytics** (`/domains`)
> Opens with a **Domain Authority strip**: a 0–100 authority ring + backlinks,
> referring domains, dofollow counts. Then an overview (organic/paid keywords,
> traffic value), every ranked keyword (table), plus WHOIS, detected
> technologies (as logo/name chips), and a rank-history chart. Link out to
> Competitors for head-to-head.

**Competitors** (`/competitors`)
> Head-to-head layout: your domain vs. a rival as two mirrored columns of
> authority rings + organic keywords + traffic value, with a connecting "gap"
> visual between them. A **keyword-gap** table (keywords they rank for that you
> don't, their position vs. yours), CSV-exportable. Unranked/misspelled domains
> get a clear inline warning card, not silent dashes.

**Local SEO** (`/local`)
> Search Google business listings by query + location. Results as rich cards
> (name, category, rating stars, review count, address, phone, hours) in a
> responsive grid, optionally beside a map-style panel. Sort by rating/reviews.

### 2 · Audit

**Site Audit** (`/audit`)
> A full-site technical crawl. Start form (domain + pages 5–200) → an animated
> **live progress** state (crawler ticking through pages, page counter, elapsed).
> On finish: a site-health `ScoreGauge`, three severity tiles (Errors / Warnings
> / Notices with counts), a severity-sorted **issues table** (issue, severity,
> pages affected), and a crawled-pages table sorted worst-first with per-page
> failed checks. Progress must feel reassuring for a 1–3 min job.

**On-Page** (`/onpage`)
> URL form (bare domains auto-prefixed) + optional keyword. Summary scorecards,
> then tabs: content-score breakdown, readability, a pixel-accurate **Google
> snippet preview**, image/alt audit, indexability checks, keyword placement, and
> a competitive benchmark vs. top-ranking pages. Add a Lighthouse performance
> panel. The snippet preview is a signature detail — make it crisp.

### 3 · Optimize

**Content Analysis** (`/content`)
> For a keyword/brand: a sentiment gauge + emotional-connotation mix
> (positive/neutral/negative as a stacked bar or donut with labels), phrase
> trends, and a top-citations list (who's talking about it) as source cards.

**Site Report** (`/report`)
> The client-ready composite audit. Header form (domain + optional keyword +
> Live). A **bento header**: health gauge, organic keywords, traffic value, rank,
> pages analyzed — with an N/A "site blocked crawling" state handled gracefully.
> A prominent **AI SEO Advisor** action card; key findings + recommendations;
> tabbed tables (top pages w/ per-page scores & issues, ranked keywords,
> competitors). A **Print/PDF** mode with a clean print stylesheet, plus
> Save-to-project and a **Schedule** dialog (daily/weekly/monthly + email).

### 4 · Track

**Rank Tracking** (`/rank`)
> Track a domain + keyword pair. A tracked-pairs table (keyword, domain, latest
> position, ▲/▼ delta) and, per pair, a **position-history line chart** (note:
> a lower line = better rank — invert the axis and label it clearly). Add a
> "track new" form and optional alert-threshold setting.

**Backlinks** (`/backlinks`)
> Link-profile dashboard: authority ring, total backlinks, referring domains,
> dofollow split, new/lost, spam score — then tabs for strongest backlinks,
> referring domains, anchor texts, and a competitor **link gap**. If the
> DataForSEO Backlinks subscription is inactive (403), show a clean "activate"
> explainer instead of an error.

**AI Visibility** (`/ai-visibility`)
> The most futuristic page — lean into it (tasteful glow + grid). Check whether a
> domain is **cited in Google's AI Overview / AI Mode**: a query form → job
> progress → a verdict card (cited / not cited, with the citing answer excerpt).
> Plus panels for LLM mention metrics, AI keyword search volume, and an "ask an
> LLM" box that shows the model's response. This is where "the UI is art" should
> peak — without hurting clarity.

**Schedules** (`/schedules`)
> Manage recurring Site Reports. A table of schedules (project, frequency,
> next/last run, last status as a colored+iconed chip, email recipient) with
> Run-now, pause (active toggle), and delete. Empty state points users to create
> one from the Site Report page. Show the next-run countdown warmly.

### 5 · Manage

**Projects** (`/projects`)
> Workspace list: project cards (name, type, run count, last updated) in a grid,
> plus a create-project action. Cursor-paginated. Clicking opens the detail.

**Project Detail** (`/projects/:id`)
> A project's saved runs as a timeline/table (module, params, date) — each row
> reopens the exact snapshot instantly ($0), rendered via SavedRunView. Header
> shows project name + type + a "these reopen free" reassurance.

**Billing** (`/billing`)
> Plan & usage center: current plan + daily-analysis usage meter; a **plans**
> comparison (tiers, price in ₹, daily limits, features) with a clear upgrade CTA
> that runs **Razorpay checkout**; a payments table with downloadable **GST
> invoices (PDF)**; and a stored billing address / GSTIN form. Make upgrading
> feel like an easy, confident yes — not a paywall.

### Free tools ($0, instant)

**All Tools hub** (`/tools`)
> A gallery of the six local analyzers as inviting tiles (icon, name, one-liner,
> "no cost / instant" badge). Bento layout; hover spotlight. Positions these as
> quick utilities available any time.

**URL / Keyword / Heading / Image / Meta / Sitemap Analysis** (`/tools/*`)
> One consistent analyzer template reused across all six: a single input (URL, or
> URL+keyword for the keyword tool), instant in-process result, and a focused
> result panel tailored to the tool — URL: full page summary; Keyword: placement
> & density; Heading: H1–H6 outline tree; Image: image/alt audit grid; Meta:
> title/description/robots with pixel-length meters; Sitemap: a crawl of listed
> pages (Sitemap tool also has a node-graph visualization — make it a delightful,
> zoomable network diagram). Keep them fast, single-purpose, and clearly free.

---

## 4. Global chrome

**Sidebar** — `Collapsible rail grouped by the numbered workflow (Overview,
1·Research, 2·Audit, 3·Optimize, 4·Track, 5·Manage, Free tools). Section
headers read as connected process steps (a subtle vertical connector line).
Active item gets a gradient/primary highlight + left indicator. Icons from
lucide. Collapsed mode shows icons with tooltips. Admin entries only for admins.`

**TopBar** — `Slim glass bar: mobile menu button, breadcrumb/page title, a
⌘K command-palette trigger (show the shortcut hint), theme toggle (animated
sun/moon), and a user avatar menu (org, settings, logout). Sticky, translucent
over scrolling content.`

**Command Palette (⌘K)** — `Centered glass modal with fuzzy search over every
nav destination plus a quick SERP search. Keyboard-first (arrows + enter),
grouped results, recent items. The fastest way around the app.`

**AI SEO Advisor card** — `A standout gradient-edged card that turns analysis
data into a prioritized action plan: a short executive summary + specific
suggestions tagged HIGH/MEDIUM/LOW (icon + label, not color alone). "Get AI
suggestions" / "Regenerate" buttons with a thoughtful generating animation.
Graceful 503 when no AI provider is configured.`

---

### One-paragraph version (if a tool wants a single master prompt)

> Redesign the FourDM SEO app as a modern, futuristic, gallery-grade SaaS that
> stays instantly usable. Navy→ocean→cyan brand via CSS-variable tokens (light +
> dark, no hardcoded hex); glassmorphism surfaces on a soft aurora canvas with a
> whisper of cyber-grid; **partly-rounded corners (16px cards, never pill-like)**;
> soft layered shadows; buttery framer-motion (fade-rise, blur-in stagger,
> count-ups, draw-on charts, hover spotlight-lift) that respects reduced motion.
> Data is the hero — Recharts trends, radial 0–100 gauges, sparkline stat cards,
> ranking bars, all token-colored. Reuse the existing Card/Button/DataTable/
> StatCard/ScoreGauge/AiAdvisor primitives. Every view has loading (matching
> skeleton), empty (friendly CTA), and error (plain-language + retry) states and
> a cache/live badge. WCAG 2.1 AA throughout: 4.5:1 contrast, visible focus
> rings, full keyboard support, 44px targets, meaning never by color alone,
> flawless dark mode. Make people want to screenshot it — without ever making
> them think.
