import type { Config } from "tailwindcss";

/**
 * Token colour that also supports Tailwind's `/opacity` modifier.
 *
 * A plain `"var(--x)"` string CANNOT take an opacity modifier: Tailwind has
 * nowhere to inject the alpha, so it emits no rule at all and the utility
 * silently does nothing — `bg-success/10` rendered a fully transparent
 * background, and `text-text-muted/80` fell back to inheriting near-black.
 * Returning a function lets Tailwind hand us the alpha, which we apply with
 * color-mix so every `token/NN` utility works.
 */
/** The opacity-aware colour value Tailwind actually accepts at runtime. */
export type TokenColor = ({ opacityValue }: { opacityValue?: string }) => string;

const token =
  (name: string): TokenColor =>
  ({ opacityValue }) => {
    // For a BASE utility (`bg-success`) Tailwind passes the CSS variable
    // `var(--tw-bg-opacity)` here, not undefined — Number() on that is NaN,
    // which yields `color-mix(… NaN% …)` and silently kills the colour. Only
    // build a color-mix for a real numeric alpha; otherwise emit the raw token.
    const alpha = Number(opacityValue);
    return opacityValue === undefined || Number.isNaN(alpha)
      ? `var(--${name})`
      : `color-mix(in srgb, var(--${name}) ${alpha * 100}%, transparent)`;
  };

// Tailwind supports function colour values at runtime, but its `colors` type
// only admits `string | RecursiveKeyValuePair`. The cast is the documented
// escape hatch — without it `tsc -b` fails the whole build.
const tok = (name: string) => token(name) as unknown as string;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "app-bg": tok("app-bg"),
        surface: tok("surface"),
        "surface-2": tok("surface-2"),
        border: tok("border"),
        text: {
          DEFAULT: tok("text"),
          muted: tok("text-muted"),
        },
        primary: {
          DEFAULT: tok("primary"),
          soft: tok("primary-soft"),
          // Text-safe variant — use for small text on tinted surfaces.
          ink: tok("primary-ink"),
        },
        accent: tok("accent"),
        success: { DEFAULT: tok("success"), ink: tok("success-ink") },
        warning: { DEFAULT: tok("warning"), ink: tok("warning-ink") },
        danger: { DEFAULT: tok("danger"), ink: tok("danger-ink") },
        info: tok("info"),
        // Already alpha-capable via the rgb-triplet form.
        ring: "rgb(var(--ring) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        // Aperture scale (DESIGN_SYSTEM §3). Rungs step down when nested:
        // an 18px card holds a 14px panel holds a 10px control.
        md: "var(--r-md)",    /* 10px — input, button        */
        lg: "var(--r-lg)",    /* 14px — nested panel         */
        xl: "var(--r-xl)",    /* 18px — card, the signature  */
        "2xl": "var(--r-2xl)",/* 24px — hero panel, modal    */
      },
      boxShadow: {
        // Soft, neutral elevation (kept gentle for the rounded soft-UI feel).
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        md: "0 6px 18px -6px rgb(0 0 0 / 0.10)",
        lg: "0 16px 40px -12px rgb(15 16 48 / 0.18)",
        glow: "0 0 0 1px color-mix(in srgb, var(--primary) 20%, transparent), 0 12px 32px -8px color-mix(in srgb, var(--primary) 35%, transparent)",
      },
      keyframes: {
        "fade-rise": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-rise": "fade-rise 0.2s ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
