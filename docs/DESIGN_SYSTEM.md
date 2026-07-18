# APERTURE — the seodada design system

> The element-level specification that governs every prompt in
> [UI_DESIGN_PROMPTS.md](./UI_DESIGN_PROMPTS.md). That document says *what each
> page does*. This one says *what everything is made of* — color, type, space,
> depth, motion, and the exact HTML/CSS of every element.
>
> **Rule of precedence:** if a page prompt and this system disagree, this system
> wins. A page may extend Aperture; it may never contradict it.

---

## 0. The thesis

Most SaaS design systems are decoration applied to data. They pick a nice blue,
round the corners, and call it a language. That produces something competent and
forgettable, because nothing about the visual system *means* anything — swap the
palette and the product still works.

Aperture starts from the one question this product exists to answer:

> **Are you visible?**

Visible in Google. Visible in the AI Overview. Visible when someone asks
ChatGPT. Every screen in this platform is a measurement of visibility.

So the design system encodes visibility as its primary material — **light**.

**The core mechanic: luminance carries meaning.** In Aperture, brighter is not a
style choice, it is a *value*. A #1 ranking glows. A page buried at #90 is dim.
A domain cited by three AI engines is luminous; one cited by none sits in the
dark. The user learns to read the interface's brightness the way they read a
number — before they read the number.

That single idea is what makes this system defensible. You cannot lift it into a
project-management tool or a CRM, because in those products brightness would mean
nothing. Here it is the subject.

Three consequences follow, and they define the whole system:

1. **Depth is real, not decorative.** Surfaces sit at measured elevations
   (`z0`–`z3`) with defined blur, border and glow. Content emerges *out of*
   depth toward the viewer as it becomes more important.
2. **Color is perceptual, not hexadecimal.** Everything is authored in **OKLCH**,
   so two accents at the same lightness genuinely *look* equally bright. Hand-
   picked hex palettes always have a hue that punches too hard; this one can't.
3. **One spectrum for all visibility data.** Not arbitrary red/green — a single
   continuous ramp from buried to visible, used everywhere a visibility metric
   appears, so the same brightness always means the same thing across 25 pages.

**The name.** An aperture controls how much light reaches the sensor. This
product controls how much of you reaches the search result.

---

## 1. Color

### 1.1 Why OKLCH

Author every color as `oklch(L C H)`:

- **L** (0–1) — perceptual lightness. Equal L = equal apparent brightness, which
  sRGB hex emphatically does not give you (`#0000ff` and `#00ff00` are both
  "full" yet wildly different in perceived light).
- **C** — chroma (saturation), unbounded but practically 0–0.37.
- **H** — hue angle in degrees.

This matters here because the whole system rests on luminance meaning something.
If our six module accents were picked by eye, the yellow would scream and the
blue would whisper *at the same nominal weight*, and the brightness signal would
be noise. Fixing L across the accent set makes them optically equal by
construction.

OKLCH is supported in every current browser (Chrome 111+, Safari 15.4+, Firefox
113+). Hex fallbacks are listed for tooling that needs them, but **CSS should use
the OKLCH form.**

> **Caveat — Tailwind arbitrary values (v3.4).** Two silent-failure traps bit
> during implementation, both of which compile without error and render nothing:
> - `shadow-[var(--lift-1)]` is read as a shadow **color** (Tailwind's
>   ambiguity heuristic emits `--tw-shadow-color`), so the elevation vanishes.
>   Use the type hint: **`shadow-[shadow:var(--lift-1)]`**.
> - `duration-[--dur-1]` / `ease-[--ease]` are v4 shorthand. In v3 they emit
>   invalid CSS. Use **`duration-[var(--dur-1)]`**.
>
> More generally: the plain CSS classes in `index.css` (`.glass-card`,
> `.section-gradient`, `.gradient-fill`) are **not** Tailwind utilities, so a
> `group-hover:` or `md:` prefix on them generates nothing. Always verify a new
> arbitrary value by reading `getComputedStyle` in the browser — it is the only
> reliable check.

> **Caveat — relative color syntax.** Several tokens below use
> `oklch(from var(--x) L c h)` to derive a variant from another token. That is
> CSS Color 5 relative colors, which landed later than OKLCH itself (Chrome
> 119+, Safari 16.4+, Firefox 128+). It degrades to *nothing* — the declaration
> is dropped, not approximated — so for any token where the fallback matters,
> either declare a literal `oklch()` value first as a fallback, or precompute the
> variant. Where a derived token is load-bearing (`--section-ink`), define it
> explicitly per module rather than deriving it. Verify in the browsers your
> analytics actually show before relying on it.

### 1.2 The Signal Spectrum

The system's spine: one perceptual ramp from *buried* to *fully visible*. Hue
travels from deep indigo through the brand blue and out to cyan, while lightness
climbs in equal perceptual steps.

| Token | OKLCH | Hex | Means |
|---|---|---|---|
| `--signal-0` | `oklch(0.30 0.09 268)` | `#1b295a` | Buried — not ranking, not cited |
| `--signal-1` | `oklch(0.42 0.12 256)` | `#184c8d` | Faint — page 3+, rare mention |
| `--signal-2` | `oklch(0.54 0.14 243)` | `#0075b9` | **Present — the brand anchor** |
| `--signal-3` | `oklch(0.66 0.13 225)` | `#00a2ce` | Strong — page 1 |
| `--signal-4` | `oklch(0.78 0.12 205)` | `#3bcddc` | Prominent — top 3 |
| `--signal-5` | `oklch(0.88 0.11 190)` | `#76efe7` | Peak — #1, cited everywhere |

**The spectrum was derived from your logo, not chosen around it.** The seodada
primary `#1d7dbd` measures `oklch(0.568 0.130 244)` — which lands almost exactly
on `--signal-2`. The brand blue *is* the midpoint of the visibility ramp. Every
brighter stop is that same blue with more light in it; every darker stop is the
same blue with light removed. Nothing in the palette is arbitrary.

**Usage.** Any 0–100 visibility score, rank position, citation rate, or health
gauge maps onto this ramp. Never invent a second scale for the same idea.

```css
/* map a 0..100 visibility value onto the spectrum */
.signal { color: oklch(calc(0.30 + 0.58 * var(--v)) 0.13 calc(268deg - 78deg * var(--v))); }
/* usage: <span class="signal" style="--v:.86"> */
```

### 1.3 Module accents — equal optical weight

Six workflow accents, all authored at **exactly `L=0.62 C=0.15`** in light mode
and `L=0.74 C=0.14` in dark. Only the hue changes. This is why the sidebar reads
as one system rather than a bag of colored dots.

| Module | Hue | Light | Dark |
|---|---|---|---|
| Research | 292° | `#8972d8` | `#ad99fb` |
| Audit | 25° | `#d15c56` | `#f7857d` |
| Optimize | 320° | `#ad65be` | `#d28ce1` |
| Track | 155° | `#0fa05c` | `#55c483` |
| Manage | 250° | `#2f8adc` | `#60b0ff` |
| Free tools | 240° | `#008fd6` | `#47b5fa` |

> **Verified constraint — read this before using an accent on text.**
> Measured against `--surface`, the light-mode accents land at **3.4–3.9:1**.
> That clears WCAG for **UI components and large text (≥3:1)** but **fails for
> small body text (needs 4.5:1)**. Therefore: accents are for icon chips,
> borders, rails, fills, badges and display numerals — **never for small text on
> a light surface.** For accent-colored small text, use `--section-ink`
> (the accent at `L=0.45`), which passes.
> Dark mode measures 7.7–8.6:1 and is unrestricted.

### 1.4 Full token definition

Drop-in replacement for the `:root` / `.dark` blocks in `src/index.css`. Hex
fallbacks are in comments for tooling.

```css
:root {
  color-scheme: light;

  /* ---- Strata (depth ladder) ---------------------------------------- */
  --z-base:    oklch(0.975 0.006 250);  /* #f6f8fc  app canvas          */
  --z0:        oklch(1     0     0);    /* #ffffff  resting surface     */
  --z1:        oklch(0.985 0.004 250);  /*          raised card         */
  --z2:        oklch(0.965 0.008 250);  /*          inset / well        */
  --z3:        oklch(1     0     0);    /*          overlay / modal     */
  --hairline:  oklch(0.905 0.012 250);  /* #e2e8f2  1px structural line */

  /* ---- Ink ----------------------------------------------------------- */
  --ink:       oklch(0.20 0.03 258);    /* #0d1524  17.2:1 on canvas    */
  --ink-muted: oklch(0.48 0.03 258);    /* #55627d   5.8:1 on canvas    */
  --ink-faint: oklch(0.65 0.02 258);    /*          decorative only     */
  --ink-invert:oklch(0.99 0.00 0);

  /* ---- Signal spectrum ----------------------------------------------- */
  --signal-0: oklch(0.30 0.09 268);
  --signal-1: oklch(0.42 0.12 256);
  --signal-2: oklch(0.54 0.14 243);   /* = brand anchor */
  --signal-3: oklch(0.66 0.13 225);
  --signal-4: oklch(0.78 0.12 205);
  --signal-5: oklch(0.88 0.11 190);

  --primary:      var(--signal-2);
  --primary-ink:  oklch(0.45 0.14 243);  /* accent text that passes 4.5:1 */
  --primary-soft: oklch(0.96 0.03 243);

  /* ---- Semantic states (same L as accents = same optical weight) ------ */
  --success: oklch(0.62 0.15 155);
  --warning: oklch(0.72 0.16  75);
  --danger:  oklch(0.58 0.19  25);
  --info:    var(--signal-3);

  /* ---- Module accents (only H varies) -------------------------------- */
  --acc-research: oklch(0.62 0.15 292);
  --acc-audit:    oklch(0.62 0.15  25);
  --acc-optimize: oklch(0.62 0.15 320);
  --acc-track:    oklch(0.62 0.15 155);
  --acc-manage:   oklch(0.62 0.15 250);
  --acc-tools:    oklch(0.62 0.15 240);

  /* Active module — AppShell rewrites these per route. */
  --section:      var(--primary);
  --section-ink:  oklch(from var(--section) 0.45 c h);  /* text-safe variant */
  --section-soft: oklch(from var(--section) 0.96 0.03 h);
  --section-glow: oklch(from var(--section) l c h / 0.28);

  /* ---- Elevation: shadow in light, glow in dark ----------------------- */
  --lift-1: 0 1px 2px oklch(0.20 0.03 258 / .06), 0 2px 8px  oklch(0.20 0.03 258 / .05);
  --lift-2: 0 2px 4px oklch(0.20 0.03 258 / .07), 0 8px 24px oklch(0.20 0.03 258 / .08);
  --lift-3: 0 8px 16px oklch(0.20 0.03 258 / .09), 0 24px 56px oklch(0.20 0.03 258 / .12);
  --bloom:  0 0 0 1px var(--section-glow);

  --ring: var(--section);
}

.dark {
  color-scheme: dark;

  /* In dark mode depth inverts: surfaces get LIGHTER as they rise, and
     elevation is carried by glow rather than shadow. */
  --z-base:    oklch(0.16 0.02 258);   /* #05080f */
  --z0:        oklch(0.20 0.025 258);  /* #0b111f */
  --z1:        oklch(0.24 0.030 258);
  --z2:        oklch(0.18 0.022 258);  /* inset goes darker, not lighter */
  --z3:        oklch(0.27 0.032 258);
  --hairline:  oklch(0.32 0.035 258);

  --ink:       oklch(0.94 0.015 250);  /* 17.2:1 */
  --ink-muted: oklch(0.70 0.030 250);  /*  7.7:1 */
  --ink-faint: oklch(0.52 0.028 250);
  --ink-invert:oklch(0.16 0.02 258);

  /* The spectrum brightens — dark mode is where luminance-as-meaning sings. */
  --signal-0: oklch(0.34 0.08 268);
  --signal-1: oklch(0.47 0.11 256);
  --signal-2: oklch(0.60 0.13 243);
  --signal-3: oklch(0.72 0.13 225);
  --signal-4: oklch(0.82 0.12 205);
  --signal-5: oklch(0.91 0.11 190);

  --primary:      var(--signal-4);
  --primary-ink:  var(--signal-4);
  --primary-soft: oklch(0.26 0.06 243);

  --success: oklch(0.74 0.14 155);
  --warning: oklch(0.80 0.14  75);
  --danger:  oklch(0.70 0.16  25);

  --acc-research: oklch(0.74 0.14 292);
  --acc-audit:    oklch(0.74 0.14  25);
  --acc-optimize: oklch(0.74 0.14 320);
  --acc-track:    oklch(0.74 0.14 155);
  --acc-manage:   oklch(0.74 0.14 250);
  --acc-tools:    oklch(0.74 0.14 240);

  --section-ink:  var(--section);      /* bright enough already */
  --section-soft: oklch(from var(--section) 0.26 0.06 h);
  --section-glow: oklch(from var(--section) l c h / 0.42);

  /* Glow replaces shadow. A dark card is defined by its light, not its shade. */
  --lift-1: 0 1px 0 oklch(1 0 0 / .04) inset, 0 2px 8px  oklch(0 0 0 / .40);
  --lift-2: 0 1px 0 oklch(1 0 0 / .06) inset, 0 8px 24px oklch(0 0 0 / .50);
  --lift-3: 0 1px 0 oklch(1 0 0 / .08) inset, 0 24px 56px oklch(0 0 0 / .60);
}
```

### 1.5 Colors that are forbidden

- **Pure black or pure white surfaces in dark mode.** `#000` kills the glow
  system; every dark surface carries a trace of the 258° hue.
- **Any raw hex in a component.** If a value isn't a token, it's a bug.
- **Red/green as the only difference** between two states — always pair with an
  icon or label (see §7).
- **A second visibility scale.** If you're coloring a 0–100 metric and not using
  the Signal Spectrum, stop.

---

## 2. Typography

### 2.1 Faces

```css
--font-sans: "Inter var", Inter, ui-sans-serif, system-ui, sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, "SF Mono", monospace;
```

**Inter with optical sizing and tabular figures on by default in data contexts.**
The single most impactful typographic decision in a metrics product:

```css
:root { font-feature-settings: "cv05" 1, "ss03" 1; } /* open a, flat-top t */
.tabular, table, .metric, td, th { font-variant-numeric: tabular-nums; }
```

Without `tabular-nums`, every count-up animation jitters horizontally and every
right-aligned column wobbles. Non-negotiable anywhere digits appear.

### 2.2 Scale

Fluid, ratio 1.2 (minor third) at body, opening to 1.333 at display sizes so
headlines get drama without the body text inflating.

```css
--text-2xs:  0.6875rem;                              /* 11px — chip, meta      */
--text-xs:   0.75rem;                                /* 12px — labels, caption */
--text-sm:   0.8125rem;                              /* 13px — table, dense UI */
--text-base: 0.875rem;                               /* 14px — app body        */
--text-md:   1rem;                                   /* 16px — prose body      */
--text-lg:   1.125rem;                               /* 18px — card title      */
--text-xl:   1.375rem;                               /* 22px — page title      */
--text-2xl:  clamp(1.5rem,  1.2rem + 1.2vw, 2rem);   /* section head           */
--text-3xl:  clamp(2rem,    1.5rem + 2.2vw, 3rem);   /* marketing h2           */
--text-4xl:  clamp(2.6rem,  1.7rem + 4.2vw, 4.5rem); /* hero h1                */
--text-metric: clamp(1.75rem, 1.4rem + 1.6vw, 2.5rem); /* the big number       */
```

**App body is 14px, prose body is 16px.** Dense tools and long-form reading have
different jobs; one size for both compromises each.

### 2.3 Rules

| Role | Size | Weight | Tracking | Leading |
|---|---|---|---|---|
| Display / hero | `4xl` | 800 | `-0.03em` | 1.02 |
| Page title | `xl` | 650 | `-0.02em` | 1.2 |
| Card title | `lg` | 600 | `-0.01em` | 1.3 |
| Body (app) | `base` | 400 | 0 | 1.55 |
| Body (prose) | `md` | 400 | 0 | 1.7 |
| Metric numeral | `metric` | 700 | `-0.02em` | 1 |
| Label / eyebrow | `xs` | 600 | `0.08em` uppercase | 1.4 |
| Table cell | `sm` | 400 | 0 | 1.45 |

- **Tighter as it gets bigger.** Large type needs negative tracking or it reads
  loose and amateur. This is the difference between a designed headline and a
  default one.
- **Prose measure caps at 68ch.** Long-form (blog, guides) never exceeds it.
- **Never letterspace lowercase body text.** Only uppercase labels.
- **Two weights per screen, maximum**, plus the metric weight. Weight soup is
  the most common way a good palette still looks cheap.

---

## 3. Space & radius

```css
/* 4px base, 8px rhythm. Every gap is a token — no magic numbers. */
--s-1: 0.25rem;  --s-2: 0.5rem;   --s-3: 0.75rem;  --s-4: 1rem;
--s-5: 1.5rem;   --s-6: 2rem;     --s-7: 3rem;     --s-8: 4rem;   --s-9: 6rem;

--r-sm:  6px;   /* chip, tag                       */
--r-md:  10px;  /* input, button, small control    */
--r-lg:  14px;  /* nested panel                    */
--r-xl:  18px;  /* card, container — the signature */
--r-2xl: 24px;  /* hero panel, modal               */
--r-full: 999px;/* avatar, dot, pill badge ONLY    */
```

**The radius rule.** 18px on cards is the system's fingerprint — softer than the
12px everyone defaults to, far from pill-shaped. **Radius never exceeds 24px on
a container.** Nested elements step *down* one rung: an 18px card holds a 14px
panel holds a 10px input. Concentric radii that don't step look broken at the
corner, and almost nobody gets this right.

**Density.** App pages use `--s-4` card padding on mobile, `--s-5` desktop.
Marketing uses `--s-7`/`--s-8` section padding. The app breathes less than the
website — on purpose.

---

## 4. Strata (elevation)

Four levels. Each has a fixed surface, border and lift. Nothing may invent a
fifth.

| Level | Use | Surface | Border | Lift |
|---|---|---|---|---|
| **z0** | Resting surface, table row | `--z0` | `--hairline` | none |
| **z1** | Card, panel — the default | `--z1` | `--hairline` | `--lift-1` |
| **z2** | Inset well, code block, active input | `--z2` | `--hairline` | inset |
| **z3** | Modal, popover, command palette, toast | `--z3` | `--hairline` | `--lift-3` |

```css
.stratum {
  background: var(--z1);
  border: 1px solid var(--hairline);
  border-radius: var(--r-xl);
  box-shadow: var(--lift-1);
}

/* Glass is a MATERIAL, not a default. Use only where something scrolls
   beneath: topbar, sidebar, modal scrim, marketing hero panels. */
.glass {
  background: color-mix(in oklch, var(--z1) 72%, transparent);
  backdrop-filter: blur(20px) saturate(1.4);
  border: 1px solid color-mix(in oklch, var(--hairline) 60%, transparent);
}
@supports not (backdrop-filter: blur(1px)) { .glass { background: var(--z1); } }
```

> **Glass discipline.** Frosting everything is the single fastest way to make a
> "futuristic" UI unreadable and slow. `backdrop-filter` forces a repaint of
> everything beneath it — a table of 200 rows behind glass will drop frames on a
> mid-range laptop. Data surfaces are **solid**. Glass is for chrome that floats
> over moving content, and for marketing.

**Hover.** Interactive stratum lifts 2px and gains its section glow:

```css
.stratum--interactive { transition: transform .18s var(--ease), box-shadow .18s var(--ease); }
.stratum--interactive:hover { transform: translateY(-2px); box-shadow: var(--lift-2), var(--bloom); }
```

---

## 5. Motion

```css
--ease:      cubic-bezier(.32, .72, 0, 1);   /* the house curve — decisive     */
--ease-soft: cubic-bezier(.4, 0, .2, 1);     /* symmetric, for color/opacity   */
--ease-out:  cubic-bezier(.16, 1, .3, 1);    /* entrances, overshoot-free      */

--dur-1: 120ms;  /* state flip: hover, focus     */
--dur-2: 200ms;  /* element enter, tab switch    */
--dur-3: 320ms;  /* panel, modal, route change   */
--dur-4: 640ms;  /* data reveal: draw, count-up  */
```

**Principles.**

1. **Motion explains, never entertains.** Every animation answers "where did
   this come from?" or "what changed?" If it answers neither, delete it.
2. **Data draws in; chrome fades in.** Charts animate their path over `--dur-4`;
   numbers count up. Layout chrome just fades — animating chrome is what makes
   an interface feel slow.
3. **Stagger caps at 5.** Sequential reveals use `delay: min(i, 5) * 40ms`. An
   uncapped stagger on a 40-row table takes two seconds and feels broken.
4. **Nothing loops in the work area.** Perpetual motion belongs to marketing and
   to genuine progress indicators, nowhere else.
5. **Exit is half of enter.** Leaving is `--dur-1`; nobody wants to wait to
   dismiss.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important; animation-iteration-count: 1 !important;
    transition-duration: .01ms !important; scroll-behavior: auto !important;
  }
}
```
Reduced motion removes *movement*, not *feedback* — opacity and color changes
stay, so hover and focus still respond.

---

## 6. Elements — HTML & CSS

The contract for every primitive. Structure is as specified; a different DOM
shape is a bug even if it looks the same.

### 6.1 Button

```html
<button class="btn btn--primary" type="submit">
  <svg class="btn__icon" aria-hidden="true">…</svg>
  <span class="btn__label">Run analysis</span>
  <span class="btn__meta">1 of 10 today</span>
</button>
```

```css
.btn {
  --btn-h: 2.5rem;
  display: inline-flex; align-items: center; gap: var(--s-2);
  height: var(--btn-h); padding-inline: var(--s-4);
  border-radius: var(--r-md);
  font: 600 var(--text-base)/1 var(--font-sans);
  letter-spacing: -0.01em;
  cursor: pointer; user-select: none;
  transition: background var(--dur-1) var(--ease-soft),
              transform var(--dur-1) var(--ease),
              box-shadow var(--dur-1) var(--ease);
}
.btn:active { transform: translateY(1px) scale(.99); }
.btn:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
.btn[disabled] { opacity: .5; pointer-events: none; }

/* Primary — the section accent as a lit surface, not a flat fill. */
.btn--primary {
  color: var(--ink-invert);
  background:
    linear-gradient(180deg,
      oklch(from var(--section) calc(l + .06) c h),
      var(--section));
  box-shadow: var(--lift-1), inset 0 1px 0 oklch(1 0 0 / .22);
}
.btn--primary:hover { box-shadow: var(--lift-2), var(--bloom), inset 0 1px 0 oklch(1 0 0 / .28); }

.btn--secondary { background: var(--z1); color: var(--ink); border: 1px solid var(--hairline); }
.btn--secondary:hover { background: var(--z2); border-color: var(--section); }

.btn--ghost { background: transparent; color: var(--ink-muted); }
.btn--ghost:hover { background: var(--section-soft); color: var(--section-ink); }

.btn--danger { background: var(--danger); color: var(--ink-invert); }

.btn__meta { font-size: var(--text-2xs); font-weight: 500; opacity: .75; }
.btn--sm { --btn-h: 2rem; padding-inline: var(--s-3); font-size: var(--text-sm); }
.btn--lg { --btn-h: 3rem; padding-inline: var(--s-5); font-size: var(--text-md); }
```

- Minimum touch target 44px: pad the *hit area*, not the visual box, when `--btn-h` is under 44px.
- Loading state swaps `.btn__icon` for a spinner and sets `aria-busy="true"`;
  **the label never disappears** and the width never changes (reserve it).
- `.btn__meta` is where §2's cost honesty lives — "1 of 10 today" / "Cached · free".

### 6.2 Input & field

```html
<div class="field">
  <label class="field__label" for="domain">Domain</label>
  <div class="field__control">
    <svg class="field__icon" aria-hidden="true">…</svg>
    <input class="field__input" id="domain" type="url"
           placeholder="example.com" aria-describedby="domain-hint">
    <kbd class="field__kbd">⏎</kbd>
  </div>
  <p class="field__hint" id="domain-hint">We'll add https:// if you leave it off.</p>
</div>
```

```css
.field__label {
  display: block; margin-bottom: var(--s-2);
  font: 600 var(--text-xs)/1.4 var(--font-sans);
  letter-spacing: .08em; text-transform: uppercase; color: var(--ink-muted);
}
.field__control {
  display: flex; align-items: center; gap: var(--s-2);
  height: 2.5rem; padding-inline: var(--s-3);   /* matches .btn — see note */
  background: var(--z2);
  border: 1px solid var(--hairline);
  border-radius: var(--r-md);
  transition: border-color var(--dur-1) var(--ease-soft),
              box-shadow  var(--dur-1) var(--ease-soft),
              background  var(--dur-1) var(--ease-soft);
}
.field__control:focus-within {
  background: var(--z0);
  border-color: var(--section);
  box-shadow: 0 0 0 3px var(--section-glow);
}
.field__input {
  flex: 1; min-width: 0; background: none; border: 0; outline: none;
  font: 400 var(--text-base)/1 var(--font-sans); color: var(--ink);
}
.field__input::placeholder { color: var(--ink-faint); }
.field__icon { color: var(--ink-muted); flex-shrink: 0; }
.field__hint { margin-top: var(--s-2); font-size: var(--text-xs); color: var(--ink-muted); }

.field--invalid .field__control { border-color: var(--danger); }
.field--invalid .field__hint    { color: var(--danger); }
```

- The field is **inset (`z2`) at rest and rises to `z0` on focus** — the input
  lifts toward you as you engage it. Small, and nobody does it.
- Error text replaces hint text in the same node, so layout never shifts.
- Never clear a user's input on a validation failure.
- **Height is 2.5rem, matching `.btn`.** An earlier draft specced 2.75rem, which
  is fine in isolation but misaligns against the button it sits beside in every
  analysis form. Controls that share a row share a height — the spec serves the
  layout, not the other way round.

### 6.3 Card

```html
<article class="card" data-module="audit">
  <header class="card__head">
    <span class="card__chip"><svg aria-hidden="true">…</svg></span>
    <div>
      <h3 class="card__title">Site health</h3>
      <p class="card__sub">Across 340 crawled pages</p>
    </div>
    <button class="btn btn--ghost btn--sm">Export</button>
  </header>
  <div class="card__body">…</div>
  <footer class="card__foot">
    <span class="badge badge--cache">Cached · free</span>
  </footer>
</article>
```

```css
.card {
  background: var(--z1);
  border: 1px solid var(--hairline);
  border-radius: var(--r-xl);
  box-shadow: var(--lift-1);
  overflow: clip;               /* clip, not hidden — keeps focus rings usable */
}
.card__head {
  display: flex; align-items: flex-start; gap: var(--s-3);
  padding: var(--s-5) var(--s-5) var(--s-4);
}
.card__head > div { flex: 1; min-width: 0; }
.card__chip {
  display: grid; place-items: center;
  width: 2.5rem; height: 2.5rem; border-radius: var(--r-md);
  background: var(--section-soft); color: var(--section-ink);
}
/* --text-lg on marketing/standalone cards; --text-md in dense data grids,
   where 18px titles crowd the metrics they're supposed to label. The shared
   <CardTitle> primitive ships at --text-md for that reason. */
.card__title { font: 600 var(--text-md)/1.3 var(--font-sans); letter-spacing: -.01em; }
.card__sub   { margin-top: 2px; font-size: var(--text-xs); color: var(--ink-muted); }
.card__body  { padding: 0 var(--s-5) var(--s-5); }
.card__foot  {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--s-3) var(--s-5);
  border-top: 1px solid var(--hairline);
  background: var(--z2);
}
/* Each card adopts its module's accent from the data attribute. */
[data-module="research"] { --section: var(--acc-research); }
[data-module="audit"]    { --section: var(--acc-audit); }
[data-module="optimize"] { --section: var(--acc-optimize); }
[data-module="track"]    { --section: var(--acc-track); }
[data-module="manage"]   { --section: var(--acc-manage); }
[data-module="tools"]    { --section: var(--acc-tools); }
```

### 6.4 Metric card — where the thesis shows

```html
<div class="metric" style="--v:.86">
  <span class="metric__label">Visibility score</span>
  <strong class="metric__value">86</strong>
  <span class="metric__delta metric__delta--up">
    <svg aria-hidden="true">▲</svg> 12 <span class="sr-only">increase</span>
  </span>
  <svg class="metric__spark" aria-hidden="true">…</svg>
</div>
```

```css
.metric { position: relative; padding: var(--s-5); border-radius: var(--r-xl);
          background: var(--z1); border: 1px solid var(--hairline); }

/* Luminance = meaning. The value's brightness IS the metric. */
.metric__value {
  display: block; margin-block: var(--s-2);
  font: 700 var(--text-metric)/1 var(--font-sans);
  letter-spacing: -.02em; font-variant-numeric: tabular-nums;
  color: oklch(calc(.30 + .58 * var(--v)) .13 calc(268deg - 78deg * var(--v)));
}
/* A high value emits light onto its own card. */
.metric::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit;
  pointer-events: none; opacity: calc(var(--v) * .5);
  background: radial-gradient(120% 80% at 50% 0%, var(--section-glow), transparent 70%);
}
.metric__label { font: 600 var(--text-xs)/1.4 var(--font-sans);
                 letter-spacing: .08em; text-transform: uppercase; color: var(--ink-muted); }
.metric__delta { display: inline-flex; align-items: center; gap: var(--s-1);
                 font: 600 var(--text-xs)/1 var(--font-sans); }
.metric__delta--up   { color: var(--success); }
.metric__delta--down { color: var(--danger); }
```

The delta carries **an arrow glyph and a screen-reader word**, never color alone.

### 6.5 Table

```html
<div class="table-wrap">
  <table class="table">
    <thead><tr>
      <th scope="col" aria-sort="ascending">
        <button class="table__sort">Position <svg aria-hidden="true">↑</svg></button>
      </th>
      <th scope="col" class="table__num">Volume</th>
    </tr></thead>
    <tbody>
      <tr><td><span class="rank" style="--v:.95">1</span></td>
          <td class="table__num">12,400</td></tr>
    </tbody>
  </table>
</div>
```

```css
.table-wrap { overflow-x: auto; border-radius: var(--r-xl);
              border: 1px solid var(--hairline); background: var(--z1); }
.table { width: 100%; border-collapse: separate; border-spacing: 0;
         font-size: var(--text-sm); font-variant-numeric: tabular-nums; }
.table thead th {
  position: sticky; top: 0; z-index: 1;
  padding: var(--s-3) var(--s-4); text-align: left;
  font: 600 var(--text-xs)/1.4 var(--font-sans);
  letter-spacing: .06em; text-transform: uppercase; color: var(--ink-muted);
  background: var(--z2); border-bottom: 1px solid var(--hairline);
  white-space: nowrap;
}
.table tbody td { padding: var(--s-3) var(--s-4); border-bottom: 1px solid var(--hairline); }
.table tbody tr:last-child td { border-bottom: 0; }
.table tbody tr { transition: background var(--dur-1) var(--ease-soft); }
.table tbody tr:hover { background: var(--section-soft); }
.table__num { text-align: right; }

/* Rank cell — position rendered as light. #1 glows, #90 is nearly dark. */
.rank {
  display: inline-grid; place-items: center;
  min-width: 1.75rem; height: 1.75rem; padding-inline: var(--s-2);
  border-radius: var(--r-sm); font-weight: 700;
  color: oklch(calc(.30 + .58*var(--v)) .13 calc(268deg - 78deg*var(--v)));
  background: oklch(from currentColor l c h / .12);
}
```

**No zebra striping.** Hairlines and generous padding separate rows; stripes are
a crutch that fights the elevation system. First column sticks on overflow.

### 6.6 Badge

```css
.badge {
  display: inline-flex; align-items: center; gap: var(--s-1);
  padding: 3px var(--s-2); border-radius: var(--r-full);
  font: 600 var(--text-2xs)/1.4 var(--font-sans);
  border: 1px solid transparent;
}
.badge--neutral { background: var(--z2); color: var(--ink-muted); border-color: var(--hairline); }
.badge--success { background: oklch(from var(--success) l c h / .12); color: var(--success); }
.badge--warning { background: oklch(from var(--warning) l c h / .14); color: oklch(from var(--warning) .45 c h); }
.badge--danger  { background: oklch(from var(--danger)  l c h / .12); color: var(--danger); }
.badge--cache   { background: var(--section-soft); color: var(--section-ink); }
```
Every badge carries an icon or a word — never color as the sole signal.

### 6.7 Navigation item

```css
.nav__item {
  display: flex; align-items: center; gap: var(--s-3);
  padding: var(--s-2) var(--s-3); border-radius: var(--r-md);
  font: 500 var(--text-base)/1 var(--font-sans); color: var(--ink-muted);
  position: relative;
  transition: background var(--dur-1) var(--ease-soft), color var(--dur-1) var(--ease-soft);
}
.nav__item:hover { background: var(--section-soft); color: var(--section-ink); }
.nav__item[aria-current="page"] {
  background: var(--section-soft); color: var(--section-ink); font-weight: 650;
}
/* Active rail — the light source for the current module. */
.nav__item[aria-current="page"]::before {
  content: ""; position: absolute; left: -10px; top: 50%; translate: 0 -50%;
  width: 3px; height: 60%; border-radius: var(--r-full);
  background: var(--section); box-shadow: 0 0 12px var(--section-glow);
}
```

### 6.8 Focus — one ring, everywhere

```css
:where(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
  border-radius: var(--r-sm);
}
```
Never `outline: none` without an equivalent replacement. The ring uses the live
`--section`, so focus is always visible against the current module's palette.

---

## 7. Accessibility floor

Non-negotiable, and checked before any screen ships.

| Rule | Threshold |
|---|---|
| Body text contrast | ≥ 4.5:1 |
| Large text (≥18.66px bold / 24px) & UI components | ≥ 3:1 |
| Module accent on small text | **forbidden in light mode** — use `--section-ink` |
| Touch target | ≥ 44 × 44px |
| Focus indicator | visible, ≥ 3:1 against adjacent colors |
| Meaning by color alone | never — always icon or text too |
| Motion | fully degrades under `prefers-reduced-motion` |
| Async result | announced via `aria-live="polite"` |

The verified numbers for this palette: light mode ink 17.2:1, muted 5.8:1,
primary 4.7:1. Dark mode ink 17.2:1, muted 7.7:1, primary 10.5:1. Module accents
3.4–3.9:1 light (UI only) and 7.7–8.6:1 dark.

---

## 8. What makes this system *this* product's

If you strip Aperture down to what could not be transplanted into another SaaS:

1. **Luminance encodes visibility.** The one metric this product sells is
   rendered as the one thing screens actually emit. A rank, a citation rate and
   a health score all read as brightness before they read as digits.
2. **The palette is the logo, resolved.** The spectrum isn't harmonised with the
   brand blue — it passes through it. `--signal-2` *is* `#1d7dbd` in OKLCH.
3. **Optically equal accents.** Six modules at identical L and C means the
   sidebar has six colors and zero hierarchy accidents.
4. **Inverted depth in dark mode.** Light mode uses shadow; dark mode uses glow
   and *raises* lightness with elevation. Most systems just darken everything and
   lose the depth cue entirely.
5. **Inputs that rise toward you on focus** (z2 → z0), so engagement is physical.
6. **Glass as a rationed material**, restricted to chrome over moving content —
   which is why the data stays legible and the tables stay at 60fps.

**Honest framing:** none of these six is unprecedented in isolation — OKLCH
palettes, glass chrome and glow elevation all exist in the wild. What no other
product has is the *combination bound to this subject*: a design system where the
visual variable and the business metric are the same thing. That coherence is
what reads as "designed by someone who understood the product," and it's a far
more durable advantage than novelty for its own sake.

---

## 9. Migration path

This system is a **specification, not a merge**. Adopting it is a deliberate
project, and it will change every screen. Suggested order:

1. **Tokens first** — replace the `:root`/`.dark` blocks in `src/index.css` and
   map them in `tailwind.config.ts`. Most of the app re-themes for free, because
   components already read `--section`, `--surface`, `--text`.
2. **Verify both themes** on Dashboard, a data-heavy page (SERP), and a
   marketing page before touching any component.
3. **Primitives** — `button.tsx`, `input.tsx`, `card.tsx`, `badge.tsx` to the §6
   contracts.
4. **The thesis** — `StatCard`, `ScoreGauge` and rank cells adopt the
   luminance mapping. This is the step people will *notice*.
5. **Chrome** — sidebar, topbar, command palette.
6. **Marketing** last; it has the most bespoke CSS and the least reuse.

Ship 1–2 behind a branch and compare side by side. If the palette swap alone
doesn't already look like a different product, something is reading a hardcoded
hex — find it.
