import { ArrowRight, Briefcase, Building2, Check, PenLine, Rocket } from "lucide-react";
import { Link } from "react-router-dom";

import { Reveal } from "@/components/public/landingKit";

/**
 * Role-based selling — the ahrefs "whatever your role" pattern. The tool grid
 * above answers "what does it do"; this answers "what does it do for ME",
 * which is the question an evaluator actually arrives with.
 *
 * Every bullet names something the platform genuinely ships (audit crawler,
 * rank alerts, AI-visibility tracking, branded reports, per-client projects,
 * schedules) — outcomes, not adjectives, and nothing promised here that a
 * signup can't find.
 */
const ROLES = [
  {
    icon: Briefcase,
    title: "In-house SEO",
    bullets: [
      "Daily rank tracking with alerts when positions move",
      "Site-wide audits that survive Cloudflare and find every broken page",
      "AI visibility — know when ChatGPT cites you, and when it stops",
    ],
  },
  {
    icon: Building2,
    title: "Agencies & consultants",
    bullets: [
      "Per-client projects that keep domains, keywords and reports apart",
      "Branded, client-ready reports generated from live data",
      "Scheduled re-runs that email results before the client asks",
    ],
  },
  {
    icon: PenLine,
    title: "Content teams",
    bullets: [
      "Content scored for readability and semantic relevance against the SERP",
      "Keyword research with volume, difficulty and intent in one table",
      "On-page checks for titles, headings and links before publish",
    ],
  },
  {
    icon: Rocket,
    title: "Founders & solo builders",
    bullets: [
      "One workspace that runs every analysis on your domain in a pass",
      "Free instant tools — no account for the basics",
      "A plan that starts at zero and scales by analyses per day",
    ],
  },
];

export function Roles() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-2xl">
          <span className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-ink">
            For your team
          </span>
          <h2 className="mt-3 text-balance text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl">
            Whatever your role, an edge
          </h2>
          <p className="mt-4 text-lg text-text-muted">
            The same engine, pointed at your job. Here is what each seat gets out of it.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-3 sm:grid-cols-2">
          {ROLES.map((r, i) => (
            <Reveal key={r.title} delay={Math.min(i, 3) * 0.06}>
              <div className="lp-card group flex h-full flex-col rounded-2xl border border-border bg-surface p-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-text-muted transition-colors duration-[var(--dur-2)] group-hover:text-primary-ink">
                    <r.icon size={18} strokeWidth={1.9} aria-hidden />
                  </span>
                  <h3 className="text-lg font-bold tracking-tight">{r.title}</h3>
                </div>
                <ul className="mt-4 flex-1 space-y-2.5">
                  {r.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-sm leading-relaxed text-text-muted">
                      <Check size={15} className="mt-0.5 shrink-0 text-success-ink" aria-hidden />
                      {b}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-ink transition-colors hover:text-text"
                >
                  Start free <ArrowRight size={14} aria-hidden />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
