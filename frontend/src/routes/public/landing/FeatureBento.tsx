import { ArrowUpRight } from "lucide-react";
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

/**
 * Columns that divide a group's cards into balanced rows.
 *
 * Letting every group wrap at 3 filled the rows but stranded a single
 * full-width card at the end of Track (4 tools) and Free tools (7) — no gap,
 * but a 1104px card beside 360px ones. Choosing the wrap point per group gives
 * 2+2 and 4+3 instead, and the cards still grow so the last row stays full.
 */
const colsFor = (n: number) => (n <= 3 ? n : n === 4 ? 2 : n <= 6 ? 3 : 4);

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

                  {/* Flex, not a fixed grid. The groups hold 2/5/2/2/4/2/7
                      tools, so a shared 3-column grid left a hole at the end of
                      every one of them. Each group wraps at its own column count
                      and the cards grow, so rows are balanced AND always full. */}
                  <div
                    className="mt-4 flex flex-wrap gap-3 [--gap:0.75rem]"
                    style={{ ["--cols" as string]: colsFor(g.items.length) }}
                  >
                    {g.items.map(({ to, label, icon: Icon }) => (
                      <Link
                        key={to}
                        to={isFree(g.section) ? "/free-tools" : "/register"}
                        // Basis is an exact 1/--cols share, so the group wraps
                        // where intended; grow lets a short final row expand to
                        // fill rather than leaving a hole. Below sm it drops to
                        // one card per row.
                        className={[
                          "lp-card group/card relative flex flex-[1_1_100%] items-start gap-3.5",
                          "rounded-2xl border border-border bg-surface p-4 pr-9",
                          "transition-[border-color,box-shadow,transform] duration-[var(--dur-2)] ease-[var(--ease)]",
                          "hover:-translate-y-0.5 hover:border-text-muted/45 hover:shadow-[shadow:var(--lift-2)]",
                          "sm:flex-[1_1_calc((100%-(var(--cols)-1)*var(--gap))/var(--cols))]",
                        ].join(" ")}
                      >
                        {/* Neutral by design. The workflow accent lives on the
                            group header — repeating it on all 24 cards turned
                            the section into a colour chart and made every card
                            shout equally. Monochrome here lets the NAMES lead,
                            and the icon warms to the accent only on hover. */}
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-text-muted transition-colors duration-[var(--dur-2)] group-hover/card:text-[color:var(--section-ink)]">
                          <Icon size={18} strokeWidth={1.9} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[15px] font-semibold leading-snug tracking-tight">
                            {label}
                          </span>
                          <span className="mt-1 block text-sm leading-relaxed text-text-muted">
                            {BLURB[to]}
                          </span>
                        </span>
                        {/* These are links; give them an affordance instead of
                            relying on the cursor alone. */}
                        <ArrowUpRight
                          size={15}
                          aria-hidden
                          className="absolute right-3.5 top-4 text-text-muted opacity-0 transition-opacity duration-[var(--dur-2)] group-hover/card:opacity-100"
                        />
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
