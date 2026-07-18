# FourDM SEO Platform — UI/UX Design Prompt System

A ready-to-use prompt kit for designing **every screen in the product** to a
modern, futuristic, gallery-grade look that stays **effortlessly usable**. Every
prompt is grounded in the real stack (React 19 + Vite + TypeScript, Tailwind with
CSS-variable tokens, Recharts, framer-motion) and the real routes, so you can
paste it into a UI generator (v0 / Lovable / Figma Make) **or** hand it to a
coding agent working in this repo.

> **North star — two rules, equal weight:**
> **1. Data is the hero.** Futurism is the frame, not the noise. Restrained
> sci-fi — glass, aurora glow, a whisper of grid — never neon soup. One "wow"
> moment per screen.
> **2. The user must never wonder what to do next.** A beautiful screen that
> leaves someone stranded is a failed screen. Every result ends by offering the
> next move. If a first-time user hesitates for a second, the design failed, no
> matter how good it looks.

**Coverage:** 25 app pages · 15 public pages · 5 auth pages · 18 admin pages.

> **Governed by [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) (Aperture).** That
> document is the element-level law — color (OKLCH), type, space, strata,
> motion, and the exact HTML/CSS of every primitive. This document says *what
> each page does*; Aperture says *what everything is made of*. **Where the two
> disagree, Aperture wins.** Prepend it, or at minimum §1 (Color) and §6
> (Elements), to any prompt that will produce actual markup.

---

## 0. How to use this kit

1. **Always prepend [§1 Master Design Language](#1-master-design-language)** — it
   locks brand, tokens, motion, and accessibility so pages never drift.
2. **Always prepend [§2 Ease-of-Use Doctrine](#2-ease-of-use-doctrine)** for any
   *app* page — it is what turns a pile of tools into a workflow people can
   actually follow.
3. Append the **per-page prompt** you want (§4 app · §5 public · §6 auth · §7 admin).
4. If the page uses a shared block, pull the matching **[§3 building block](#3-shared-building-blocks)**
   so the generator reuses the pattern instead of reinventing it.

---

## 1. Master Design Language

> **ROLE:** You are a senior product designer + front-end engineer building the
> FourDM SEO intelligence platform — a premium, multi-tenant SaaS. Produce a UI
> that looks like it belongs in a design-award gallery yet reads instantly to a
> busy marketer. Modern, futuristic, confident, quietly luxurious. Never
> trendy-for-trendy's-sake, never cluttered.
>
> **BRAND & TOKENS — use these, never hardcode hex.** All color comes from CSS
> variables (light + dark both defined in `src/index.css`), surfaced through
> Tailwind utilities. Palette is a navy → ocean-blue → cyan brand system.
> - Surfaces: `bg-app-bg` (canvas), `bg-surface`, `bg-surface-2`; borders `border-border`.
> - Text: `text-text`, `text-text-muted`.
> - Brand: `text-primary`/`bg-primary`, `bg-primary-soft`, `accent`; states `success`, `warning`, `danger`, `info`.
> - Focus ring: `ring-ring` (token `--ring`). Gradients: `.gradient-text`, `.gradient-fill`, `--grad-a/b/c`.
> - **Per-module accents** via `sectionVars(moduleForSection(section))` from
>   `@/lib/sections`, which bind `--section` / `--section-soft`. The workflow
>   colors are fixed and meaningful: Research purple, Audit red, Optimize violet,
>   Track green, Manage slate, Free tools grey. Use them consistently — they are
>   how users learn the app's shape.
> - Ready-made effects in `index.css`: `.glass-card`, `.app-canvas`, `.aurora-bg`,
>   `.cyber-grid`, `.dot-grid`, `.spotlight`, `.lp-shadow`, `.lp-shadow-lg`,
>   `.lp-card` (hover lift), `.section-gradient`, `.gradient-text-anim`,
>   `.blur-in`, `.animate-fade-rise`. Prefer composing these over new CSS.
>   *(These are plain CSS classes, not Tailwind utilities — a `group-hover:` or
>   `md:` prefix on them will silently generate nothing. Use them unprefixed.)*
>
> **CORNERS — partly rounded, calm, NOT pill-like.** Radius scale is
> `md 8px · lg 12px · xl 14px · 2xl 16px`. Cards/containers use `rounded-2xl`
> (16px). Inputs/buttons `rounded-xl`/`rounded-lg`. Reserve `rounded-full` for
> avatars, badges, and icon chips only. Never round a large container past 16px.
>
> **ELEVATION.** Depth comes from soft layered shadows (`.lp-shadow`,
> `shadow-md`) + hairline borders + glass, not heavy drop shadows. Hovering an
> interactive card lifts it 4–6px.
>
> **LAYOUT.** 8px spacing grid; generous whitespace. Max content width 1440px.
> Every module page opens with a **page header** (title + one-line purpose +
> primary action), then the **params form**, then a bento/asymmetric grid —
> scorecards on top, detail below. Responsive: 1 col mobile → 2 → 3/4 wide.
> Tables scroll inside their own container; the page never scrolls sideways.
>
> **MOTION (framer-motion + the CSS anims above).** Buttery, purposeful, cheap.
> Page enters with a 200ms fade-rise. Cards stagger-reveal. Numbers count up on
> first paint. Charts draw on. Hover = spotlight glow + lift. Nothing loops
> forever in the work area (save perpetual motion for marketing pages).
> **Honor `prefers-reduced-motion`.**
>
> **DATA VISUALS (Recharts).** Charts are first-class, not decoration. Series
> colors from tokens; grid lines faint `border`; tooltips are glass cards.
> Sparklines in stat cards, radial `ScoreGauge` for 0–100, area/line for trends,
> horizontal bars for rankings. Always label axes and give a legend. Where lower
> is better (rank position), invert the axis and say so on the chart.
>
> **ACCESSIBILITY (WCAG 2.1 AA — non-negotiable).** Contrast ≥ 4.5:1 (≥3:1
> large); never encode meaning in color alone (pair with icon/label). Visible
> focus ring on every interactive element. Full keyboard operability; logical tab
> order. Touch targets ≥ 44px. Semantic HTML + ARIA for tabs, dialogs, tables,
> live regions (async results announce). Respect reduced motion. Dark mode must
> be as polished as light — verify both.
>
> **COMPONENT CONTRACT — reuse, don't reinvent.** Build from the real primitives
> in this repo: `Card`, `Button` (has loading state), `Input`, `Select`, `Badge`,
> `Skeleton`, `Tabs`, `Toaster`, `RichEditor`, and the shared blocks `StatCard`,
> `MetricCard`, `DataTable`, `ScoreGauge`, `TrendChart`, `AuthorityBadge`,
> `MetricBar`, `CacheBadge`, `SaveToProject`, `SavedRunView`, `AiAdvisor`,
> `LocationLanguagePicker`, `PAAList`, `KeywordTable`, `ExcelButton`,
> `CommandPalette`, and the four-state helpers in `shared/states.tsx`. New ideas
> extend these; they don't fork them.

---

## 2. Ease-of-Use Doctrine

> *Prepend this to every app-page prompt. §1 makes it beautiful; §2 makes it
> usable. The platform has 24 tools — without this section it is a toolbox, not
> a workflow.*

> **THE WORKFLOW IS THE PRODUCT.** The sidebar is numbered on purpose:
> **1 Research → 2 Audit → 3 Optimize → 4 Track → 5 Manage.** Every page must
> make its place in that sequence obvious, and every finished result must hand
> the user to the next step. Design the *path*, not just the page.
>
> **1 · NEXT-STEP CHAINING (the single most important rule).** No analysis ever
> dead-ends in a table. Every result view closes with a **"What next"** rail:
> 1–3 concrete, context-carrying actions, each stating the outcome. Examples:
> - SERP result → *"Audit the #1 ranking page"* (opens On-Page **with that URL
>   already filled**) · *"Track this keyword"* · *"See who else ranks"* → Competitors.
> - Keyword Research → *"Check the live SERP"* · *"Track these 5 keywords"*.
> - Site Audit → *"Fix the worst page"* → On-Page · *"Email this as a report"* → Schedules.
> - On-Page → *"Compare against the top-ranking page"* → Competitors.
> - Content Analysis → *"Turn this into a client report"* → Site Report.
> The action must **carry context forward**. Which leads to:
>
> **2 · ZERO RETYPING.** Never ask for a domain, URL, keyword, or market the user
> has already given this session. Params flow through the URL query string;
> forms pre-fill from the last run and from the active project. Remember the
> last-used location/language and default to it. Retyping is the #1 way a
> multi-tool suite feels like work.
>
> **3 · FIRST-RUN ONBOARDING.** A brand-new account sees an empty product and
> quits. Dashboard shows a dismissible **3-step checklist** — *Add your domain →
> Run your first audit → See your report* — with live tick-offs and a progress
> bar. Each step is one click that lands on a pre-filled form. It disappears for
> good once complete. Never a modal tour; never a blocking wizard.
>
> **4 · PROGRESSIVE DISCLOSURE.** The default form is the *simplest thing that
> works*: one or two fields and a button. Depth (result depth, device, language
> nuances, live-refresh) hides behind a collapsed "Advanced" row with sensible
> defaults already chosen. A first-time user should be able to press the primary
> button without deciding anything.
>
> **5 · COST & QUOTA HONESTY, BEFORE THE CLICK.** This app bills real API calls.
> The run button states what will happen — *"Run · uses 1 of your 10 daily"*, or
> *"Cached · free"* when a cached result exists. Results carry a `CacheBadge`
> (cache vs. live, cost). Approaching the cap warns gently; hitting it (HTTP 402)
> shows a friendly upsell that links to Billing. **Never** a surprise charge, and
> never a bare "limit reached" wall.
>
> **6 · NEVER A DEAD END.** Every empty state names the one action that fills it.
> Every error is plain language (from the RFC-7807 `detail`) plus a retry and, if
> relevant, the fix — inactive Backlinks subscription (403) gets an "activate"
> explainer, a blocked crawl gets "allowlist our crawler UA" with the exact token
> to paste, a bad URL gets a suggestion. Errors never lose the user's input.
>
> **7 · EXPLAIN THE JARGON IN PLACE.** The audience knows SEO but not our metric
> definitions. Every non-obvious metric label carries an info affordance with one
> sentence: *what it is* and *what good looks like* ("Keyword Difficulty 0–100 —
> under 30 is realistic for a young site"). No DataForSEO API vocabulary ever
> reaches the screen.
>
> **8 · PERCEIVED SPEED.** Sections load independently — one slow panel never
> blocks the page. Skeletons match the final layout exactly (never a spinner on
> blank). Long jobs (Site Audit, AI Visibility) show real progress: what's
> happening now, how many pages done, elapsed time — a reassuring 1–3 minutes,
> not a frozen screen.
>
> **9 · RECOVERABILITY.** Destructive actions confirm inline and leave an undo
> toast. Forms preserve input across errors. Saved runs reopen instantly and free
> — say so, so people save freely.
>
> **10 · ONE PAGE, ONE JOB.** Each screen has exactly one primary action, visually
> dominant. Everything else is secondary or tertiary. If a page seems to need two
> primary buttons, it's two pages.
>
> **11 · KEYBOARD & MOBILE.** ⌘K reaches every destination and runs a quick
> search. Forms submit on Enter. Every table is usable on a phone (horizontal
> scroll inside the card, never the page).

---

## 3. Shared building blocks

Paste alongside a page prompt when the page uses the block. Blocks marked
**(NEW)** don't exist yet — they implement §2 and are worth building once.

**Page header** — `Header row: gradient-tinted eyebrow icon in the module's
--section accent, H1 (18–20px, semibold, tracking-tight), muted one-line
description of what this page answers, right-aligned primary action. On analysis
pages the params form sits directly below in a glass Card.`

**WorkflowStepper (NEW)** — `A slim 5-dot progress rail under the page header on
every app page: Research · Audit · Optimize · Track · Manage. The current
module's step is filled with its section accent; completed steps (the user has
run one this session) get a check. Clicking a step navigates. Teaches the
sequence without a tutorial. Hidden on Free tools and Manage.`

**NextSteps rail (NEW)** — `Closes every result view. A short heading ("What
next"), then 1–3 horizontal cards: an icon in the target module's accent, an
action phrase ("Audit the #1 ranking page"), and a one-line outcome. Each links
to the target route with params pre-filled in the query string. Never generic —
the copy names the actual keyword/domain/URL being carried over.`

**Onboarding checklist (NEW)** — `Dismissible glass card on the Dashboard for
accounts with zero runs. Three steps with live tick-offs and a thin progress bar;
each row is a single button landing on a pre-filled form. Warm, brief copy.
Vanishes permanently on completion (persist the flag per user).`

**RunCostChip (NEW)** — `Inline chip beside the primary run button: "Cached ·
free" (success tone) when a cached result exists, or "Uses 1 of 10 today"
(muted) when it will bill. Turns amber under 3 remaining, and at 0 the button
becomes an "Upgrade" link to Billing with the reason stated.`

**MetricInfo (NEW)** — `Small info affordance next to a metric label. Keyboard
focusable, opens a one-sentence popover: what the metric is, what good looks
like. Never a wall of text; never the only place a critical caveat is stated.`

**StatCard / MetricCard** — `Compact glass card: small uppercase muted label, big
count-up metric (tabular-nums), delta chip (▲/▼ with icon, not color alone),
inline sparkline. Optional accent left-border. Hover lifts with spotlight glow.
Used in bento rows of 3–5.`

**DataTable** — `Dense but breathable: sticky header, hairline dividers, sortable
columns (aria-sort), numeric columns right-aligned tabular-nums, sticky first
column on overflow, row hover, toolbar with search + CSV/Excel export. Wrap in
overflow-x-auto. Pagination or load-more for long lists. Skeleton rows while
loading. Row click opens detail where one exists.`

**ScoreGauge** — `Radial 0–100: animated arc that draws on, color ramps
red→amber→green (with a numeric label so it isn't color-only), subtle inner glow
at high scores. Center shows the number + a qualitative word
(Poor/Fair/Good/Excellent).`

**Analysis form** — `Glass Card: the one or two query inputs, a
LocationLanguagePicker defaulted to last-used, advanced options in a collapsed
row, a "Live" toggle (bypass cache, billed — labelled with its cost), and the
primary Button with loading state + RunCostChip. Validate inline; keep input on
error; submit on Enter.`

**Long-job progress** — `For Site Audit / AI Visibility: a card showing the
current activity in plain words ("Crawling page 34 of 120"), a determinate bar
where possible, elapsed time, and what will appear when it finishes. Cancellable.
Never a bare spinner for a multi-minute job.`

**Four states** — `Every data view: loading (skeleton matching final layout),
empty (light line-art glyph + one line of guidance + the single action that
fills it), error (plain-language detail + retry + fix hint), success. Use the
helpers in shared/states.tsx.`

---

## 4. App pages (authenticated)

*Prepend §1 + §2. Grouped by the sidebar's real workflow.*

### Overview

**Dashboard** (`/dashboard`)
> The command center — and the onboarding surface. A welcoming hero strip
> (greeting + org name on an `.aurora-bg`/`.cyber-grid` backdrop) with a
> prominent quick SERP search. For new accounts, the **Onboarding checklist**
> sits directly beneath it. Then a bento grid: quick-action tiles into All-in-One
> and Site Report; a "Data sources" panel showing which provider backs each
> module as status chips; "Recent projects" to resume work; and a usage/quota
> meter (analyses used today vs. limit) with a gentle upsell near the cap. Alive
> and personal without burying the search. For a returning user the first thing
> visible should be *what changed since last time*.

**All-in-One / Workspace** (`/workspace`)
> The flagship single-page analysis and the best answer to "where do I start".
> One hero form (keyword + domain + market + "Run full analysis"). On submit, a
> cinematic staggered reveal of an asymmetric bento: (1) scorecards (health
> gauge, organic keywords, traffic value, keyword rank, pages analyzed) with
> count-ups; (2) the **AI SEO Advisor** card, prominent and gradient-edged;
> (3) findings & recommendations; (4) SERP + People-Also-Ask; (5) keyword metrics
> + 12-month trend; (6) content sentiment; (7) Google Trends; (8) tabs for top
> pages / ranked keywords / competitors. Each section loads independently with
> its own skeleton — one hiccup never blocks the rest. Close with a NextSteps
> rail into the deep-dive modules. This page should make people screenshot it.

### 1 · Research

**Keyword Research** (`/keywords`)
> Header + form (keyword + market). Results: scorecards for Volume / CPC /
> Competition (each with MetricInfo), a 12-month search-volume area chart, and a
> **Google Trends** line with period filters (7d/30d/12m/5y). Tabbed suggestion
> tables (long-tail, related, ideas) — sortable, exportable, multi-selectable.
> A "Bulk analysis" mode: paste up to 100 keywords → one metrics table.
> NextSteps: *check the live SERP* · *track selected keywords*.

**SERP Ranking** (`/serp`)
> Header + form (keyword + market + depth 10/20/50/100 + Live toggle). Ranked
> results table (position, clickable title, brand, URL, description) with sort,
> export, and Save-to-project. Positions #1–3 get a subtle medal accent. Below,
> a **People Also Ask** accordion. Cache/live badge and exact depth always shown.
> Brand search-volume enrichment is **opt-in** and labelled with its cost — it is
> the single most expensive toggle in the app. NextSteps: *audit the #1 page* ·
> *track this keyword* · *see all competitors*.

**Domain Analytics** (`/domains`)
> Opens with a **Domain Authority strip**: 0–100 authority ring + backlinks,
> referring domains, dofollow counts. Then overview (organic/paid keywords,
> traffic value), the full ranked-keyword table, WHOIS, detected technologies as
> chips, and a rank-history chart. NextSteps: *compare with a competitor* ·
> *audit this site*.

**Competitors** (`/competitors`)
> Head-to-head: your domain vs. one or more rivals as mirrored columns of
> authority rings + organic keywords + traffic value, with a connecting "gap"
> visual. Clicking a competitor name expands its detail tables. A **keyword-gap**
> table (what they rank for that you don't, their position vs. yours), exportable
> and sortable by opportunity. Unranked or misspelled domains get an explicit
> inline warning card, never silent dashes.

**Local SEO** (`/local`)
> Business listings by query + location. Rich result cards (name, category,
> rating stars, review count, address, phone, hours) in a responsive grid,
> optionally beside a map-style panel. Sort by rating/reviews. Location input
> must accept plain city names — never make the user find a numeric location code.

### 2 · Audit

**Site Audit** (`/audit`)
> Full-site technical crawl. Start form (domain + pages 5–200) → the **long-job
> progress** card (pages ticked through, counter, elapsed). On finish: a
> site-health `ScoreGauge`, three severity tiles (Errors / Warnings / Notices),
> a severity-sorted **issues table** (issue, severity, pages affected, with a
> plain-language "why this matters" on expand), and a crawled-pages table sorted
> worst-first. If the site blocks the crawler, show the allowlist explainer with
> the exact UA token to paste — that's a fixable problem, not an error.
> NextSteps: *fix the worst page* → On-Page · *schedule this weekly*.

**On-Page** (`/onpage`)
> URL form (bare domains auto-prefixed) + optional keyword. Summary scorecards,
> then tabs: content-score breakdown, readability, a pixel-accurate **Google
> snippet preview**, image/alt audit, indexability, keyword placement, and a
> benchmark vs. top-ranking pages. Plus a Lighthouse performance panel. The
> snippet preview is a signature detail — make it crisp. Every failed check
> states the fix, not just the failure.

### 3 · Optimize

**Content Analysis** (`/content`)
> For a keyword or brand: a sentiment gauge + emotional-connotation mix
> (stacked bar or donut, always labelled), phrase trends over time, and a
> top-citations list as source cards. NextSteps: *turn this into a client report*.

**Site Report** (`/report`)
> The client-ready composite audit. Header form (domain + optional keyword +
> Live). Bento header: health gauge, organic keywords, traffic value, rank, pages
> analyzed — with a graceful N/A state when the site blocked crawling. A
> prominent **AI SEO Advisor** card; key findings + recommendations; tabbed tables
> (top pages with per-page scores & issues, ranked keywords, competitors). A
> **Print/PDF** mode with a real print stylesheet, Save-to-project, and a
> **Schedule** dialog (daily/weekly/monthly + email recipient). This is the
> artifact an agency hands a client — it must look expensive.

### 4 · Track

**Rank Tracking** (`/rank`)
> Track domain + keyword pairs. A tracked-pairs table (keyword, domain, latest
> position, ▲/▼ delta) with an **× to untrack** on each row (confirm + undo
> toast). Per pair, a **position-history line chart** — lower is better, so
> invert the axis and label it explicitly. A "track new" form and an
> alert-threshold setting. Empty state explains that tracking runs daily and
> emails on movement.

**Backlinks** (`/backlinks`)
> Link-profile dashboard: authority ring, total backlinks, referring domains,
> dofollow split, new/lost, spam score — then tabs for strongest backlinks,
> referring domains, anchor texts, and a competitor **link gap**. If the
> DataForSEO Backlinks subscription is inactive (403), show a clean "activate"
> explainer instead of an error state.

**AI Visibility** (`/ai-visibility`)
> The most futuristic page — lean into it (tasteful glow + grid). Does an AI
> answer cite *you*? A query form → job progress → a verdict card (cited / not
> cited, with the citing excerpt and who was cited instead). Plus LLM mention
> metrics, AI keyword search volume, and an "ask an LLM" box showing the model's
> response. This is the differentiator competitors don't have — this is where
> "the UI is art" should peak, without hurting clarity.

**Schedules** (`/schedules`)
> Recurring reports. A table (project, frequency, next/last run, last status as a
> colored **and** iconed chip, recipient) with Run-now, pause toggle, cancel, and
> delete. Next-run shown as a warm countdown. Empty state points to the Site
> Report page where schedules are created.

### 5 · Manage

**Projects** (`/projects`)
> Project cards (name, type, run count, last updated) in a grid + a create
> action. Cursor-paginated. Clicking opens the detail.

**Project Detail** (`/projects/:id`)
> A project's saved runs as a timeline/table (module, params, date) — each row
> reopens the exact snapshot instantly and free, rendered via `SavedRunView`.
> Header shows name + type + the "these reopen free" reassurance, so people save
> generously.

**Billing** (`/billing`)
> Plan & usage center: current plan + daily-analysis usage meter; a **plans**
> comparison (tiers, ₹ price, daily limits, features) with an upgrade CTA running
> **Razorpay checkout**; a payments table with downloadable **GST invoices
> (PDF)**; and a billing address / GSTIN form. Make upgrading feel like an easy,
> confident yes — never a paywall shakedown.

### Free tools ($0, instant, in-process)

**All Tools hub** (`/tools`)
> A gallery of the six local analyzers as inviting tiles (icon, name, one-liner,
> "free · instant" badge). Bento layout, hover spotlight. Frame them as quick
> utilities available any time, with no quota cost.

**URL / Keyword / Heading / Image / Meta / Sitemap Analysis** (`/tools/*`)
> One consistent analyzer template across all six: a single input (URL, or
> URL+keyword), an instant in-process result, and a result panel tailored per
> tool — URL: page summary · Keyword: placement & density · Heading: H1–H6
> outline tree · Image: alt/size audit grid · Meta: title/description/robots with
> pixel-length meters · Sitemap: crawl of listed pages plus a zoomable node-graph
> of the site structure. Fast, single-purpose, obviously free. Each closes with
> *"want this for your whole site?"* → the paid equivalent.

---

## 5. Public marketing pages

*Prepend §1. These pages sell; §2 applies loosely (clarity still rules).*

**Landing** (`/`) — the full prompt lives in [§8](#8-landing-page-the-long-form-prompt).

**Features** (`/features`)
> The full-detail counterpart to the landing page's suite section. All 24 tools
> grouped by the same workflow (Research → Audit → Optimize → Track → Manage →
> Free tools), each with a real screenshot or faithful mock, the outcome it
> produces, and who it's for. Sticky sub-nav jumps to each group. Every entry
> links to `/register`. Must never contradict the sidebar — drive it from the
> same `NAV_ITEMS` source.

**Free tools** (`/free-tools`)
> The public, no-login tools page — the top of the funnel. A working analyzer
> input at the top (same `POST /public/analyze` contract as the landing hero),
> then the tool tiles. Every result ends with a soft, honest upgrade line: what
> the free version showed vs. what an account adds ("this page" vs. "all 340
> pages"). Never gate a result the visitor already waited for.

**Pricing** (`/pricing`)
> Plan cards with monthly/annual toggle, the popular tier lifted, ₹ pricing with
> GST stated, daily-analysis limits, and a feature-comparison table that is
> honest about what's *not* included. FAQ on billing, cancellation, and refunds
> below. One primary CTA per tier. Show the free tier without shame.

**Blog index** (`/blog`)
> Card grid with category filter chips. Each card: cover image with a fixed
> aspect ratio (never letterboxed or cropped-through-the-subject), title,
> excerpt, author, date, read time. Featured post spans wider. Search + pagination.

**Blog post** (`/blog/:slug`)
> Long-form reading layout, ~68ch measure. Banner image bridging the hero and the
> white content background. A **right-hand sticky table of contents**, no
> container chrome, with live highlighting of the section in view. Body prose
> styled generously (headings, quotes, code, inline images). FAQs as `<details>`
> dropdowns. Author box, share row, related posts. Article JSON-LD + FAQ schema.
> Reading progress bar. Mobile: TOC collapses to a top dropdown.

**Web stories index / viewer** (`/webstories`, `/webstories/:slug`)
> Index: poster-style tall cards in a scrollable rail. Viewer: full-screen
> vertical story player — tap/swipe navigation, segmented progress bar at top,
> keyboard arrows, pause on hold, and an exit affordance that is always visible.
> Respect reduced motion. Never trap the user.

**Pillar guide** (`/guides/technical-seo`)
> The flagship long-form asset. Chaptered layout with a persistent chapter nav,
> section hero images, callout boxes, and inline CTAs into the matching free
> tool at the moment the reader needs it ("check your own headings →").

**Contact** (`/contact`)
> Short form (name, email, message) with inline validation, a clear success
> state, and honest response-time expectations. Alongside: support email, company
> details, and links to Help. Never a bare form on an empty page.

**About / Help** (`/about`, `/help`)
> Rendered from CMS content (`ContentPage`). About: story, team, company facts.
> Help: searchable article list grouped by topic, with a contact fallback at the
> bottom for when the answer isn't there.

**Privacy / Terms / Cookies** (`/privacy`, `/terms`, `/cookies`)
> Clean legal-document typography: generous line height, numbered sections,
> anchor links, a last-updated date, and a sticky section nav on desktop. Plain
> `ContentPage` styling — readable beats designed.

**Public shell** (header/footer)
> Sticky glass header: logo, nav (Features, Free tools, Pricing, Blog, Contact),
> theme toggle, Login (secondary) + Start free (primary). Mobile drawer. Footer:
> four link columns, the 24-tool sitemap for SEO, company + GST details, socials,
> legal row.

---

## 6. Auth pages

*Prepend §1. These are the highest-stakes screens in the funnel — every point of
friction here costs a signup.*

**Login** (`/login`)
> Split layout: left, the branded panel using the **real logo** on a rich
> gradient (never a washed-out tint); right, the form. Email + password with a
> show/hide toggle, "Continue with Google", forgot-password link, and a link to
> register. Errors appear inline above the field, in plain language, and never
> clear what was typed. Autofocus the first empty field; submit on Enter.

**Register** (`/register`)
> Same split. As few fields as legally possible. Live, non-punitive password
> strength (guidance, not scolding). Accept a `?q=` param from the landing
> analyzer and show what's waiting — *"We'll run the full report on example.com
> as soon as you're in"* — so the signup feels like continuing, not restarting.
> State plainly that no card is required. Email verification, if enabled, gets a
> clear "check your inbox" screen with a resend control and a visible cooldown.

**Forgot / Reset password** (`/forgot-password`, `/reset-password`)
> Single-purpose, calm. Forgot: one email field, and a success state that does
> **not** reveal whether the account exists. Reset: new password + confirm, live
> match check, clear expiry messaging if the link is stale, plus a one-click path
> to request a fresh link.

**OAuth callback** (`/oauth`)
> A branded interstitial with a progress indicator and a one-line status. On
> failure, a plain explanation and a route back to login — never a blank screen
> or a raw error code.

---

## 7. Admin portal

*Prepend §1 + §2. The admin is an internal tool, so bias further toward density
and speed than the customer app — but it is still the same design system, not a
bootstrap dashboard. Every section is permission-gated (`perm=…`); a user
without a permission should never see the tab at all, not a locked one.*

**Admin login** (`/admin/login`)
> Visually distinct from the customer login (darker, more utilitarian) so staff
> never wonder which door they're at. Minimal, no marketing.

**Admin shell** (`AdminShell` + `AdminSidebar`)
> Persistent sidebar grouped: Overview · Users · Content · Commerce (Plans,
> Billing) · Comms (Contact, Emails) · System (Usage, Roles, Settings). Each page
> renders through `AdminSection` with a title + subtitle. Slim topbar with
> environment indicator, search, and the admin's account menu.

**Overview** (`/admin`)
> Platform health at a glance: users (total / active / new), revenue (MRR,
> today), analyses run, and the **live DataForSEO account balance** — that
> balance is the number that matters most, so make it prominent and show when it
> was last fetched. Recent-activity feed. Trend charts for signups and usage.

**Users** (`/admin/users`)
> Dense searchable table: email, org, plan, spend, last active, status. Row opens
> a detail drawer with per-user usage, spend breakdown, and admin actions
> (unlimited toggle, suspend, reset). Bulk select for the common operations.
> Every mutating action confirms and leaves an audit trail.

**Content — Blog categories / Blogs / Story categories / Stories**
(`/admin/content/*`)
> Two shapes, deliberately: **categories edit inline** in their table (name,
> slug, sort order) — they're trivial and shouldn't cost a page load. **Posts and
> stories get full pages** for create (`/new`) and edit (`/:id`), because they're
> real authoring work: title, slug (auto-derived, editable), cover image upload
> with a live preview at the real display aspect ratio, `RichEditor` body,
> excerpt, FAQ list builder, SEO meta with a live snippet preview, category,
> status, and publish date. Autosave drafts, warn on unsaved-leave, and offer a
> "preview as published" that opens the real public template. Story editing adds
> a slide-by-slide builder with reorder.

**Plans** (`/admin/plans`)
> Plan cards or a table with price, interval, daily limits, feature flags, and
> active state. Editing a live plan warns about the effect on existing
> subscribers before saving.

**Billing** (`/admin/billing`)
> Subscriptions, payments, refunds. Filterable transaction table with status
> chips, invoice links, and a refund action behind an explicit confirm. Revenue
> summary strip on top.

**Contact** (`/admin/contact`)
> Inbound messages as an inbox: list + reading pane, unread emphasis, mark
> handled, and reply-by-email. Show the submitter's IP and timestamp.

**Emails** (`/admin/emails`)
> Transactional email log: recipient, template, status, timestamp, error detail
> on failures, and a retry action. Filter by status. Scheduled sends can be
> cancelled before they fire.

**Usage** (`/admin/usage`)
> Search and API usage history — the cost-control screen. Table of calls with
> endpoint, org, cost in cents (**sub-cent precision matters**; an AI Overview
> call is 0.2¢ and must never round to zero), and cache hit/miss. Aggregate
> charts by endpoint and by day, so the expensive endpoints are obvious at a
> glance. This is where someone diagnoses a spend spike — optimize for that.

**Roles** (`/admin/roles`)
> Staff admins and their permissions as a checkbox matrix (role × permission),
> with a plain-language line per permission. Guard against removing your own
> last admin access.

**Settings** (`/admin/settings`)
> Company info, logo upload with live preview, social links, and site-wide
> defaults. Grouped into cards with per-section save and a clear saved
> confirmation.

---

## 8. Landing page (the long-form prompt)

> **Prepend §1.** The landing page is the one screen allowed a little more
> theatre than the app — but the same tokens, the same restraint, the same
> accessibility floor.

**Why this page is different from every app screen:** the app sells to someone
who already trusts you. This page has ~8 seconds to earn that trust from a
stranger with three competitor tabs open. So it must *prove* rather than
*claim* — the product does something real, on their site, before the signup.

> **ROLE:** Senior product designer + front-end engineer. Design the public
> landing page for **seodada** — an AI-era SEO intelligence platform covering
> classic search, AI Overviews (GEO) and answer engines (AEO). Audience: SEO
> leads, agency owners and marketing managers who are fluent in Ahrefs/Semrush
> and instantly bored by generic SaaS pages.
>
> **NORTH STAR — prove it, don't pitch it.** The hero is a working tool, not a
> screenshot. A visitor pastes their own URL and gets a genuine audit inline,
> before any account exists. Every claim below it is evidence for what they just
> saw. If a section can't survive *"why should I believe you?"*, cut it.
>
> **1 · HERO — the live analyzer (the whole page hinges on this).**
> Full-height aurora-mesh canvas, drifting particles, cursor-follow spotlight.
> Left: eyebrow chip (`AI-powered SEO · GEO · AEO`), an H1 whose second line
> carries the animated gradient, one sentence of positioning, then **the
> analyzer**: a single pill-shaped glass input — *"Enter a domain, keyword, or
> URL…"* — with a gradient Analyze button.
> - A **URL** → `POST /api/v1/public/analyze` (anonymous, per-IP rate limited,
>   SSRF-guarded, $0 in-process). Results render **inline beneath the input**: a
>   big score in success/warning/danger tone, `5 of 7 checks passed`, then the
>   seven checks as a two-column list with check/cross icons — HTTPS, title, meta
>   description, H1, canonical, viewport, image alt.
> - A **keyword** (no dot-TLD) → route to `/register?q=…`; there's nothing honest
>   to show inline for a keyword.
> - Below the checks: *"N issues found on this page"* + **See the full report** →
>   `/register`. That is the conversion moment — they've just seen their own gaps.
> - States are non-negotiable: pending (*"Fetching and analysing that page…"*),
>   429 (*"…give it a minute, or create a free account for unlimited runs"*),
>   error (plain language), and a Clear control.
> Right: a floating glass product mock — score ring, keyword rows, a drawn-on
> traffic sparkline — tilted and parallaxed, never a flat PNG.
>
> **2 · TRUST STRIP.** A quiet monochrome marquee of the ecosystem it plugs into
> (Google, GSC, Ads, ChatGPT, Perplexity…). Slow, muted. No fake customer logos.
>
> **3 · THE SUITE — all 24 tools, grouped by the sidebar's workflow.** Drive it
> from the same `NAV_ITEMS` source the sidebar uses so the two can never drift:
> - **Overview** — Dashboard, All-in-One
> - **1 · Research** — Keyword Research, SERP Ranking, Domain Analytics, Competitors, Local SEO
> - **2 · Audit** — Site Audit, On-Page
> - **3 · Optimize** — Content Analysis, Site Report
> - **4 · Track** — Rank Tracking, Backlinks, AI Visibility, Schedules
> - **5 · Manage** — Projects, Billing
> - **Free tools ($0, no login)** — All-in-One, URL, Keyword, Heading, Image, Meta, Sitemap
> Each card: module-accent icon chip, name, one concrete outcome line (*what you
> get*, never "powerful analytics"). Group headers carry the workflow accent so
> the page teaches the app's mental model before signup.
>
> **4 · WORKFLOW.** A sticky-scroll narrative — Research → Audit → Optimize →
> Track — with the panel illustration swapping per step. Show the loop, not the
> features. This is the section that makes 24 tools feel like one product.
>
> **5 · AI VISIBILITY (the differentiator).** A dedicated block for what
> competitors don't have: whether AI Overviews and LLM answers cite *you*, who
> gets cited instead, and how it trends. Show a real-looking citation panel.
>
> **6 · PROOF.** Case-study cards each carrying one specific metric, counted-up
> stats, and testimonials naming a role and an outcome. Never a five-star wall.
>
> **7 · PRICING TEASER.** Plan cards, monthly/annual toggle, popular tier lifted,
> ₹ pricing, one line on the free tier. Detail lives on `/pricing`.
>
> **8 · FAQ.** Native `<details>` accordions (keyboard and screen-reader free,
> answers stay in the DOM for crawlers) answering real objections: cost, data
> sources, AI accuracy, cancellation.
>
> **9 · FINAL CTA.** Gradient panel, one promise, one primary button, one
> secondary (Book a demo). No new information.
>
> **CONVERSION RULES.**
> - The analyzer must show **failures as well as passes** — a demo that always
>   says "all good" proves nothing and converts nobody.
> - Never gate a result the visitor already worked for.
> - One primary CTA per viewport. "Start free" and "See the full report" both
>   land on `/register`; keep "Book a demo" visually secondary.
>
> **PERFORMANCE (this page is the ad — weight is a design constraint).** Public
> routes are lazy-loaded and must never pull admin-only chunks (CKEditor, d3,
> exceljs) into the eager path — verify `dist/index.html` after building. Hero
> art ships WebP/AVIF with width/height set; below-the-fold images are
> `loading="lazy"`. Target LCP < 2.5s on 4G.
>
> **SEO.** One `<h1>`; real `<h2>`/`<h3>` structure; `Organization` + `WebSite`
> JSON-LD; canonical + OpenGraph; meaningful alt text throughout.
>
> **ACCESSIBILITY.** Every animation degrades under `prefers-reduced-motion`; the
> analyzer result is announced to screen readers; check/cross icons always pair
> with text; visible focus rings on glass surfaces (they're easy to lose).

---

## 9. Global chrome

**Sidebar** — `Collapsible rail grouped by the numbered workflow (Overview,
1·Research, 2·Audit, 3·Optimize, 4·Track, 5·Manage, Free tools). Section headers
read as connected process steps with a subtle vertical connector. Each group
carries its own accent via sectionVars. Active item gets a gradient highlight +
left indicator. Collapsed mode shows icons with tooltips. Groups fold; the state
persists.`

**TopBar** — `Slim glass bar: mobile menu, breadcrumb/page title, ⌘K palette
trigger showing the shortcut hint, theme toggle (animated sun/moon), and a user
menu (org, settings, logout). Sticky, translucent over scrolling content. Show
remaining daily quota here as a subtle chip so it's never a surprise.`

**Command Palette (⌘K)** — `Centered glass modal, fuzzy search over every nav
destination plus a quick SERP search. Keyboard-first (arrows + enter), grouped
results, recent items. The fastest way around a 24-tool app — make it
discoverable, not a secret.`

**AI SEO Advisor card** — `Standout gradient-edged card turning analysis data
into a prioritized action plan: an executive summary + specific suggestions
tagged HIGH/MEDIUM/LOW (icon + label, not color alone). "Get AI suggestions" /
"Regenerate" with a thoughtful generating animation. Graceful 503 when no AI
provider is configured.`

**Toasts** — `Bottom-right glass toasts. Success is brief; destructive actions
carry an Undo for ~8s; errors persist until dismissed and never bury the detail.`

---

## 10. One-paragraph master prompt

> Design the FourDM/seodada SEO platform as a modern, futuristic, gallery-grade
> SaaS that stays instantly usable across 24 app tools, 15 public pages, 5 auth
> screens and a 17-page admin portal. Navy→ocean→cyan brand via CSS-variable
> tokens (light + dark, no hardcoded hex) with fixed per-module workflow accents
> (Research purple, Audit red, Optimize violet, Track green, Manage slate);
> glassmorphism on a soft aurora canvas with a whisper of cyber-grid;
> **partly-rounded corners (16px cards, never pill-like)**; soft layered shadows;
> buttery framer-motion (fade-rise, blur-in stagger, count-ups, draw-on charts,
> hover spotlight-lift) that respects reduced motion. Data is the hero — Recharts
> trends, radial 0–100 gauges, sparkline stat cards, ranking bars, all
> token-colored. **Usability is co-equal with beauty:** the numbered workflow
> (Research → Audit → Optimize → Track → Manage) is visible everywhere, every
> result ends with a context-carrying "what next" action, nothing is ever
> retyped, advanced options stay collapsed behind sensible defaults, cost and
> quota are stated before the click, jargon is explained in place, and no state
> is ever a dead end. Reuse the existing Card/Button/DataTable/StatCard/
> ScoreGauge/AiAdvisor primitives. Every view has loading (matching skeleton),
> empty (friendly CTA), and error (plain language + retry) states plus a
> cache/live badge. WCAG 2.1 AA throughout: 4.5:1 contrast, visible focus rings,
> full keyboard support, 44px targets, meaning never by color alone, flawless
> dark mode. Make people want to screenshot it — without ever making them think.
