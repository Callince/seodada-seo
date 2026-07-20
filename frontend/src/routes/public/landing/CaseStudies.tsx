import { AreaChart, BrowserFrame, CountUp, LandingImage, Reveal } from "@/components/public/landingKit";

/** Case studies — illustrative outcomes (mark as examples before launch). */
const CASES = [
  {
    name: "Nimbus Retail",
    tag: "E-commerce",
    quote: "seodada became the single source of truth for our entire SEO program.",
    metrics: [
      { v: 382, prefix: "+", suffix: "%", dec: 0, label: "Organic traffic" },
      { v: 15000, prefix: "+", suffix: "", dec: 0, label: "Keywords ranked" },
      { v: 2.4, prefix: "+$", suffix: "M", dec: 1, label: "Revenue" },
    ],
    traffic: [20, 24, 30, 28, 40, 52, 60, 78, 96],
  },
  {
    name: "Kavi Media",
    tag: "Agency",
    quote: "We run 40 client sites from one workspace and ship fixes in minutes.",
    metrics: [
      { v: 214, prefix: "+", suffix: "%", dec: 0, label: "Client rankings" },
      { v: 63, prefix: "", suffix: "%", dec: 0, label: "Less reporting time" },
      { v: 4.9, prefix: "", suffix: "/5", dec: 1, label: "Client rating" },
    ],
    traffic: [30, 34, 32, 44, 50, 58, 70, 82, 90],
  },
];

export function CaseStudies() {
  return (
    <section className="bg-[var(--lp-tint)] py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-2xl">
          <span className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-ink">Case studies</span>
          <h2 className="mt-3 text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">Real teams, real growth</h2>
        </Reveal>

        <div className="mt-14 space-y-8">
          {CASES.map((c, i) => (
            <Reveal key={c.name}>
              <div className={`grid items-center gap-8 rounded-[28px] border border-border bg-surface p-6 lp-shadow sm:p-8 lg:grid-cols-2 ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
                <div>
                  <span className="inline-flex rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary-ink">{c.tag}</span>
                  <h3 className="mt-3 text-2xl font-extrabold tracking-tight">{c.name}</h3>
                  <p className="mt-2 text-text-muted">"{c.quote}"</p>
                  <div className="mt-6 grid grid-cols-3 gap-4">
                    {c.metrics.map((m) => (
                      <div key={m.label}>
                        <div className="text-2xl font-extrabold text-text sm:text-3xl">
                          <span className="gradient-text">
                            <CountUp to={m.v} prefix={m.prefix} suffix={m.suffix} decimals={m.dec} />
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-text-muted">{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* The chart inside browser chrome, so it reads as the client's
                    dashboard rather than a decorative graph. A real screenshot
                    (content-assets/landing/case-N.png) takes priority when it
                    exists; the live mock is the standing fallback. */}
                <BrowserFrame url="app.seodada.com/rank">
                  <LandingImage
                    src={`/content-assets/landing/case-${i + 1}.png`}
                    alt={`${c.name} — organic traffic growth in the seodada dashboard`}
                    className="block w-full"
                    fallback={
                      <div className="bg-[var(--lp-panel)] p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-text">Organic traffic</span>
                          <span className="text-sm font-semibold text-success-ink">{c.metrics[0].prefix}{c.metrics[0].v.toLocaleString()}{c.metrics[0].suffix}</span>
                        </div>
                        <div className="mt-2 h-40">
                          <AreaChart values={c.traffic} id={`case-${i}`} height={150} tone={i % 2 ? "violet" : "emerald"} />
                        </div>
                      </div>
                    }
                  />
                </BrowserFrame>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
