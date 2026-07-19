import { Link } from "react-router-dom";

import { Reveal } from "@/components/public/landingKit";
import { NAV_ITEMS, type NavItem } from "@/lib/nav";
import { moduleForSection, sectionVars } from "@/lib/sections";

/** One outcome line per tool — what you *get*, not what it "offers".
 *  Keyed by route so this can never drift from the sidebar. */
const BLURB: Record<string, string> = {
  "/dashboard": "Every project's health, spend and wins on one screen.",
  "/workspace": "Run every analysis on one domain in a single pass.",
  "/keywords": "Volume, difficulty and intent across thousands of ideas.",
  "/serp": "Live top-100 results with every SERP feature mapped.",
  "/domains": "Traffic, authority and the tech stack behind any domain.",
  "/competitors": "Keyword gaps against several rivals at once.",
  "/local": "Map-pack visibility, city by city.",
  "/audit": "Cloudflare-resistant crawl that finds every broken page.",
  "/onpage": "Titles, headings, links and speed for a single URL.",
  "/content": "Readability and semantic relevance against the SERP.",
  "/report": "A branded report, ready to send to a client.",
  "/rank": "Daily positions, with an alert when something moves.",
  "/backlinks": "New and lost links, anchors and referring domains.",
  "/ai-visibility": "How often ChatGPT and AI Overviews cite you.",
  "/schedules": "Re-run any analysis weekly and email the result.",
  "/projects": "Group domains, keywords and reports per client.",
  "/billing": "Usage, invoices and GST-compliant receipts.",
  "/tools": "Every free check on one URL.",
  "/tools/url": "Status, redirects and canonical in one shot.",
  "/tools/keyword": "Density and prominence for any page.",
  "/tools/heading": "H1–H6 structure and hierarchy gaps.",
  "/tools/image": "Missing alt text and oversized files.",
  "/tools/meta": "Title, description and Open Graph preview.",
  "/tools/sitemap": "Parse a sitemap and count every URL.",
};

/** Group nav items by section, preserving the sidebar's workflow order. */
const GROUPS = NAV_ITEMS.reduce<{ section: string; items: NavItem[] }[]>((out, it) => {
  const section = it.section ?? "Overview";
  const last = out[out.length - 1];
  if (last?.section === section) last.items.push(it);
  else out.push({ section, items: [it] });
  return out;
}, []);

/** Free tools are public; the /tools/* routes themselves need an account, so
 *  the whole group points at the public free-tools page. */
const isFree = (section: string) => section === "Free tools";

export function FeatureBento() {
  return (
    <section className="border-t border-border bg-[var(--lp-tint)] py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-ink">Platform</span>
          <h2 className="mt-3 text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">
            Everything to dominate search
          </h2>
          <p className="mt-4 text-lg text-text-muted">
            {NAV_ITEMS.length} tools, in the order you actually work — research, audit, optimize, track.
          </p>
        </Reveal>

        <div className="mt-12 space-y-10">
          {GROUPS.map((g, gi) => {
            const step = g.section.match(/^(\d+)\s·\s(.+)$/);
            return (
              <Reveal key={g.section} delay={Math.min(gi, 3) * 0.06}>
                <div style={sectionVars(moduleForSection(g.section))}>
                  <div className="flex items-center gap-3">
                    {step && (
                      <span className="section-gradient grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold text-white shadow-glow">
                        {step[1]}
                      </span>
                    )}
                    <h3 className="text-lg font-bold tracking-tight">{step ? step[2] : g.section}</h3>
                    {isFree(g.section) && (
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs font-semibold text-text-muted">
                        Free · no account
                      </span>
                    )}
                    <span className="h-px flex-1 bg-border" aria-hidden />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {g.items.map(({ to, label, icon: Icon }) => (
                      <Link
                        key={to}
                        to={isFree(g.section) ? "/free-tools" : "/register"}
                        className="lp-card lp-glass flex gap-3 rounded-2xl border border-border p-4 lp-shadow transition-transform hover:-translate-y-0.5"
                      >
                        <span
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                          style={{ background: "var(--section-soft)", color: "var(--section)" }}
                        >
                          <Icon size={18} />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold tracking-tight">{label}</span>
                          <span className="mt-1 block text-sm leading-relaxed text-text-muted">{BLURB[to]}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
