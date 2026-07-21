import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { FEATURE_GROUPS } from "@/content/features";
import { PublicHero } from "@/components/public/PublicHero";
import { Button } from "@/components/ui/button";
import { Seo } from "@/lib/seo";

/** Public features page — presents the full unified suite: the "data for seo"
 *  search-intelligence tools and the seodada on-page + AI content tools, as one
 *  product. Rendered from the shared FEATURE_GROUPS catalog.
 *
 *  The "tools" group is excluded ON PURPOSE: /free-tools is that group's own
 *  page, and rendering it here too made Features and Tools near-duplicates —
 *  same cards, same copy, same order, so the two nav links read as the same
 *  page twice. Features sells the platform; Tools is the free acquisition
 *  surface; the band below cross-links instead of repeating. */
const PLATFORM_GROUPS = FEATURE_GROUPS.filter((g) => g.key !== "tools");

export default function Features() {
  return (
    <div>
      <Seo
        title="Features"
        description="Every SEO tool in one platform — SERP tracking, keyword research, backlinks, technical site audits, on-page analysis, and AI content."
        path="/features"
      />
      {/* ===== Hero ===== */}
      <PublicHero
        eyebrow="Features"
        title="Every SEO tool your team needs,"
        highlight="in one platform"
        subtitle="Search intelligence, technical audits, on-page analysis, and AI content — seodada unifies the full workflow so you research, track, fix, and publish without switching tools."
      >
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/register">
            <Button size="lg">
              Get started <ArrowRight size={16} />
            </Button>
          </Link>
          <Link to="/pricing">
            <Button
              size="lg"
              variant="secondary"
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              See pricing
            </Button>
          </Link>
        </div>
      </PublicHero>

      {/* ===== Feature groups ===== */}
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        {PLATFORM_GROUPS.map((group, gi) => (
          <section key={group.key} className={gi > 0 ? "mt-20" : ""}>
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                <span className="h-7 w-1.5 rounded-full gradient-fill" />
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{group.title}</h2>
              </div>
              <p className="mt-3 text-text-muted">{group.tagline}</p>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {group.features.map((f) => (
                <Link
                  key={f.title}
                  to={f.to}
                  className="group rounded-2xl border border-border bg-surface p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-glow"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary-ink transition-colors group-hover:gradient-fill group-hover:text-white">
                    <f.icon size={20} />
                  </span>
                  <h3 className="mt-4 flex items-center gap-1 text-base font-semibold text-text">
                    {f.title}
                    <ArrowRight
                      size={14}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </h3>
                  <p className="mt-2 text-sm text-text-muted">{f.desc}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* ===== Free tools cross-link — replaces rendering that group here ===== */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <Link
          to="/free-tools"
          className="group flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-[var(--lp-tint)] p-6 transition-colors hover:border-primary/40 sm:p-8"
        >
          <div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              Just want a quick check?
            </h2>
            <p className="mt-1.5 text-text-muted">
              Six free instant tools — paste a URL, get the breakdown. No account needed.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-ink">
            Open the free tools
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      </section>

      {/* ===== CTA ===== */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="aurora-bg overflow-hidden rounded-3xl border border-border bg-surface px-6 py-14 text-center shadow-lg sm:px-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              One login. The whole SEO workflow.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-text-muted">
              Stop stitching together five tools. Research, track, audit, and publish from a single
              platform your whole team can share.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/register">
                <Button size="lg">
                  Start free <ArrowRight size={16} />
                </Button>
              </Link>
              <Link to="/contact">
                <Button size="lg" variant="secondary">
                  Talk to us
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
