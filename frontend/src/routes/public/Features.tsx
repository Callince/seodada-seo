import { ArrowRight, Zap } from "lucide-react";
import { Link } from "react-router-dom";

import { FEATURE_GROUPS } from "@/content/features";
import { DisplayHeading, Eyebrow, GroupNumeral } from "@/components/public/display";
import { PageAnalyzer } from "@/components/public/PageAnalyzer";
import { PublicHero } from "@/components/public/PublicHero";
import { Button } from "@/components/ui/button";
import { Seo } from "@/lib/seo";

/**
 * The single public product page: free instant tools *and* the paid platform.
 *
 * Previously this was two pages — /features (16 platform features) and
 * /free-tools (the 6 free ones) — which forced a visitor to bounce between them
 * to see what the product actually is. They now render as one page from the
 * same FEATURE_GROUPS catalog, free group first, with /free-tools redirecting
 * here so no existing link or search result breaks.
 *
 * The free group leads deliberately: it is the only part a visitor can use
 * without an account, and the analyzer above it proves the product works before
 * asking for anything.
 */
const TOOL_GROUP = FEATURE_GROUPS.find((g) => g.key === "tools");
const PLATFORM_GROUPS = FEATURE_GROUPS.filter((g) => g.key !== "tools");
const ALL_TOOLS = FEATURE_GROUPS.flatMap((g) => g.features);

const HOW_IT_WORKS = [
  { n: "1", title: "Paste a URL", desc: "Any page on any site — yours or a competitor's." },
  { n: "2", title: "Get the breakdown", desc: "Meta, headings, links, images and schema, checked in seconds." },
  { n: "3", title: "Fix what matters", desc: "Every issue comes with a plain-English recommendation." },
];


export default function Features() {
  const tools = TOOL_GROUP?.features ?? [];

  return (
    <div>
      <Seo
        title="Free SEO Tools & Features"
        description="Analyse any page free — no account. Meta, headings, images, links and schema in seconds, plus the full platform: SERP tracking, keyword research, backlinks, site audits and AI visibility."
        path="/features"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "SEO tools and platform features",
          itemListElement: ALL_TOOLS.map((f, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: f.title,
            description: f.desc,
          })),
        }}
      />

      {/* ===== Hero: try it before anything else ===== */}
      <PublicHero
        eyebrow="Free tools & features"
        title="Audit any page in seconds."
        highlight="Then scale it."
        subtitle="Paste a URL and get the full on-page breakdown right here — no account, no card. When one page isn't enough, the same platform tracks whole sites, keyword sets and competitors."
      >
        {/* The one-time free run: a real audit inline, before signup. Server
            side this is $0, SSRF-guarded and per-IP rate limited. */}
        <PageAnalyzer />
      </PublicHero>

      {/* ===== How the free tools work ===== */}
      <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-3">
          {HOW_IT_WORKS.map((s) => (
            <div key={s.n} className="flex gap-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full gradient-fill text-sm font-bold text-[color:var(--surface)]">
                {s.n}
              </span>
              <div>
                <h3 className="font-semibold text-text">{s.title}</h3>
                <p className="mt-1 text-sm text-text-muted">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Free tools — first, because they need no account ===== */}
      {TOOL_GROUP && (
        <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6">
          <div className="flex items-start gap-5 sm:gap-8">
            <GroupNumeral n={1} />
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-success">
                <Zap size={11} /> no account
              </span>
              <DisplayHeading className="mt-3">
                {TOOL_GROUP.title}
              </DisplayHeading>
              <p className="mt-4 text-lg leading-relaxed text-text-muted">{TOOL_GROUP.tagline}</p>
              <Link to="/free-tools" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-ink hover:underline">
                Use them now, no account <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {tools.map((f) => (
              <Link
                key={f.title}
                // The in-app tool screens are behind RequireAuth; the public
                // page runs the same checks without an account.
                to="/free-tools"
                className="group flex flex-col rounded-2xl border border-border bg-surface p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-glow"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary-ink transition-colors group-hover:gradient-fill group-hover:text-white">
                  <f.icon size={20} />
                </span>
                <h3 className="mt-4 flex items-center gap-1 text-base font-semibold text-text">
                  {f.title}
                  <ArrowRight size={14} className="opacity-0 transition-opacity group-hover:opacity-100" />
                </h3>
                <p className="mt-2 text-sm font-medium text-text">{f.desc}</p>
                {f.how && (
                  <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-text-muted">
                    {f.how}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ===== The platform ===== */}
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mt-4 border-t border-border pt-16">
          <div className="max-w-3xl">
            <Eyebrow>With an account</Eyebrow>
            <DisplayHeading size="lg" className="mt-3">
              The rest of the platform
            </DisplayHeading>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-text-muted">
              The free tools check one page at a time. These track whole sites, whole keyword sets
              and whole competitor sets — on a schedule.
            </p>
          </div>
        </div>

        {PLATFORM_GROUPS.map((group, i) => (
          <section key={group.key} className="mt-20">
            {/* Numbered from 2: the free group above is 1, so the four groups
                read as one continuous sequence down the page. */}
            <div className="flex items-start gap-5 sm:gap-8">
              <GroupNumeral n={i + 2} />
              <div className="max-w-2xl">
                <DisplayHeading>
                  {group.title}
                </DisplayHeading>
                <p className="mt-4 text-lg leading-relaxed text-text-muted">{group.tagline}</p>
              </div>
            </div>

            {/* Two columns, not three: each card now carries a real explanation
                rather than a tagline, and three columns squeezed that into an
                unreadable ribbon. */}
            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              {group.features.map((f) => (
                <Link
                  key={f.title}
                  to={f.to}
                  className="group flex flex-col rounded-2xl border border-border bg-surface p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-glow"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary-ink transition-colors group-hover:gradient-fill group-hover:text-white">
                    <f.icon size={20} />
                  </span>
                  <h3 className="mt-4 flex items-center gap-1 text-base font-semibold text-text">
                    {f.title}
                    <ArrowRight size={14} className="opacity-0 transition-opacity group-hover:opacity-100" />
                  </h3>
                  <p className="mt-2 text-sm font-medium text-text">{f.desc}</p>
                  {f.how && (
                    <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-text-muted">
                      {f.how}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* ===== Everything, at a glance =====
          The cards above explain each tool; this is the flat inventory, so the
          full scope is legible in one screen without scrolling four sections.

          `.lp-hero` only re-points the text tokens to their light-on-dark
          values — it paints no background of its own. The navy has to be
          supplied here, exactly as the landing stats band does it; without it
          this renders near-white text on the near-white page (measured: 1.06:1
          on the heading before this was added). */}
      <section
        className="lp-hero py-20 sm:py-24"
        style={{
          background: "linear-gradient(180deg, var(--hero-deep) 0%, var(--hero-mid) 120%)",
        }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <DisplayHeading size="lg" className="max-w-3xl">
            Every tool you need, in one place
          </DisplayHeading>
          <p className="mt-5 max-w-2xl text-lg text-text-muted">
            {ALL_TOOLS.length} tools across {FEATURE_GROUPS.length} groups — one login, one bill,
            one place to work.
          </p>

          <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURE_GROUPS.map((group) => (
              <div key={group.key} className="border-t border-[color:var(--border)] pt-5">
                <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-primary-ink">
                  {group.title}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {group.features.map((f) => (
                    <li key={f.title}>
                      <Link
                        to={f.to}
                        className="group flex items-start gap-2 text-sm text-text-muted transition-colors hover:text-text"
                      >
                        <f.icon size={15} className="mt-0.5 shrink-0 text-primary-ink" aria-hidden />
                        <span className="group-hover:underline">{f.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="aurora-bg overflow-hidden rounded-3xl border border-border bg-surface px-6 py-14 text-center shadow-lg sm:px-12">
            <DisplayHeading size="lg">
              One login. The whole SEO workflow.
            </DisplayHeading>
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
