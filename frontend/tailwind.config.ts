import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "app-bg": "var(--app-bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        text: {
          DEFAULT: "var(--text)",
          muted: "var(--text-muted)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          soft: "var(--primary-soft)",
          // Text-safe variant — use for small text on tinted surfaces.
          ink: "var(--primary-ink)",
        },
        accent: "var(--accent)",
        success: { DEFAULT: "var(--success)", ink: "var(--success-ink)" },
        warning: { DEFAULT: "var(--warning)", ink: "var(--warning-ink)" },
        danger: { DEFAULT: "var(--danger)", ink: "var(--danger-ink)" },
        info: "var(--info)",
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
