import { CountUp, Reveal } from "@/components/public/landingKit";

const STAT_COUNTERS = [
  { prefix: "+", to: 127, suffix: "%", decimals: 0, label: "Avg. organic lift" },
  { prefix: "", to: 1.2, suffix: "M+", decimals: 1, label: "URLs analysed" },
  { prefix: "", to: 98, suffix: "%", decimals: 0, label: "Client success rate" },
  { prefix: "", to: 4.9, suffix: "/5", decimals: 1, label: "From 500+ reviews" },
];

export function Stats() {
  return (
    <section className="bg-[var(--lp-tint)] py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="grid grid-cols-2 gap-6 rounded-3xl border border-border lp-glass px-6 py-12 lp-shadow sm:grid-cols-4 sm:px-10">
            {STAT_COUNTERS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                  <span className="gradient-text">
                    <CountUp prefix={s.prefix} to={s.to} suffix={s.suffix} decimals={s.decimals} />
                  </span>
                </div>
                <div className="mt-2 text-sm text-text-muted">{s.label}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
