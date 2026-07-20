import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Link2,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  TrendingUp,
} from "lucide-react";
import { useEffect, useRef } from "react";

import { AreaChart, CountUp, Reveal, ScoreRing } from "@/components/public/landingKit";
import { sectionVars, type ModuleId } from "@/lib/sections";

import { KeywordRows, TRAFFIC } from "./shared";

/** Product modules shown in the horizontal card rail. Each keys to the same
 *  per-module accent that module's page uses in the app. */
const WIDGETS: { key: string; label: string; sub: string; icon: typeof Search; mod: ModuleId }[] = [
  { key: "keywords", label: "Keyword Tracker", sub: "Positions & movement", icon: Search, mod: "keywords" },
  { key: "traffic", label: "Traffic", sub: "Organic sessions over time", icon: TrendingUp, mod: "rank" },
  { key: "health", label: "Site Health", sub: "Technical score & issues", icon: ShieldCheck, mod: "audit" },
  { key: "backlinks", label: "Backlinks", sub: "Referring domains & authority", icon: Link2, mod: "backlinks" },
  { key: "competitors", label: "Competitors", sub: "Share of voice", icon: Swords, mod: "competitors" },
  { key: "ai", label: "AI Insights", sub: "GEO & AEO visibility", icon: Sparkles, mod: "aivis" },
];

function DashboardWidget({ tab }: { tab: string }) {
  if (tab === "traffic")
    return (
      <div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-text-muted">Organic sessions</p>
            <p className="text-2xl font-extrabold text-text">
              <CountUp to={128} suffix="k" />
            </p>
          </div>
          <span className="rounded-full bg-[color-mix(in_srgb,var(--success)_12%,transparent)] px-2.5 py-1 text-xs font-semibold text-success-ink">+42% MoM</span>
        </div>
        <div className="mt-3 h-40">
          <AreaChart values={TRAFFIC} id="w-traffic" height={140} tone="cyan" />
        </div>
      </div>
    );
  if (tab === "health")
    return (
      <div className="flex items-center gap-6">
        <ScoreRing value={98} size={120} label="Health" tone="emerald" />
        <div className="flex-1 space-y-2.5">
          {[
            { k: "Crawlability", v: 100 },
            { k: "Performance", v: 94 },
            { k: "On-page", v: 97 },
            { k: "Indexing", v: 99 },
          ].map((r) => (
            <div key={r.k}>
              <div className="flex justify-between text-xs text-text-muted">
                <span>{r.k}</span>
                <span className="font-semibold text-text">{r.v}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${r.v}%`, background: "linear-gradient(90deg,var(--success),var(--success-ink))" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  if (tab === "backlinks")
    return (
      <div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { k: "Referring domains", v: "3,204" },
            { k: "Total backlinks", v: "128k" },
            { k: "Domain rating", v: "71" },
          ].map((s) => (
            <div key={s.k} className="rounded-xl border border-border bg-surface p-3">
              <div className="text-lg font-bold text-text">{s.v}</div>
              <div className="text-[11px] text-text-muted">{s.k}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 h-28">
          <AreaChart values={[10, 18, 22, 30, 42, 50, 66, 80]} id="w-bl" height={110} tone="violet" />
        </div>
      </div>
    );
  if (tab === "competitors")
    return (
      <div className="space-y-3">
        {[
          { n: "you.com", v: 92, you: true },
          { n: "rivalseo.io", v: 74 },
          { n: "searchpro.co", v: 58 },
          { n: "rankly.ai", v: 41 },
        ].map((c) => (
          <div key={c.n} className="flex items-center gap-3">
            <span className={`w-28 truncate text-sm ${c.you ? "font-bold text-primary-ink" : "text-text-muted"}`}>{c.n}</span>
            <div className="h-3 flex-1 rounded-full bg-surface-2">
              <div
                className={`h-full rounded-full ${c.you ? "" : "bg-text-muted/40"}`}
                style={{ width: `${c.v}%`, background: c.you ? "linear-gradient(90deg,var(--sec-aivis),var(--sec-aivis-ink))" : undefined }}
              />
            </div>
            <span className="w-8 text-right text-sm font-semibold text-text">{c.v}</span>
          </div>
        ))}
      </div>
    );
  if (tab === "ai")
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-[var(--lp-primary-border)] bg-primary-soft p-4">
          <div className="flex items-center gap-2 text-primary-ink">
            <Sparkles size={15} /> <span className="text-sm font-semibold">AI advisor</span>
          </div>
          <p className="mt-2 text-sm text-text">
            3 pages are missing FAQ schema — adding it could win AEO citations for "answer engine seo". Want me to draft it?
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-surface p-3">
            <div className="text-lg font-bold text-text">
              <CountUp to={64} suffix="%" />
            </div>
            <div className="text-[11px] text-text-muted">AI visibility score</div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3">
            <div className="text-lg font-bold text-text">
              <CountUp to={18} />
            </div>
            <div className="text-[11px] text-text-muted">Cited answers</div>
          </div>
        </div>
      </div>
    );
  // keywords (default)
  return <KeywordRows />;
}

export function ProductRail() {
  // Horizontal module rail (Product section). On desktop it "scroll-jacks":
  // the section pins and the rail translates horizontally as you scroll down,
  // then the page continues once the last card is reached. On mobile it stays a
  // normal touch-swipe rail (pinning touch scroll is bad UX).
  const pinRef = useRef<HTMLDivElement>(null); // tall pinned section
  const railWrapRef = useRef<HTMLDivElement>(null); // clip / native scroller
  const railRef = useRef<HTMLDivElement>(null); // the flex row of cards
  const scrollRail = (dir: number) =>
    railWrapRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  useEffect(() => {
    const pin = pinRef.current;
    const rail = railRef.current;
    const wrap = railWrapRef.current;
    if (!pin || !rail || !wrap) return;
    const onScroll = () => {
      if (window.innerWidth < 1024) {
        rail.style.transform = "";
        return;
      }
      const r = pin.getBoundingClientRect();
      const dist = r.height - window.innerHeight;
      if (dist <= 0) {
        rail.style.transform = "";
        return;
      }
      const p = Math.min(1, Math.max(0, -r.top / dist));
      const maxX = Math.max(0, rail.scrollWidth - wrap.clientWidth);
      rail.style.transform = `translateX(${(-p * maxX).toFixed(1)}px)`;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section ref={pinRef} className="relative py-20 sm:py-28 lg:h-[360vh] lg:py-0">
      <div className="lp-grid absolute inset-0 -z-10" />
      {/* Sticks BELOW the fixed header, not under it. With `top-0` / `h-screen`
          this pinned panel centred its content in the full viewport, but the
          header covers the top 4rem of that — so the eyebrow and heading ran
          straight into the nav for the whole pin. Offsetting the stick point
          and taking the same amount off the height centres the content in the
          space that is actually visible.
          The pin maths below is unaffected: it measures the SECTION's rect, not
          this element's, so the only effect is a ~64px dead zone at the very
          start of a 260vh travel. */}
      <div className="relative lg:sticky lg:top-[var(--header-h)] lg:flex lg:h-[calc(100vh-var(--header-h))] lg:flex-col lg:justify-center lg:overflow-hidden">
        {/* soft colour wash so the glass cards read as frosted */}
        <div className="pointer-events-none absolute inset-0 -z-10 hidden lg:block" aria-hidden>
          <div className="absolute left-[10%] top-1/3 h-72 w-72 rounded-full bg-[rgba(29,125,189,0.20)] blur-3xl" />
          <div className="absolute right-[12%] top-1/2 h-80 w-80 rounded-full bg-[rgba(99,102,241,0.16)] blur-3xl" />
          <div className="absolute bottom-[14%] left-[46%] h-72 w-72 rounded-full bg-[rgba(34,195,238,0.18)] blur-3xl" />
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <span className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-ink">Product</span>
              <h2 className="mt-3 text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">
                Your entire SEO command center
              </h2>
              <p className="mt-4 text-lg text-text-muted">
                Every signal in one live workspace — keep scrolling to glide across the modules.
              </p>
            </div>
            <div className="flex gap-2 lg:hidden">
              <button
                onClick={() => scrollRail(-1)}
                aria-label="Scroll modules left"
                className="grid h-11 w-11 place-items-center rounded-full border border-border bg-surface text-text-muted transition hover:border-primary hover:text-primary-ink"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => scrollRail(1)}
                aria-label="Scroll modules right"
                className="grid h-11 w-11 place-items-center rounded-full border border-border bg-surface text-text-muted transition hover:border-primary hover:text-primary-ink"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </Reveal>
        </div>

        {/* Rail is full-bleed so cards glide in/out at the screen edges (not
            clipped inside the container). First/last cards align to the header
            column via the gutter padding. Native swipe on mobile; transform-
            driven scroll-jack on desktop. */}
        <div
          ref={railWrapRef}
          // Vertical padding, not just pb: setting overflow-x makes overflow-y
          // compute to a clipping value too, so with zero top padding the card's
          // 6px hover lift (.lp-card:hover) was sliced off at the top edge.
          // 24px each side also stops the hover glow (0 26px 55px -20px, ~34px
          // of downward reach) being cut at the bottom. Margin drops 10 -> 4 so
          // the rail still sits exactly where it did.
          className="mt-4 snap-x snap-mandatory overflow-x-auto py-6 lg:snap-none lg:overflow-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div
            ref={railRef}
            className="flex gap-6 px-4 will-change-transform sm:px-6 lg:pl-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))] lg:pr-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))]"
          >
            {WIDGETS.map((w) => (
              // The heading sits OUTSIDE the card now. The card holds only the
              // widget, so it reads as the artefact being labelled rather than a
              // panel with a title bar — and every card starts its data at the
              // same y, which the in-card header prevented.
              <article
                key={w.key}
                style={sectionVars(w.mod)}
                className="group flex h-[380px] w-[86vw] max-w-[500px] shrink-0 snap-start flex-col sm:w-[500px]"
              >
                {/* Label — outside the card, aligned to its left edge. */}
                <div className="flex items-center gap-3 pb-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-text-muted transition-colors duration-[var(--dur-2)] group-hover:text-[color:var(--section-ink)]">
                    <w.icon size={19} strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-bold tracking-tight">{w.label}</h3>
                    <p className="truncate text-xs text-text-muted">{w.sub}</p>
                  </div>
                  <ArrowUpRight
                    size={18}
                    className="ml-auto shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </div>

                {/* The card itself — widget only. Hover is driven from the
                    wrapper (group-hover) rather than the card's own :hover, so
                    pointing at the label lifts the card too; they are one item.
                    That also replaces .lp-card, whose :hover only fired on the
                    card and would have ignored the heading. */}
                <div
                  className={[
                    "relative flex flex-1 flex-col justify-center overflow-hidden rounded-[16px]",
                    "border border-border bg-surface p-6 lp-shadow",
                    "transition-[transform,border-color,box-shadow] duration-[var(--dur-2)] ease-[var(--ease)]",
                    "group-hover:-translate-y-1.5 group-hover:border-text-muted/45",
                    "group-hover:shadow-[shadow:var(--lift-2)]",
                  ].join(" ")}
                >
                  <DashboardWidget tab={w.key} />
                </div>
              </article>
            ))}
            <div className="w-px shrink-0" aria-hidden />
          </div>
        </div>
      </div>
    </section>
  );
}
