import { NAV_ITEMS } from "@/lib/nav";
import { moduleForSection, sectionVars } from "@/lib/sections";

/**
 * The hero's right-hand visual: every tool in the platform as a floating 3D
 * constellation.
 *
 * Replaces the old dashboard mock. The mock showed one screen of invented
 * numbers; this shows the actual surface area of the product — all 24 tools,
 * each in its real workflow colour, drawn from NAV_ITEMS so it can never drift
 * from the sidebar.
 *
 * The 3D is a single rotated plane with per-tile depth rather than 24
 * individually transformed elements: one composited layer, so it stays cheap.
 * Decorative — the tools are named in text further down the page, so the whole
 * thing is hidden from assistive tech rather than read out as 24 stray words.
 */

/**
 * Deterministic depth — no Math.random, so it never jitters between renders.
 * Eight values over a 4-column grid means the pattern repeats every two rows,
 * which reads as a wave rather than noise. (An earlier `(i*5 + i%3) % 6`
 * collapsed to almost all zeros and flattened the whole plane.)
 */
const DEPTH = [10, 52, 24, 68, 34, 58, 16, 44];
const depthFor = (i: number) => DEPTH[i % DEPTH.length];

/**
 * Four motions, not one. A single keyframe at staggered delays still reads as
 * one mechanism — 24 tiles bobbing identically looks like a skeleton loader.
 * The cycle length (4) is coprime with neither 5 (columns) nor 8 (depths), so
 * motion, depth and grid position never line up into a visible pattern.
 */
const MOTION = ["tile-rise", "tile-drift", "tile-sway", "tile-breathe"] as const;
const motionFor = (i: number) => MOTION[i % MOTION.length];

export function ToolConstellation() {
  return (
    <div
      className="relative select-none"
      role="img"
      aria-label="The seodada platform — 24 SEO tools across research, audit, optimization and tracking"
    >
      {/* Ambient bloom behind the plane so the tiles read as lit, not pasted on. */}
      <div
        aria-hidden
        className="absolute inset-6 -z-10 blur-3xl"
        style={{
          background:
            "radial-gradient(60% 60% at 30% 20%, color-mix(in srgb, var(--hero-tide) 55%, transparent), transparent 70%)," +
            "radial-gradient(55% 55% at 75% 75%, color-mix(in srgb, var(--hero-glow) 40%, transparent), transparent 70%)",
        }}
      />

      <div
        aria-hidden
        style={{ perspective: "1200px", perspectiveOrigin: "60% 40%" }}
        // The second kind of motion: the plane answers the cursor instead of
        // only looping. Ambient float alone reads as decoration; parallax makes
        // the cluster feel like an object in the page. Written to CSS vars so
        // the transform below stays declarative and React never re-renders.
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const dx = (e.clientX - r.left) / r.width - 0.5;
          const dy = (e.clientY - r.top) / r.height - 0.5;
          e.currentTarget.style.setProperty("--tilt-y", `${dx * 14}deg`);
          e.currentTarget.style.setProperty("--tilt-x", `${-dy * 12}deg`);
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.setProperty("--tilt-y", "0deg");
          e.currentTarget.style.setProperty("--tilt-x", "0deg");
        }}
      >
        <div
          // 5 columns keeps the cluster roughly square against the hero copy;
          // 4 made it ~870px tall, nearly the full viewport.
          className="grid grid-cols-5 gap-3 [transition:transform_500ms_cubic-bezier(.32,.72,0,1)]"
          style={{
            transform:
              "rotateX(calc(16deg + var(--tilt-x, 0deg))) rotateY(calc(-17deg + var(--tilt-y, 0deg))) rotateZ(4deg)",
            transformStyle: "preserve-3d",
          }}
        >
          {NAV_ITEMS.map(({ to, label, icon: Icon, section }, i) => (
            // Depth and float are split across two elements ON PURPOSE:
            // `.lp-float` animates `transform`, so putting translateZ on the
            // same node let the animation overwrite it and the whole 3D
            // flattened to a 2D matrix. Outer holds depth, inner breathes.
            <div
              key={to}
              style={{
                ...sectionVars(moduleForSection(section)),
                transform: `translateZ(${depthFor(i)}px)`,
                transformStyle: "preserve-3d",
              }}
            >
              <div
                className={`${motionFor(i)} grid aspect-square place-items-center rounded-2xl border backdrop-blur-md`}
                style={{
                  // Delay uses a 7-step cycle against 4 motions and 5 columns,
                  // so neighbours never share both motion and phase.
                  animationDelay: `${(i % 7) * 0.55}s`,
                  borderColor: "color-mix(in srgb, var(--section) 34%, transparent)",
                  background:
                    "linear-gradient(150deg, color-mix(in srgb, var(--section) 22%, transparent), color-mix(in srgb, #0f1c33 70%, transparent))",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.14), 0 12px 28px -12px color-mix(in srgb, var(--section) 45%, transparent)",
                }}
              >
                <Icon size={22} strokeWidth={1.8} style={{ color: "var(--section)" }} aria-hidden />
                <span className="sr-only">{label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
