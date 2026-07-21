import { NAV_ITEMS } from "@/lib/nav";

/**
 * The hero's right-hand visual: the logo as a ringed planet, with every tool in
 * the platform orbiting it.
 *
 * Shows the actual surface area of the product — all 24 tools, drawn from
 * NAV_ITEMS so it can never drift from the sidebar. Decorative: the tools are
 * named in text further down the page, so this is one labelled image to
 * assistive tech rather than 24 stray words.
 *
 * Replaces a flat 5-column plane. That version had the tools bobbing in place;
 * this one puts them in orbit, and because the rings are tilted inside a
 * preserve-3d context each icon passes BEHIND the logo for half of every
 * revolution. The pass-behind is the whole effect — it's what separates a
 * planet from a spinning wheel — and it comes from the browser's 3D sort, so
 * there is deliberately no z-index anywhere in here to fight with it.
 */

/** How far the rings are tipped toward the viewer. 0° = face-on circles, 90° =
 *  edge-on lines. 64° keeps the ellipses open enough to read as rings while
 *  still throwing tiles convincingly front and back. */
const TILT = 64;

/**
 * Three rings, and deliberately NOT eight tiles each.
 *
 * Equal counts put every ring's tiles at the same set of angles, which lines
 * them up into visible radial spokes that rotate as one wheel. 7/8/9 share no
 * factor, so the three rings never re-align and the field always reads as
 * scattered. The counts also sum to exactly NAV_ITEMS.length.
 *
 * Periods rise with radius, as they do on the real planet — a uniform period
 * would make the whole system turn like a solid disc.
 */
const RINGS = [
  // orbitS in seconds (a number, not a duration string): each tile derives its
  // depth-lighting phase as -(seat angle / 360) · orbitS, and deriving both
  // from one number is what keeps the brightness cycle locked to the orbit.
  { radius: 132, orbitS: 46, tone: "var(--sat-1)", count: 7 },
  { radius: 182, orbitS: 64, tone: "var(--sat-2)", count: 8 },
  { radius: 232, orbitS: 88, tone: "var(--sat-3)", count: 9 },
];

/**
 * Planet diameter.
 *
 * Ring radii are compared against PLANET/2 on the HORIZONTAL axis only. The
 * tilt squashes each ring vertically by cos(TILT) ≈ 0.44, so a 132px ring is
 * only ~58px tall on screen and its tiles do pass within the planet's 95px
 * radius near the top and bottom of the ellipse — measured, and correct: those
 * are exactly the points where a tile is furthest front or back, so it should
 * be crossing the face or hidden behind the body. What must clear PLANET/2 is
 * the radius itself, or the ring is swallowed even at its widest.
 */
const PLANET = 190;

/** Deal the tools out across the rings in order. Derived from two module
 *  constants, so it is computed once here rather than on every render. */
const RING_TOOLS = RINGS.map((ring, i) => {
  const start = RINGS.slice(0, i).reduce((n, r) => n + r.count, 0);
  return { ...ring, tools: NAV_ITEMS.slice(start, start + ring.count) };
});

export function ToolConstellation() {
  return (
    <div
      className="relative mx-auto grid aspect-square w-full max-w-[520px] place-items-center select-none"
      role="img"
      aria-label="The seodada platform — 24 SEO tools across research, audit, optimization and tracking"
      // Cursor parallax: the whole system leans a few degrees toward the
      // pointer. Written to CSS vars so React never re-renders on mouse move;
      // the stage's transition smooths both the follow and the release. Gated
      // on prefers-reduced-motion — parallax is motion, even if hover-driven.
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
      {/* Ambient bloom so the system reads as lit, not pasted on. */}
      <div
        aria-hidden
        className="absolute inset-10 -z-10 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(60% 60% at 30% 20%, color-mix(in srgb, var(--hero-tide) 55%, transparent), transparent 70%)," +
            "radial-gradient(55% 55% at 75% 75%, color-mix(in srgb, var(--sat-2) 26%, transparent), transparent 70%)",
        }}
      />

      {/* The 3D stage. Everything that must sort against everything else in
          depth — both rings and the planet — has to live in this one
          preserve-3d context; split them across two and the browser flattens
          each and sorts the groups, which loses the pass-behind entirely.
          Scaled rather than re-measured per breakpoint so the ring radii stay
          in one coordinate system. */}
      <div
        aria-hidden
        className="[--sat-scale:0.56] sm:[--sat-scale:0.76] lg:[--sat-scale:1]"
        style={{
          perspective: "1100px",
          transform: "scale(var(--sat-scale))",
          transformStyle: "preserve-3d",
        }}
      >
        <div
          className="relative grid h-[520px] w-[520px] place-items-center [transition:transform_600ms_cubic-bezier(.32,.72,0,1)]"
          style={{
            transform: "rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))",
            transformStyle: "preserve-3d",
          }}
        >
          {/* Ring plane */}
          <div
            className="absolute inset-0 grid place-items-center"
            style={{ transform: `rotateX(${TILT}deg)`, transformStyle: "preserve-3d" }}
          >
            {RING_TOOLS.map((ring) => (
              <div
                key={ring.radius}
                className="sat-ring absolute"
                // The orbit, every tile's counter-spin AND every tile's depth
                // lighting read this one value, so none can fall out of
                // lockstep. See index.css.
                style={{ ["--orbit" as string]: `${ring.orbitS}s`, transformStyle: "preserve-3d" }}
              >
                {/* The band itself. Sits in the ring plane, so its near edge
                    crosses in front of the logo and its far edge behind — the
                    detail that sells the whole thing as a planet. */}
                <div
                  className="absolute rounded-full border"
                  style={{
                    width: ring.radius * 2,
                    height: ring.radius * 2,
                    left: -ring.radius,
                    top: -ring.radius,
                    borderColor: `color-mix(in srgb, ${ring.tone} 26%, transparent)`,
                    boxShadow: `0 0 24px -6px color-mix(in srgb, ${ring.tone} 30%, transparent)`,
                  }}
                />

                {ring.tools.map(({ to, label, icon: Icon }, j) => {
                  const angle = (360 / ring.count) * j;
                  return (
                    // seat — the tile's fixed slot on the ring
                    <div
                      key={to}
                      className="absolute"
                      style={{
                        transform: `rotate(${angle}deg) translateX(${ring.radius}px)`,
                        transformStyle: "preserve-3d",
                      }}
                    >
                      {/* cancels the orbit */}
                      <div className="sat-counter" style={{ transformStyle: "preserve-3d" }}>
                        {/* cancels the slot angle and the ring tilt, so the
                            tile faces front however far round it has travelled */}
                        <div style={{ transform: `rotate(${-angle}deg) rotateX(${-TILT}deg)` }}>
                          <div
                            className="sat-depth grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl border backdrop-blur-md"
                            style={{
                              // Negative delay = start mid-cycle at this seat's
                              // phase, so brightness tracks true depth from the
                              // first frame. See sat-depth in index.css.
                              animationDelay: `${(-(angle / 360) * ring.orbitS).toFixed(2)}s`,
                              borderColor: `color-mix(in srgb, ${ring.tone} 42%, transparent)`,
                              background: `linear-gradient(150deg, color-mix(in srgb, ${ring.tone} 20%, transparent), color-mix(in srgb, #0f1c33 78%, transparent))`,
                              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.16), 0 10px 26px -10px color-mix(in srgb, ${ring.tone} 50%, transparent)`,
                            }}
                          >
                            <Icon size={19} strokeWidth={1.8} style={{ color: ring.tone }} aria-hidden />
                            <span className="sr-only">{label}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* The planet — a sibling of the ring plane rather than a child, so the
              browser sorts it against individual tiles by depth instead of
              against the plane as a whole. That sort is what lets the near half
              of each ring cross the logo while the far half disappears behind.

              It needs to be a BODY and not just the wordmark: on its own the
              logo is a 190x51 strip of text, and tiles crossing it shredded it
              into something unreadable. A solid disc gives the crossing tiles
              something to read against and gives the far half of the orbit
              something to actually hide behind — a planet you can see through
              isn't one. Lit from the upper left, matching the hero's own bloom. */}
          <div className="relative grid place-items-center" style={{ transform: "translateZ(0)" }}>
            <div
              className="absolute rounded-full"
              style={{
                width: PLANET,
                height: PLANET,
                // The logo's own gradient, via the brand tokens rather than
                // sampled hexes — the wordmark runs rgb(38,56,122) to
                // rgb(11,116,179) across its width, which is what --grad-a and
                // --grad-b already encode, so the planet tracks the brand if
                // those are ever retuned.
                //
                // Weighted so the bright end stays a small highlight on the lit
                // limb: the wordmark sits across the sphere's middle, and
                // running --grad-c across the face put near-cyan directly under
                // white letterforms.
                background:
                  "radial-gradient(circle at 30% 24%," +
                  "color-mix(in srgb, var(--grad-c) 70%, var(--grad-b)) 0%," +
                  "var(--grad-b) 26%," +
                  "var(--grad-a) 58%," +
                  "color-mix(in srgb, var(--grad-a) 55%, #060c1a) 100%)",
                boxShadow:
                  "inset 0 2px 1px color-mix(in srgb, #ffffff 12%, transparent)," +
                  "inset 0 -18px 34px -18px #000," +
                  "0 0 0 1px color-mix(in srgb, var(--sat-1) 14%, transparent)," +
                  "0 24px 60px -20px rgba(0,0,0,0.7)",
              }}
            />
            {/* Atmosphere on the lit limb. Kept tight (transparent by 38%) and
                weak: at 26% out to 62% it bloomed across the whole face and
                washed the wordmark down to a grey smear. */}
            <div
              className="absolute rounded-full blur-xl"
              style={{
                width: PLANET * 1.18,
                height: PLANET * 1.18,
                background:
                  "radial-gradient(circle at 30% 24%, color-mix(in srgb, var(--hero-glow) 18%, transparent), transparent 38%)",
              }}
            />
            <img
              src="/content-assets/logo_1761200794.png"
              alt=""
              width={202}
              height={54}
              className="relative w-[132px] max-w-none drop-shadow-[0_4px_14px_rgba(0,0,0,0.7)]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
