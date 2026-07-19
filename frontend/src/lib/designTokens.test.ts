import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import tailwindConfig from "../../tailwind.config";

/**
 * Guards the Aperture invariants (docs/DESIGN_SYSTEM.md).
 *
 * Every bug this file protects against shipped clean through `tsc`, `eslint`
 * AND `vite build` — they are CSS-level failures that only show up in rendered
 * output. That is exactly why they need asserting here.
 */

// vitest runs from the frontend package root; import.meta.url is not a file
// URL under the vite transform, so resolve from cwd instead.
// Comments are stripped FIRST. The token docs contain prose like
// "…measure 3.4-3.9:1 on --surface: fine for icons…", which a naive
// `--name: value;` regex reads as a declaration whose greedy value then
// swallows the next real token.
// vitest runs from the frontend package root.
const css = readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

/** Pull a `--name: value;` pair out of a specific CSS block. */
function tokensIn(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`no ${selector} block in index.css`);
  // First closing brace at column 0 ends the block.
  const end = css.indexOf("\n}", start);
  const body = css.slice(start, end);
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

const light = tokensIn(":root");
const dark = tokensIn(".dark");

// ---------------------------------------------------------------- colour math

function srgbToLin(c: number) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "").trim();
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
}

function contrast(fg: string, bg: string) {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

/** sRGB hex -> OKLCH lightness. Used to assert the spectrum + accent bands. */
function oklchL(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const [lr, lg, lb] = [srgbToLin(r), srgbToLin(g), srgbToLin(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}

const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

// -------------------------------------------------------------------- the spec

describe("Signal Spectrum", () => {
  const stops = [0, 1, 2, 3, 4, 5].map((i) => `--signal-${i}`);

  it("is monotonically brighter from buried to visible, in both themes", () => {
    for (const [name, set] of [["light", light], ["dark", dark]] as const) {
      const ls = stops.map((s) => oklchL(set[s]));
      for (let i = 1; i < ls.length; i++) {
        expect(ls[i], `${name} ${stops[i]} must be lighter than ${stops[i - 1]}`)
          .toBeGreaterThan(ls[i - 1]);
      }
    }
  });

  it("passes through the brand blue at --signal-2", () => {
    // The palette was derived FROM the logo, not harmonised around it. If this
    // drifts, the "brand is the midpoint of the ramp" claim is no longer true.
    expect(oklchL(light["--signal-2"])).toBeCloseTo(0.54, 1);
  });
});

describe("module accents", () => {
  const modules = [
    "keywords", "serp", "domains", "competitors", "local", "audit", "onpage",
    "content", "report", "rank", "backlinks", "aivis", "schedules", "manage",
    "tools", "admin",
  ];

  it("share one lightness band so none out-shouts another", () => {
    // §1.3: only hue varies. A stray accent at a different L breaks the
    // "equal optical weight" property the sidebar depends on.
    for (const [themeName, set, target] of [
      ["light", light, 0.62],
      ["dark", dark, 0.74],
    ] as const) {
      for (const m of modules) {
        const v = set[`--sec-${m}`];
        if (!v || !isHex(v)) continue; // dark inherits some from :root
        expect(oklchL(v), `${themeName} --sec-${m}`).toBeCloseTo(target, 1);
      }
    }
  });

  it("every accent has a text-safe -ink variant that clears 4.5:1", () => {
    // The bug this catches: using --section for small text. Raw accents sit at
    // ~3.4-3.9:1 on white, which is why --section-ink exists at all.
    const surface = light["--surface"];
    for (const m of modules) {
      const ink = light[`--sec-${m}-ink`];
      expect(ink, `--sec-${m}-ink must be defined`).toBeTruthy();
      expect(contrast(ink, surface), `--sec-${m}-ink on --surface`)
        .toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("core + state tokens", () => {
  it("body and muted text clear 4.5:1 on the canvas, both themes", () => {
    for (const [name, set] of [["light", light], ["dark", dark]] as const) {
      expect(contrast(set["--text"], set["--app-bg"]), `${name} --text`)
        .toBeGreaterThanOrEqual(4.5);
      expect(contrast(set["--text-muted"], set["--app-bg"]), `${name} --text-muted`)
        .toBeGreaterThanOrEqual(4.5);
    }
  });

  it("state -ink variants clear 4.5:1 where the base colours do not", () => {
    const surface = light["--surface"];
    for (const s of ["success", "warning", "danger"]) {
      expect(contrast(light[`--${s}-ink`], surface), `--${s}-ink`)
        .toBeGreaterThanOrEqual(4.5);
    }
  });

  it("--ring stays an rgb triplet, not a hex", () => {
    // tailwind.config wraps it as `rgb(var(--ring) / <alpha-value>)`. Emitting
    // a hex here silently kills every focus ring in the app.
    for (const set of [light, dark]) {
      expect(set["--ring"]).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
    }
  });
});

describe("tailwind token colours", () => {
  // Reaches the same function the config exports for e.g. `bg-success`.
  const colors = tailwindConfig.theme?.extend?.colors as Record<string, unknown>;
  const resolve = (c: unknown, opacityValue?: string) =>
    typeof c === "function" ? (c as (o: { opacityValue?: string }) => string)({ opacityValue }) : c;

  it("emits the raw token for a base utility", () => {
    // Tailwind passes `var(--tw-bg-opacity)` (NOT undefined) for base
    // utilities. Number() on that is NaN; an unguarded implementation built
    // `color-mix(… NaN% …)` and made EVERY base colour utility transparent.
    expect(resolve(colors.surface, "var(--tw-bg-opacity)")).toBe("var(--surface)");
    expect(resolve(colors.surface, undefined)).toBe("var(--surface)");
    expect(resolve((colors.success as Record<string, unknown>).DEFAULT, "var(--tw-bg-opacity)"))
      .toBe("var(--success)");
  });

  it("emits a color-mix for a numeric opacity modifier", () => {
    // Without this, `bg-success/10` generated no rule at all — a fully
    // transparent background that looked like a styling choice.
    expect(resolve((colors.success as Record<string, unknown>).DEFAULT, "0.1"))
      .toBe("color-mix(in srgb, var(--success) 10%, transparent)");
    expect(resolve(colors.border, "0.6"))
      .toBe("color-mix(in srgb, var(--border) 60%, transparent)");
  });

  it("keeps --ring on the alpha-capable rgb form", () => {
    expect(colors.ring).toBe("rgb(var(--ring) / <alpha-value>)");
  });
});
