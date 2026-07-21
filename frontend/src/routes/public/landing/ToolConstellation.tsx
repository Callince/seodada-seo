import { NAV_ITEMS } from "@/lib/nav";

/**
 * The hero's right-hand visual: every tool in the platform as a blip on a
 * tilted tactical radar, with a sweep beam that flares each blip as it
 * passes. Radar is the product's own metaphor — continuous monitoring of
 * everything on the board — where the previous Saturn orbit was only
 * decoration. All 24 blips come from NAV_ITEMS so the display can never
 * drift from the sidebar; decorative to assistive tech (one labelled image),
 * since the tools are named in text further down the page.
 *
 * Geometry: blips sit at golden-angle bearings (i·137.508°) so no two share
 * a spoke and no sector clusters, on three range rings cycled by index.
 * Deterministic — no Math.random — so the prerendered markup matches the
 * client's byte for byte.
 *
 * The flare timing is phase-locked to the sweep (see index.css): both read
 * one --sweep clock and each blip's negative delay equals its bearing's
 * fraction of a revolution. Bearings are measured from 12 o'clock clockwise
 * BECAUSE that is where a conic-gradient starts — the beam and the maths
 * must agree on zero or every ping fires early by the offset.
 */

/** Dish tilt. 0° = face-on circle, 90° = edge-on line. Shallower than the old
 *  Saturn rings (64°): a radar reads as a DISPLAY, and past ~55° the icons
 *  crowd each other at the ellipse's waist. */
const TILT = 52;

/** One sweep revolution, seconds. Shared by beam and every ping. */
const SWEEP_S = 9;

/** Range rings, inner→outer. Radii in the 520px stage's coordinate system. */
const RANGE = [98, 152, 206];

const GOLDEN = 137.508;

/** Blip layout: bearing from 12 o'clock (conic-gradient zero), range ring by
 *  index cycle. Both derived from the index alone — stable across renders. */
const BLIPS = NAV_ITEMS.map((item, i) => ({
  ...item,
  bearing: +((i * GOLDEN) % 360).toFixed(2),
  radius: RANGE[i % RANGE.length],
}));

export function ToolConstellation() {
  return (
    <div
      className="relative mx-auto grid aspect-square w-full max-w-[520px] place-items-center select-none"
      role="img"
      aria-label="The seodada platform — 24 SEO tools under continuous watch, from research to AI visibility"
      // Cursor parallax, unchanged from the previous design: CSS vars only, no
      // re-renders, gated on prefers-reduced-motion.
      onMouseMove={(e) => {
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const r = e.currentTarget.getBoundingClientRect();
        const dx = (e.clientX - r.left) / r.width - 0.5;
        const dy = (e.clientY - r.top) / r.height - 0.5;
        e.currentTarget.style.setProperty("--tilt-y", `${(dx * 10).toFixed(2)}deg`);
        e.currentTarget.style.setProperty("--tilt-x", `${(-dy * 8).toFixed(2)}deg`);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.setProperty("--tilt-y", "0deg");
        e.currentTarget.style.setProperty("--tilt-x", "0deg");
      }}
    >
      {/* Ambient bloom so the dish reads as lit instrumentation. */}
      <div
        aria-hidden
        className="absolute inset-10 -z-10 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 40%, color-mix(in srgb, var(--hero-tide) 45%, transparent), transparent 70%)",
        }}
      />

      <div
        aria-hidden
        className="[--sat-scale:0.56] sm:[--sat-scale:0.76] lg:[--sat-scale:1]"
        style={{ perspective: "1100px", transform: "scale(var(--sat-scale))", transformStyle: "preserve-3d" }}
      >
        <div
          className="relative grid h-[520px] w-[520px] place-items-center [transition:transform_600ms_cubic-bezier(.32,.72,0,1)]"
          style={{
            transform: "rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))",
            transformStyle: "preserve-3d",
          }}
        >
          {/* The dish plane — everything on the radar surface tilts together. */}
          <div
            className="absolute inset-0"
            style={{ transform: `rotateX(${TILT}deg)`, transformStyle: "preserve-3d" }}
          >
            {/* Dish face + range rings + crosshairs. */}
            <div
              className="absolute inset-[24px] rounded-full border"
              style={{
                borderColor: "color-mix(in srgb, var(--hero-glow) 22%, transparent)",
                background:
                  "radial-gradient(circle, color-mix(in srgb, var(--hero-mid) 55%, transparent) 0%, color-mix(in srgb, var(--hero-deep) 70%, transparent) 78%)," +
                  "repeating-radial-gradient(circle, transparent 0 53px, color-mix(in srgb, var(--hero-glow) 13%, transparent) 53px 54px)",
                boxShadow: "inset 0 0 60px color-mix(in srgb, var(--hero-glow) 10%, transparent)",
              }}
            />
            {[0, 90].map((deg) => (
              <div
                key={deg}
                className="absolute left-1/2 top-1/2 h-[464px] w-px -translate-x-1/2 -translate-y-1/2"
                style={{
                  transform: `translate(-50%,-50%) rotate(${deg}deg)`,
                  background: "color-mix(in srgb, var(--hero-glow) 14%, transparent)",
                }}
              />
            ))}

            {/* The sweep beam: a soft 70° trail ending at the leading edge.
                Conic zero is 12 o'clock — the blips' bearing zero, by design. */}
            <div
              className="radar-sweep absolute inset-[24px] rounded-full"
              style={{
                ["--sweep" as string]: `${SWEEP_S}s`,
                background:
                  "conic-gradient(from -70deg, transparent 0deg, color-mix(in srgb, var(--hero-glow) 26%, transparent) 62deg, color-mix(in srgb, var(--hero-glow) 55%, transparent) 69deg, transparent 70deg)",
              }}
            />

            {/* Blips. Positioned on the dish, billboarded upright. */}
            {BLIPS.map(({ to, label, icon: Icon, bearing, radius }) => {
              const rad = (bearing * Math.PI) / 180;
              const x = Math.sin(rad) * radius;
              const y = -Math.cos(rad) * radius;
              return (
                <div
                  key={to}
                  className="absolute left-1/2 top-1/2"
                  style={{
                    transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`,
                    transformStyle: "preserve-3d",
                  }}
                >
                  {/* Counter-tilt so the icon faces the viewer, not the dish. */}
                  <div style={{ transform: `rotateX(${-TILT}deg)` }}>
                    <div
                      className="radar-ping grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl border backdrop-blur-md"
                      style={{
                        ["--sweep" as string]: `${SWEEP_S}s`,
                        // ((bearing/360) − 1)·sweep: negative, so the cycle is
                        // already at this bearing's phase on the first frame.
                        animationDelay: `${(((bearing / 360) - 1) * SWEEP_S).toFixed(2)}s`,
                        borderColor: "color-mix(in srgb, var(--hero-glow) 38%, transparent)",
                        background:
                          "linear-gradient(150deg, color-mix(in srgb, var(--hero-tide) 30%, transparent), color-mix(in srgb, #0f1c33 80%, transparent))",
                        color: "var(--hero-glow)",
                      }}
                    >
                      <Icon size={17} strokeWidth={1.9} aria-hidden />
                      <span className="sr-only">{label}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hub — the logo as the radar station, facing front. */}
          <div className="relative grid place-items-center" style={{ transform: "translateZ(0)" }}>
            <div
              className="absolute h-24 w-24 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 34% 28%, var(--grad-b) 0%, var(--grad-a) 55%, color-mix(in srgb, var(--grad-a) 55%, #060c1a) 100%)",
                boxShadow:
                  "0 0 0 1px color-mix(in srgb, var(--hero-glow) 30%, transparent), 0 14px 40px -12px rgba(0,0,0,0.7), 0 0 34px -6px color-mix(in srgb, var(--hero-glow) 40%, transparent)",
              }}
            />
            <img
              src="/content-assets/logo_1761200794.png"
              alt=""
              width={202}
              height={54}
              className="relative w-[104px] max-w-none drop-shadow-[0_4px_14px_rgba(0,0,0,0.7)]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
