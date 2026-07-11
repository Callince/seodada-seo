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
        },
        accent: "var(--accent)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        info: "var(--info)",
        ring: "rgb(var(--ring) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        // Premium SaaS scale — large, soft corners (cards at 20px).
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
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
