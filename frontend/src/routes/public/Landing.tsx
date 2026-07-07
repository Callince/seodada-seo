import {
  ArrowRight,
  BarChart3,
  Bot,
  Gauge,
  Heading,
  Image,
  Link,
  Link2,
  LineChart,
  Network,
  PenLine,
  Search,
  Sparkles,
  Tags,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/store/auth";

/** Real seodada capability tags for the platform cloud (verbatim from the
 *  seodada landing) + the unified additions. Size varies for a tag-cloud feel. */
const TAGS: { label: string; size: "sm" | "md" | "lg" }[] = [
  { label: "audit", size: "md" },
  { label: "ai insights", size: "lg" },
  { label: "prioritisation", size: "md" },
  { label: "seo suite", size: "lg" },
  { label: "daily tracking", size: "sm" },
  { label: "rankings", size: "md" },
  { label: "precision", size: "sm" },
  { label: "real-time data", size: "lg" },
  { label: "decision-making", size: "md" },
  { label: "keyword research", size: "md" },
  { label: "backlinks", size: "sm" },
  { label: "rank tracking", size: "md" },
  { label: "content factory", size: "lg" },
  { label: "site health", size: "sm" },
  { label: "competitors", size: "md" },
];

/** Real seodada stats (from the migrated landing copy). */
const STATS = [
  { value: "+127%", label: "Avg. organic traffic" },
  { value: "1.2M+", label: "URLs analysed" },
  { value: "98%", label: "Client success rate" },
  { value: "4.9/5", label: "From 500+ reviews" },
];

/** The 6 real seodada analysis tools + this platform's added capabilities,
 *  with descriptions condensed from the seodada landing copy. */
const FEATURES = [
  { icon: Link2, title: "URL Analysis", desc: "Scan URLs for structure, internal links, and crawl paths — with broken-link and robots.txt checks." },
  { icon: Search, title: "Keyword Analysis", desc: "See what your content really targets: density, semantic relevance, and competitor comparison." },
  { icon: Image, title: "Image Analysis", desc: "Flag missing alt text and heavy images, with size, format, and loading-speed recommendations." },
  { icon: Heading, title: "Heading Analysis", desc: "Check your H1–H6 hierarchy, keyword placement, and content structure at a glance." },
  { icon: Tags, title: "Meta Analysis", desc: "Evaluate titles, descriptions, and schema so pages show up properly and earn clicks." },
  { icon: Network, title: "Sitemap Analysis", desc: "Map your site with interactive sitemaps, navigation-flow analysis, and sitemap.xml validation." },
  { icon: LineChart, title: "Rank Tracking", desc: "Track Google positions across locations and devices with daily snapshots and movement alerts." },
  { icon: Link, title: "Backlink Intelligence", desc: "Authority scores, referring domains, and anchor profiles — with free fallbacks when needed." },
  { icon: PenLine, title: "AI Content Factory", desc: "Autonomous keyword research, topic clustering, and publish-ready blog generation." },
];

/** Real seodada three-step flow. */
const STEPS = [
  { icon: BarChart3, title: "Data Collection", desc: "We collect data from your pages and run a full web SEO analysis scan of content, layout, and links." },
  { icon: Gauge, title: "Analysis & Report", desc: "Everything is processed into one clear SEO analytics report — ranking signals, page health, and fixes." },
  { icon: Sparkles, title: "Strategic Action", desc: "Turn insights into content and fixes with an AI advisor and scheduled, automated reporting." },
];

const TAG_SIZE = {
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-2.5 text-base",
  lg: "px-6 py-3 text-lg",
} as const;

export default function Landing() {
  const authed = useAuth((s) => !!s.accessToken);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  useEffect(() => {
    document.title = "seodada — SEO analytics & AI content platform";
  }, []);

  const primaryTo = authed ? "/dashboard" : "/register";
  const primaryLabel = authed ? "Go to dashboard" : "Get started";

  const onAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    // Real seodada behaviour: analyse a domain/URL. Signed-in users land in the
    // all-in-one workspace pre-filled; visitors are sent to sign up first.
    if (authed) navigate(`/workspace${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    else navigate(`/register${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  };

  return (
    <div>
      {/* ============ DARK FUTURISTIC HERO ZONE ============================ */}
      <div className="cyber-grid relative overflow-hidden">
        {/* Deep navy → ocean 3D surface (seodada brand), no photo. */}
        <div
          className="absolute inset-0 -z-20"
          style={{ background: "linear-gradient(180deg,#070d24 0%,#0c1a45 46%,#103166 100%)" }}
        />
        {/* Aurora light pools — navy / ocean / cyan for depth. */}
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(75% 55% at 50% 120%, rgba(34,195,238,0.42), transparent 62%)," +
              "radial-gradient(48% 42% at 14% 6%, rgba(39,56,121,0.60), transparent 60%)," +
              "radial-gradient(44% 40% at 88% 10%, rgba(15,116,178,0.45), transparent 60%)",
          }}
        />
        {/* Floating neon orbs. */}
        <div
          className="absolute right-[-8%] top-[22%] -z-10 h-80 w-80 rounded-full opacity-50 blur-3xl"
          style={{ background: "conic-gradient(from 130deg,#273879,#0f74b2,#22d3ee,#273879)" }}
        />
        <div
          className="absolute left-[-6%] top-[52%] -z-10 h-56 w-56 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle,#22d3ee,transparent 70%)" }}
        />
        {/* Bottom vignette so the overlapping panel reads cleanly. */}
        <div className="absolute inset-x-0 bottom-0 -z-10 h-1/3 bg-gradient-to-b from-transparent to-[#070d24]/80" />

        <section className="mx-auto w-full max-w-6xl px-4 pb-44 pt-28 sm:px-6 sm:pt-32">
          <div className="grid items-center gap-10 lg:grid-cols-[1.55fr_1fr]">
            {/* Left — headline */}
            <div className="text-center lg:text-left">
              <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-white/70 sm:text-xs">
                Clear, reliable SEO analytics — built for teams, at scale
              </p>
              <h1 className="mt-6 text-4xl font-light uppercase leading-[1.12] tracking-[0.13em] text-white sm:text-[3.4rem] sm:tracking-[0.16em]">
                Enterprise
                <br />
                <span className="font-semibold gradient-text">SEO analytics</span>
                <br />
                for data-driven teams
              </h1>
              <p className="mx-auto mt-7 max-w-md text-base text-white/70 lg:mx-0">
                We built seodada for teams that need accurate SEO analytics and practical checks in
                one place — then turn insights into published content, automatically.
              </p>

              {/* Real seodada domain/keyword/URL search entry */}
              <form
                onSubmit={onAnalyze}
                className="glass mx-auto mt-8 flex max-w-lg items-center gap-2 rounded-full border border-white/20 p-1.5 pl-4 lg:mx-0"
              >
                <Search size={18} className="shrink-0 text-white/60" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter domain, keywords, or URL"
                  className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/50 focus:outline-none"
                  aria-label="Enter domain, keywords, or URL"
                />
                <Button type="submit" size="sm" className="gradient-animate rounded-full px-5 text-white shadow-glow">
                  Enter
                  <ArrowRight size={15} />
                </Button>
              </form>
              <div className="mt-4 text-xs text-white/50">
                Trusted by 2,000+ enterprise clients · 4.9/5 from 500+ reviews
              </div>
            </div>

            {/* Right — floating glass "live metrics" panel */}
            <div className="hidden lg:block">
              <div className="border-gradient glass rounded-2xl border border-white/10 p-6 shadow-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Live performance</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/20 px-2.5 py-1 text-xs font-medium text-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Tracking
                  </span>
                </div>
                <div className="mt-5 space-y-3">
                  {[
                    { k: "Organic traffic", v: "+127%" },
                    { k: "Keywords ranked", v: "432" },
                    { k: "URLs analysed", v: "1.2M+" },
                    { k: "Client success rate", v: "98%" },
                  ].map((r) => (
                    <div
                      key={r.k}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                      <span className="text-sm text-white/70">{r.k}</span>
                      <span className="text-sm font-semibold text-white">{r.v}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex items-center gap-1.5 text-xs text-white/60">
                  <BarChart3 size={13} /> Updated moments ago
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ===== INSET floating white panel — overlaps the hero, dark peeks at
              the left/right gaps (mx) over the overlap, per the reference ==== */}
      <section className="relative z-10 -mt-28 rounded-[2.5rem] border border-border bg-surface px-4 pb-16 pt-14 shadow-2xl mx-3 sm:mx-6 lg:mx-10">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Explore our innovative platform today!
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-text-muted">
            One login covers the whole workflow — research, tracking, audits, and AI content.
          </p>
          <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-3">
            {TAGS.map((t, i) => (
              <RouterLink
                key={t.label}
                to={authed ? "/dashboard" : "/register"}
                className={`rounded-full border border-border bg-app-bg font-medium text-text shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:text-primary hover:shadow-md ${TAG_SIZE[t.size]} ${
                  i % 3 === 0 ? "sm:-translate-y-1.5" : i % 3 === 2 ? "sm:translate-y-1.5" : ""
                }`}
              >
                {t.label}
              </RouterLink>
            ))}
          </div>

          {/* Stat band */}
          <div className="mt-12 grid grid-cols-2 gap-4 border-t border-border pt-10 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-extrabold text-text">{s.value}</div>
                <div className="mt-1 text-xs text-text-muted">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== Features (real seodada tools + additions) ==== */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight">Comprehensive SEO analytics</h2>
            <p className="mt-3 text-text-muted">
              seodada brings together accurate analytics and practical checks in one place — then
              adds rank tracking, backlinks, and AI content on top.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-border bg-surface p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-glow"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary transition-colors group-hover:gradient-fill group-hover:text-white">
                  <f.icon size={20} />
                </span>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-text-muted">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== How it works ================================= */}
      <section className="border-t border-border dot-grid">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
            <p className="mt-3 text-text-muted">
              We keep SEO analytics simple for large teams — a three-step flow built to audit fast.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative rounded-2xl border border-border bg-surface p-7 shadow-sm">
                <span className="absolute -top-3 left-7 grid h-7 w-7 place-items-center rounded-full gradient-fill text-xs font-bold text-white">
                  {i + 1}
                </span>
                <s.icon size={22} className="text-primary" />
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-text-muted">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== Final CTA =================================== */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="aurora-bg overflow-hidden rounded-3xl border border-border bg-surface px-6 py-14 text-center shadow-lg sm:px-12">
            <Bot size={28} className="mx-auto text-primary" />
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to transform your SEO strategy?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-text-muted">
              Join teams using seodada to analyse, rank, and publish — all in one place.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <RouterLink to={primaryTo}>
                <Button size="lg" className="gradient-fill text-white shadow-glow hover:opacity-95">
                  {primaryLabel}
                  <ArrowRight size={16} />
                </Button>
              </RouterLink>
              <RouterLink to="/contact">
                <Button size="lg" variant="secondary">
                  Talk to us
                </Button>
              </RouterLink>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
