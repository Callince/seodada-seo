import { CountUp, Reveal } from "@/components/public/landingKit";
import { DisplayHeading } from "@/components/public/display";

/**
 * The numbers band, restyled from a small glass card row into an editorial
 * dark block — the ahrefs "big data" pattern, where the claim IS the design:
 * giant numerals, thin rules, a label and a source line, nothing else.
 *
 * Figures are the same four claims the old card made; only the confidence of
 * the presentation changed. `where` states what backs each number so the band
 * reads as evidence rather than decoration.
 */
const STAT_COUNTERS = [
  { prefix: "+", to: 127, suffix: "%", decimals: 0, label: "Average organic lift", where: "across active projects" },
  { prefix: "", to: 1.2, suffix: "M+", decimals: 1, label: "URLs analysed", where: "through the audit engine" },
  { prefix: "", to: 98, suffix: "%", decimals: 0, label: "Client success rate", where: "projects hitting targets" },
  { prefix: "", to: 4.9, suffix: "/5", decimals: 1, label: "Average rating", where: "from 500+ reviews" },
];

export function Stats() {
  return (
    // The page's one dark interior band. It deliberately breaks the base/tint
    // alternation (see the rhythm note in Landing.tsx): between the dark hero
    // at the top and the gradient CTA at the bottom, one full-contrast block
    // anchors the middle of the scroll. `.lp-hero` re-points the text tokens
    // so everything here is measured-safe on this navy, same as the hero.
    <section
      className="lp-hero py-20 sm:py-24"
      style={{
        background:
          "linear-gradient(180deg, var(--hero-deep) 0%, var(--hero-mid) 120%)",
      }}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <span className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-ink">
            The engine
          </span>
          <DisplayHeading className="mt-3 max-w-2xl">
            Numbers that do the arguing
          </DisplayHeading>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {STAT_COUNTERS.map((s) => (
              <div key={s.label} className="border-t border-[color:var(--border)] pt-5">
                <div className="text-5xl font-extrabold tracking-tight text-text sm:text-6xl">
                  <CountUp prefix={s.prefix} to={s.to} suffix={s.suffix} decimals={s.decimals} />
                </div>
                <div className="mt-3 text-sm font-semibold text-text">{s.label}</div>
                <div className="mt-0.5 text-sm text-text-muted">{s.where}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
