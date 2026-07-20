import { type ReactNode } from "react";

/**
 * Shared dark, futuristic hero for every public page — the same treatment as
 * the landing hero: a deep navy→ocean surface, drifting aurora pools, floating
 * neon orbs, a panning perspective grid, a blur-in reveal, and a flowing
 * gradient headline. The nav floats transparently over it (see PublicShell).
 */
export function PublicHero({
  eyebrow,
  title,
  highlight,
  subtitle,
  children,
  compact = false,
  align = "center",
  normalCase = false,
}: {
  eyebrow?: ReactNode;
  /** Main heading text (may contain <br/>). */
  title: ReactNode;
  /** Optional trailing phrase rendered in the flowing gradient. */
  highlight?: string;
  subtitle?: ReactNode;
  /** Extra content below the subtitle (actions, chips, meta). */
  children?: ReactNode;
  /** Shorter hero for article/content pages. */
  compact?: boolean;
  align?: "center" | "left";
  /** Article titles read better in sentence case than uppercase. */
  normalCase?: boolean;
}) {
  const alignCls =
    align === "center" ? "items-center text-center" : "items-start text-left";
  const titleCls = normalCase
    ? "font-semibold tracking-tight"
    : "font-light uppercase tracking-[0.1em] sm:tracking-[0.13em]";

  return (
    <div className="cyber-grid grid-drift relative overflow-hidden">
      {/* Deep navy → ocean 3D surface (seodada brand), no photo. */}
      <div
        className="absolute inset-0 -z-20"
        style={{ background: "linear-gradient(180deg,var(--hero-deep) 0%,var(--hero-mid) 46%,var(--hero-rim) 100%)" }}
      />
      {/* Aurora light pools — slowly drifting. */}
      <div
        className="aurora-drift absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(70% 60% at 50% 118%, rgba(34,195,238,0.38), transparent 62%)," +
            "radial-gradient(46% 42% at 12% 4%, rgba(39,56,121,0.55), transparent 60%)," +
            "radial-gradient(42% 40% at 90% 8%, rgba(15,116,178,0.42), transparent 60%)",
        }}
      />
      {/* Floating neon orbs. */}
      <div
        className="float-slow absolute right-[-8%] top-[16%] -z-10 h-72 w-72 rounded-full opacity-50 blur-3xl"
        style={{ background: "conic-gradient(from 130deg,var(--hero-wash),var(--hero-tide),var(--hero-glow),var(--hero-wash))" }}
      />
      <div
        className="float-slower absolute left-[-6%] top-[48%] -z-10 h-56 w-56 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle,var(--hero-glow),transparent 70%)" }}
      />
      {/* Bottom vignette so the following light section reads cleanly.
          The end stop is a color-mix, NOT `to-[var(--hero-deep)]/80`: an
          opacity modifier on an arbitrary var() silently produces nothing, and
          this gradient had been computing to transparent→transparent — no
          vignette at all — on every page using PublicHero. Tailwind can apply
          `/80` to a *function* result but not to a bare custom property. */}
      <div className="absolute inset-x-0 bottom-0 -z-10 h-1/3 bg-gradient-to-b from-transparent to-[color-mix(in_srgb,var(--hero-deep)_80%,transparent)]" />

      <section
        className={`mx-auto flex w-full max-w-5xl flex-col px-4 sm:px-6 ${alignCls} ${
          compact ? "pt-28 pb-14 sm:pt-32" : "pt-32 pb-24 sm:pt-40 sm:pb-28"
        }`}
      >
        {eyebrow && (
          <p className="blur-in text-[11px] font-medium uppercase tracking-[0.3em] text-white/70 sm:text-xs">
            {eyebrow}
          </p>
        )}
        <h1
          className={`blur-in mt-6 text-4xl leading-[1.12] text-white sm:text-5xl ${titleCls}`}
          style={{ animationDelay: "0.1s" }}
        >
          {title}
          {highlight && (
            <>
              {" "}
              <span className="gradient-text-anim font-semibold">{highlight}</span>
            </>
          )}
        </h1>
        {subtitle && (
          <p
            className="blur-in mt-6 max-w-2xl text-base text-white/70 sm:text-lg"
            style={{ animationDelay: "0.2s" }}
          >
            {subtitle}
          </p>
        )}
        {children && (
          <div className="blur-in mt-8 w-full" style={{ animationDelay: "0.3s" }}>
            {children}
          </div>
        )}
      </section>
    </div>
  );
}
