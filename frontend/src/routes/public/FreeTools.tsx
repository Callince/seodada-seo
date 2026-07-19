import { ArrowRight, Zap } from "lucide-react";
import { Link } from "react-router-dom";

import { FEATURE_GROUPS } from "@/content/features";
import { PublicHero } from "@/components/public/PublicHero";
import { Button } from "@/components/ui/button";
import { Seo, SITE_URL } from "@/lib/seo";

/** Public tools landing page — replaces the old nav mega-dropdown. Renders the
 *  "Free Instant Tools" group from the shared FEATURE_GROUPS catalog, so the
 *  page and the app stay in sync from one source of truth. */
const TOOL_GROUP = FEATURE_GROUPS.find((g) => g.key === "tools");

const STEPS = [
  { n: "1", title: "Paste a URL", desc: "Any page on any site — yours or a competitor's." },
  { n: "2", title: "Get the breakdown", desc: "Meta, headings, links, images and schema, checked in seconds." },
  { n: "3", title: "Fix what matters", desc: "Every issue comes with a plain-English recommendation." },
];

export default function FreeTools() {
  const tools = TOOL_GROUP?.features ?? [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Free SEO Tools",
    itemListElement: tools.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.title,
      description: t.desc,
      url: `${SITE_URL}${t.to}`,
    })),
  };

  return (
    <div>
      <Seo
        title="Free SEO Tools"
        description="Instant, free SEO tools — analyse any URL's meta tags, headings, images, links, and sitemap in seconds. No setup required."
        path="/free-tools"
        jsonLd={jsonLd}
      />

      <PublicHero
        eyebrow="Free tools"
        title="Instant SEO checks,"
        highlight="no setup required"
        subtitle={TOOL_GROUP?.tagline}
      >
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/tools/url">
            <Button size="lg" className="gradient-fill text-white shadow-glow hover:opacity-95">
              Analyse a URL <ArrowRight size={16} />
            </Button>
          </Link>
          <Link to="/features">
            <Button
              size="lg"
              variant="secondary"
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              See all features
            </Button>
          </Link>
        </div>
      </PublicHero>

      {/* ===== Tool grid ===== */}
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((t) => (
            <Link
              key={t.title}
              to={t.to}
              className="group rounded-2xl border border-border bg-surface p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-glow"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary-ink transition-colors group-hover:gradient-fill group-hover:text-white">
                <t.icon size={20} />
              </span>
              <h2 className="mt-4 flex items-center gap-1 text-base font-semibold text-text">
                {t.title}
                <ArrowRight size={14} className="opacity-0 transition-opacity group-hover:opacity-100" />
              </h2>
              <p className="mt-2 text-sm text-text-muted">{t.desc}</p>
            </Link>
          ))}
        </div>

        {/* ===== How it works ===== */}
        <section className="mt-20">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="h-7 w-1.5 rounded-full gradient-fill" />
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How it works</h2>
            </div>
            <p className="mt-3 text-text-muted">
              Every tool runs the same way — paste, analyse, fix. No credit card, no install.
            </p>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-border bg-surface p-6">
                <span className="grid h-9 w-9 place-items-center rounded-full gradient-fill text-sm font-bold text-white">
                  {s.n}
                </span>
                <h3 className="mt-4 text-base font-semibold text-text">{s.title}</h3>
                <p className="mt-1.5 text-sm text-text-muted">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ===== CTA ===== */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="aurora-bg overflow-hidden rounded-3xl border border-border bg-surface px-6 py-14 text-center shadow-lg sm:px-12">
            <span className="inline-flex items-center gap-1.5 rounded-full gradient-fill px-3 py-1 text-xs font-semibold text-white shadow-glow">
              <Zap size={13} /> Free forever
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Need the full picture?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-text-muted">
              The free tools check one page at a time. Create an account to crawl whole sites, track
              rankings, and watch your competitors.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/register">
                <Button size="lg" className="gradient-fill text-white shadow-glow hover:opacity-95">
                  Start free <ArrowRight size={16} />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button size="lg" variant="secondary">
                  See pricing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
