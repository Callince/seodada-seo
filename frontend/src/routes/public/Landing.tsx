import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  LineChart,
  Link2,
  MapPin,
  PhoneCall,
  Play,
  Radar,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Swords,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import { AreaChart, Bars, CountUp, LandingImage, Magnetic, Particles, Reveal, ScoreRing } from "@/components/public/landingKit";
import { Button } from "@/components/ui/button";
import { Seo, SITE_URL } from "@/lib/seo";
import { useAuth } from "@/store/auth";

/* ============================== data ============================== */

const SITE_JSONLD = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "seodada",
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.svg`,
    sameAs: [
      "https://www.linkedin.com/company/seodada/",
      "https://www.instagram.com/seodada1",
      "https://youtube.com/@seodada-s4b",
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "seodada",
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/serp?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  },
];

const ECOSYSTEM = [
  "Search Console",
  "Google Analytics",
  "WordPress",
  "Shopify",
  "Razorpay",
  "Cloudflare",
  "Bing Webmaster",
  "Looker Studio",
];

const TRAFFIC = [22, 30, 26, 38, 34, 48, 44, 60, 55, 72, 68, 88];

/** Product modules shown in the horizontal card rail. */
const WIDGETS = [
  { key: "keywords", label: "Keyword Tracker", sub: "Positions & movement", icon: Search },
  { key: "traffic", label: "Traffic", sub: "Organic sessions over time", icon: TrendingUp },
  { key: "health", label: "Site Health", sub: "Technical score & issues", icon: ShieldCheck },
  { key: "backlinks", label: "Backlinks", sub: "Referring domains & authority", icon: Link2 },
  { key: "competitors", label: "Competitors", sub: "Share of voice", icon: Swords },
  { key: "ai", label: "AI Insights", sub: "GEO & AEO visibility", icon: Sparkles },
] as const;

const KEYWORDS = [
  { kw: "ai seo platform", pos: 3, up: true },
  { kw: "geo optimization", pos: 1, up: true },
  { kw: "answer engine seo", pos: 5, up: true },
  { kw: "technical seo audit", pos: 8, up: false },
];

/** Feature bento — deliberately varied sizes. */
const BENTO = [
  {
    title: "AI SEO Assistant",
    desc: "Ask anything about your site and get prioritised, plain-English fixes — written from your own audit and ranking data.",
    icon: Bot,
    span: "lg:col-span-2 lg:row-span-2",
    hero: true,
    tone: "violet",
  },
  { title: "Keyword Intelligence", desc: "Volume, difficulty, intent and thousands of ideas from live search data.", icon: Search, span: "lg:col-span-2", tone: "blue" },
  { title: "Competitor Analysis", desc: "Keyword gaps and shared terms — see where rivals out-rank you.", icon: Swords, span: "", tone: "cyan" },
  { title: "Technical Audit", desc: "JS-rendering, Cloudflare-resistant crawl that surfaces every issue.", icon: Radar, span: "", tone: "emerald" },
  { title: "Content Optimizer", desc: "Readability, semantic relevance and on-page scoring versus the SERP.", icon: FileText, span: "lg:col-span-2", tone: "blue" },
  { title: "Rank Tracker", desc: "Daily positions across locations and devices, with alerts.", icon: LineChart, span: "", tone: "cyan" },
  { title: "Local SEO", desc: "Map-pack visibility and location-level tracking.", icon: MapPin, span: "", tone: "violet" },
  { title: "AI Visibility", desc: "Track how often you're cited across AI answer engines — GEO & AEO.", icon: Eye, span: "lg:col-span-2", tone: "cyan" },
];

/** Sticky workflow. */
const FLOW = [
  { k: "Audit", desc: "Crawl and score every page — technical issues surfaced by priority.", icon: Radar },
  { k: "Research", desc: "Find the keywords and questions your audience actually searches.", icon: Search },
  { k: "Optimize", desc: "Fix on-page, content and structure with AI-written guidance.", icon: Sparkles },
  { k: "Publish", desc: "Ship optimized content and web stories — GEO & AEO ready.", icon: Rocket },
  { k: "Monitor", desc: "Track rankings, AI visibility and site health on autopilot.", icon: Activity },
  { k: "Grow", desc: "Compound gains with automated reporting and alerts.", icon: TrendingUp },
];
/** A different chart colour per workflow step (all suit the UI). */
const FLOW_TONES = ["blue", "cyan", "violet", "indigo", "emerald", "teal"] as const;

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

const STAT_COUNTERS = [
  { prefix: "+", to: 127, suffix: "%", decimals: 0, label: "Avg. organic lift" },
  { prefix: "", to: 1.2, suffix: "M+", decimals: 1, label: "URLs analysed" },
  { prefix: "", to: 98, suffix: "%", decimals: 0, label: "Client success rate" },
  { prefix: "", to: 4.9, suffix: "/5", decimals: 1, label: "From 500+ reviews" },
];

// PLACEHOLDER — swap for real quotes/photos before launch.
// `avatar` points at /public/content-assets/landing/*; until those files exist
// the UI falls back to the gradient initials (see LandingImage).
const TESTIMONIALS = [
  { quote: "We replaced three SEO subscriptions with seodada. The audit alone paid for it in week one.", name: "Priya Nair", role: "Head of Growth, Nimbus Retail", initials: "PN", avatar: "/content-assets/landing/avatar-1.png" },
  { quote: "The free URL and sitemap tools are how our whole team checks pages before they ship.", name: "Arjun Mehta", role: "SEO Lead, Kavi Media", initials: "AM", avatar: "/content-assets/landing/avatar-2.png" },
  { quote: "Rank tracking plus the AI advisor means I walk into calls with the fixes already written.", name: "Sara Okoye", role: "Founder, Okoye Digital", initials: "SO", avatar: "/content-assets/landing/avatar-3.png" },
  { quote: "GEO and AI-visibility tracking is something no other tool in our stack does. Game changer.", name: "Rahul Kapoor", role: "CMO, Vaan Labs", initials: "RK", avatar: "/content-assets/landing/avatar-4.png" },
];

const PLANS = [
  { name: "Basic", monthly: 799, perDay: 30, blurb: "Solo SEOs and small sites.", popular: false, features: ["Full analytics suite", "30 analyses / day", "Free on-page tools", "Email support"] },
  { name: "Pro", monthly: 4999, perDay: 50, blurb: "Growing teams and agencies.", popular: true, features: ["Everything in Basic", "50 analyses / day", "Rank tracking + AI advisor", "Scheduled monitoring", "Priority support"] },
  { name: "Premium", monthly: 8999, perDay: 100, blurb: "High-volume operators.", popular: false, features: ["Everything in Pro", "100 analyses / day", "AI content factory", "Web stories", "Success manager"] },
] as const;

const FAQS = [
  { q: "Is there a free plan?", a: "Yes. Create an account and run a set number of analyses every day for free — no credit card. Upgrade any time for a higher daily limit." },
  { q: "What is GEO and AEO?", a: "Generative Engine Optimization and Answer Engine Optimization — making your content the source AI assistants (ChatGPT, Google AI) cite. seodada tracks and improves your AI visibility alongside classic SEO." },
  { q: "What data does seodada use?", a: "Live data from your own pages (our in-house crawler) plus search-intelligence providers for SERP, keywords, and backlinks — with free fallbacks so nothing breaks." },
  { q: "Can I cancel or change my plan?", a: "Any time, from the Billing page. Plans are billed via Razorpay with a GST invoice you can download." },
  { q: "Is my data secure?", a: "Your account is isolated to your organization, passwords are hashed with bcrypt, and we never share your data with third parties." },
];

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

/* ============================== widgets ============================== */

function KeywordRows() {
  return (
    <div className="space-y-2">
      {KEYWORDS.map((k) => (
        <div key={k.kw} className="flex items-center justify-between rounded-xl border border-border bg-surface px-3.5 py-2.5">
          <span className="truncate text-sm font-medium text-text">{k.kw}</span>
          <span className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${k.up ? "text-emerald-600" : "text-rose-500"}`}>
              <TrendingUp size={12} className={k.up ? "" : "rotate-180"} /> #{k.pos}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

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
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600">+42% MoM</span>
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
                  style={{ width: `${r.v}%`, background: "linear-gradient(90deg,#10b981,#047857)" }}
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
            <span className={`w-28 truncate text-sm ${c.you ? "font-bold text-primary" : "text-text-muted"}`}>{c.n}</span>
            <div className="h-3 flex-1 rounded-full bg-surface-2">
              <div
                className={`h-full rounded-full ${c.you ? "" : "bg-text-muted/40"}`}
                style={{ width: `${c.v}%`, background: c.you ? "linear-gradient(90deg,#6366f1,#4338ca)" : undefined }}
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
          <div className="flex items-center gap-2 text-primary">
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

/* ============================== page ============================== */

export default function Landing() {
  const authed = useAuth((s) => !!s.accessToken);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [annual, setAnnual] = useState(false);
  const [tIdx, setTIdx] = useState(0);

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

  // Sticky workflow scroll tracking — plain listener computing progress from the
  // section's position over its scrollable height (reliable on every scroll).
  const flowRef = useRef<HTMLDivElement>(null);
  const [flowStep, setFlowStep] = useState(0);
  useEffect(() => {
    const el = flowRef.current;
    if (!el) return;
    const onScroll = () => {
      const r = el.getBoundingClientRect();
      const dist = r.height - window.innerHeight;
      if (dist <= 0) {
        setFlowStep(0);
        return;
      }
      const p = Math.min(1, Math.max(0, -r.top / dist));
      setFlowStep(Math.min(FLOW.length - 1, Math.floor(p * FLOW.length)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const primaryTo = authed ? "/dashboard" : "/register";
  const primaryLabel = authed ? "Go to dashboard" : "Start free trial";

  const onAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (authed) navigate(`/workspace${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    else navigate(`/register${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  };

  return (
    <div className="lp overflow-x-clip">
      <Seo
        title="AI SEO Built for the Future of Search"
        description="seodada is an AI-powered SEO intelligence platform — keyword research, technical audits, rank tracking, GEO, AEO and AI visibility in one place."
        path="/"
        jsonLd={SITE_JSONLD}
      />

      {/* ============================ HERO ============================ */}
      <section
        className="lp-noise relative flex min-h-[100svh] items-center overflow-hidden"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
          e.currentTarget.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
        }}
      >
        <div className="lp-mesh absolute inset-0 -z-10" />
        <div className="lp-cursor absolute inset-0 -z-10" />
        <Particles count={18} className="-z-10" />
        <div className="lp-float absolute -left-24 top-28 -z-10 h-72 w-72 rounded-full bg-[#1d7dbd]/20 blur-3xl" />
        <div className="lp-float-2 absolute -right-16 top-10 -z-10 h-80 w-80 rounded-full bg-[#2e3f87]/20 blur-3xl" />

        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-12 pt-24 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:gap-10 lg:pb-14 lg:pt-20">
          {/* Left */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.09 } } }}
            className="relative z-10 text-center lg:text-left"
          >
            <motion.span
              variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--lp-primary-border)] bg-primary-soft px-3.5 py-1.5 text-xs font-semibold text-primary"
            >
              <Sparkles size={13} /> AI-powered SEO · GEO · AEO
            </motion.span>
            <motion.h1
              variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
              className="mt-5 text-4xl font-extrabold leading-[1.03] tracking-tight text-text sm:text-5xl lg:text-6xl xl:text-7xl"
            >
              AI SEO
              <br />
              <span className="gradient-text-anim">Built for the Future of Search</span>
            </motion.h1>
            <motion.p
              variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
              className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-text-muted sm:text-lg lg:mx-0"
            >
              One platform to research, audit, optimize and track — across classic search, AI answer
              engines and generative results. Paste a URL and get a full breakdown in seconds.
            </motion.p>

            <motion.form
              variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
              onSubmit={onAnalyze}
              className="mx-auto mt-6 flex max-w-lg items-center gap-2 rounded-full border border-border bg-[var(--lp-glass)] p-1.5 pl-4 shadow-lg backdrop-blur lg:mx-0"
            >
              <Search size={18} className="shrink-0 text-text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter a domain, keyword, or URL…"
                aria-label="Enter a domain, keyword, or URL"
                className="min-w-0 flex-1 bg-transparent text-sm text-text placeholder:text-text-muted focus:outline-none"
              />
              <Button type="submit" className="gradient-fill rounded-full px-5 text-white shadow-glow">
                Analyze <ArrowRight size={15} />
              </Button>
            </motion.form>

            <motion.div
              variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
              className="mt-5 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
            >
              <Magnetic>
                <RouterLink to={primaryTo}>
                  <Button size="lg" className="gradient-fill rounded-full text-white shadow-glow hover:opacity-95">
                    {primaryLabel} <ArrowRight size={16} />
                  </Button>
                </RouterLink>
              </Magnetic>
              <RouterLink to="/contact">
                <Button size="lg" variant="secondary" className="rounded-full">
                  <PhoneCall size={15} /> Book a demo
                </Button>
              </RouterLink>
            </motion.div>

            <motion.div
              variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
              className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 lg:justify-start"
            >
              <div className="flex -space-x-2">
                {["PN", "AM", "SO", "RK"].map((x, i) => (
                  <span
                    key={x}
                    className="grid h-8 w-8 place-items-center rounded-full border-2 border-surface text-[10px] font-bold text-white"
                    style={{ background: i % 2 ? "#2e3f87" : "#1d7dbd" }}
                  >
                    {x}
                  </span>
                ))}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-0.5 text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={14} fill="currentColor" />
                  ))}
                  <span className="ml-1.5 text-sm font-semibold text-text">4.9/5</span>
                </div>
                <span className="text-xs text-text-muted">Trusted by 2,000+ teams · 500+ reviews</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Right — floating dashboard */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1], delay: 0.2 }}
            className="relative z-10 hidden lg:block"
          >
            <div className="absolute inset-8 -z-10 rounded-[2.5rem] bg-gradient-to-tr from-[#2e3f87]/40 to-[#1d7dbd]/40 blur-3xl" />
            <div className="lp-ring lp-float rounded-[28px]">
              <LandingImage
                src="/content-assets/landing/hero-dashboard.png"
                alt="seodada SEO dashboard — SEO score, organic traffic growth, and keyword rankings at a glance"
                className="block w-full rounded-[28px] border border-white/60 lp-shadow-lg"
                fallback={
                  <div className="relative rounded-[28px] border border-white/60 bg-white/85 p-5 lp-shadow-lg backdrop-blur-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ScoreRing value={92} size={72} />
                        <div>
                          <p className="text-xs text-text-muted">SEO score</p>
                          <p className="text-sm font-bold text-text">Excellent</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live
                      </span>
                    </div>
                    <div className="mt-4 rounded-2xl border border-border bg-surface p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-muted">Organic traffic</span>
                        <span className="text-xs font-semibold text-emerald-600">+382%</span>
                      </div>
                      <div className="mt-1 h-24">
                        <AreaChart values={TRAFFIC} id="hero-traffic" height={96} />
                      </div>
                    </div>
                    <div className="mt-3">
                      <KeywordRows />
                    </div>
                  </div>
                }
              />
            </div>

            {/* Floating cards */}
            <div className="lp-float-2 absolute -right-6 -top-6 w-52 rounded-2xl border border-border bg-[var(--lp-glass)] p-3.5 lp-shadow-lg backdrop-blur">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <TrendingUp size={16} />
                </span>
                <div>
                  <p className="text-xs font-semibold text-text">Ranking up</p>
                  <p className="text-[11px] text-text-muted">"geo optimization" · #4 → #1</p>
                </div>
              </div>
            </div>
            <div className="lp-float absolute -bottom-5 -left-6 flex items-center gap-2.5 rounded-2xl border border-border bg-[var(--lp-glass)] px-4 py-3 lp-shadow-lg backdrop-blur">
              <span className="grid h-8 w-8 place-items-center rounded-lg gradient-fill text-white">
                <Bot size={15} />
              </span>
              <div>
                <p className="text-xs font-semibold text-text">AI advisor</p>
                <p className="text-[11px] text-text-muted">3 fixes ready to apply</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ==================== TRUST MARQUEE ==================== */}
      <section className="border-y border-border bg-surface py-10">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
          Plays nicely with the tools your team already uses
        </p>
        <div className="marquee-wrap group relative mt-6 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
          <div className="marquee gap-14 pr-14">
            {[...ECOSYSTEM, ...ECOSYSTEM].map((name, i) => (
              <span key={i} className="whitespace-nowrap text-xl font-bold tracking-tight text-text-muted/60 grayscale transition group-hover:text-text-muted/80">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ============= PRODUCT MODULES (pinned horizontal scroll on desktop) ============= */}
      <section ref={pinRef} className="relative py-20 sm:py-28 lg:h-[360vh] lg:py-0">
        <div className="lp-grid absolute inset-0 -z-10" />
        <div className="relative lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-center lg:overflow-hidden">
          {/* soft colour wash so the glass cards read as frosted */}
          <div className="pointer-events-none absolute inset-0 -z-10 hidden lg:block" aria-hidden>
            <div className="absolute left-[10%] top-1/3 h-72 w-72 rounded-full bg-[rgba(29,125,189,0.20)] blur-3xl" />
            <div className="absolute right-[12%] top-1/2 h-80 w-80 rounded-full bg-[rgba(99,102,241,0.16)] blur-3xl" />
            <div className="absolute bottom-[14%] left-[46%] h-72 w-72 rounded-full bg-[rgba(34,195,238,0.18)] blur-3xl" />
          </div>
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <Reveal className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                <span className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Product</span>
                <h2 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
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
                  className="grid h-11 w-11 place-items-center rounded-full border border-border bg-surface text-text-muted transition hover:border-primary hover:text-primary"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => scrollRail(1)}
                  aria-label="Scroll modules right"
                  className="grid h-11 w-11 place-items-center rounded-full border border-border bg-surface text-text-muted transition hover:border-primary hover:text-primary"
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
            className="mt-10 snap-x snap-mandatory overflow-x-auto pb-4 lg:snap-none lg:overflow-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div
              ref={railRef}
              className="flex gap-6 px-4 will-change-transform sm:px-6 lg:pl-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))] lg:pr-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))]"
            >
              {WIDGETS.map((w) => (
                <article
                  key={w.key}
                  className="lp-card group relative flex h-[380px] w-[86vw] max-w-[500px] shrink-0 snap-start flex-col overflow-hidden rounded-[16px] border border-white/50 bg-[color-mix(in_srgb,#ffffff_42%,transparent)] backdrop-blur-2xl lp-shadow sm:w-[500px]"
                >
                  {/* soft brand gradient wash (blue → cyan → violet) behind the glass */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_srgb,#1d7dbd_20%,transparent),transparent_46%,color-mix(in_srgb,#7c3aed_16%,transparent))] opacity-80 transition-opacity duration-300 group-hover:opacity-100"
                  />
                  {/* header — no fill, blends into the glass card */}
                  <div className="relative flex items-center gap-3 px-6 pt-6">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl gradient-fill text-white shadow-glow">
                      <w.icon size={19} />
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
                  {/* body */}
                  <div className="relative flex flex-1 flex-col justify-center overflow-hidden px-6 pb-6 pt-5">
                    <DashboardWidget tab={w.key} />
                  </div>
                </article>
              ))}
              <div className="w-px shrink-0" aria-hidden />
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FEATURE BENTO ==================== */}
      <section className="border-t border-border bg-[var(--lp-tint)] py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Platform</span>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Everything to dominate search
            </h2>
            <p className="mt-4 text-lg text-text-muted">SEO, GEO, AEO and AI visibility — one intelligent system.</p>
          </Reveal>

          <div className="mt-12 grid auto-rows-[minmax(150px,auto)] gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENTO.map((b, i) => (
              <Reveal key={b.title} delay={(i % 4) * 0.06} className={b.span}>
                <div
                  className={`lp-card group flex h-full flex-col rounded-3xl border p-6 lp-shadow ${
                    b.hero ? "lp-ring justify-between border-transparent lp-glass" : "border-border lp-glass"
                  }`}
                >
                  <span className={`grid h-12 w-12 place-items-center rounded-2xl transition-colors group-hover:gradient-fill group-hover:text-white lp-tone-${b.tone}`}>
                    <b.icon size={22} />
                  </span>
                  <div className={b.hero ? "mt-8" : "mt-5"}>
                    <h3 className={`font-bold tracking-tight ${b.hero ? "text-2xl" : "text-lg"}`}>{b.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-text-muted">{b.desc}</p>
                  </div>
                  {b.hero && (
                    <div className="mt-6 h-24 rounded-xl border border-border bg-[var(--lp-panel)] p-2">
                      <AreaChart values={[18, 30, 26, 44, 52, 70, 66, 90]} id="bento-ai" height={80} tone="teal" />
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== STICKY WORKFLOW ==================== */}
      <section ref={flowRef} className="relative lg:h-[280vh]">
        <div className="lg:sticky lg:top-0 lg:flex lg:min-h-screen lg:items-center">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div>
              <span className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Workflow</span>
              <h2 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
                From audit to growth, on autopilot
              </h2>
              <p className="mt-4 text-lg text-text-muted">
                A closed loop that keeps improving your visibility — you stay in control, the platform does the work.
              </p>
              <ol className="mt-6 space-y-1.5">
                {FLOW.map((s, i) => {
                  const active = i === flowStep;
                  return (
                    <li key={s.k}>
                      <div
                        className={`flex items-start gap-4 rounded-2xl border p-3.5 transition-all duration-300 ${
                          active
                            ? "border-primary bg-surface shadow-md"
                            : "border-border bg-surface lg:border-transparent lg:bg-transparent lg:opacity-60"
                        }`}
                      >
                        <span
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors ${
                            active ? "gradient-fill text-white" : "bg-surface-2 text-text-muted"
                          }`}
                        >
                          <s.icon size={17} />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-text-muted">0{i + 1}</span>
                            <h3 className="font-bold">{s.k}</h3>
                          </div>
                          {/* Progressive disclosure: on desktop only the active step
                              shows its description, keeping the column within one screen. */}
                          <p className={`mt-0.5 text-sm text-text-muted ${active ? "" : "lg:hidden"}`}>{s.desc}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Live panel that updates with scroll */}
            <div className="hidden lg:block">
              <div className="lp-ring rounded-3xl">
                <div className="rounded-3xl border border-border lp-glass p-6 lp-shadow-lg">
                  <motion.div
                    key={flowStep}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                  >
                      <div className="flex items-center gap-3">
                        <span className="grid h-11 w-11 place-items-center rounded-xl gradient-fill text-white">
                          {(() => {
                            const Icon = FLOW[flowStep].icon;
                            return <Icon size={20} />;
                          })()}
                        </span>
                        <div>
                          <p className="text-xs text-text-muted">Step 0{flowStep + 1}</p>
                          <h4 className="text-lg font-bold">{FLOW[flowStep].k}</h4>
                        </div>
                      </div>
                      <p className="mt-4 text-sm text-text-muted">{FLOW[flowStep].desc}</p>
                      <div className="mt-5 h-40 rounded-xl border border-border bg-[var(--lp-panel)] p-3">
                        {flowStep % 2 === 0 ? (
                          <AreaChart
                            values={TRAFFIC.map((v) => v + flowStep * 4)}
                            id={`flow-${flowStep}`}
                            height={140}
                            tone={FLOW_TONES[flowStep % FLOW_TONES.length]}
                          />
                        ) : (
                          <Bars values={[40, 62, 50, 78, 64, 92, 74, 88]} className="h-full" tone={FLOW_TONES[flowStep % FLOW_TONES.length]} />
                        )}
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        {["Issues", "Keywords", "Score"].map((k, j) => (
                          <div key={k} className="rounded-xl border border-border bg-surface px-3 py-2">
                            <div className="text-sm font-bold text-text">
                              <CountUp to={[12, 432, 98][j] + flowStep} />
                            </div>
                            <div className="text-[10px] text-text-muted">{k}</div>
                          </div>
                        ))}
                      </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== CASE STUDIES ==================== */}
      <section className="border-t border-border py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal className="max-w-2xl">
            <span className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Case studies</span>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Real teams, real growth</h2>
          </Reveal>

          <div className="mt-14 space-y-8">
            {CASES.map((c, i) => (
              <Reveal key={c.name}>
                <div className={`grid items-center gap-8 rounded-[28px] border border-border bg-surface p-6 lp-shadow sm:p-8 lg:grid-cols-2 ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
                  <div>
                    <span className="inline-flex rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">{c.tag}</span>
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
                  <div className="lp-ring overflow-hidden rounded-2xl">
                    <LandingImage
                      src={`/content-assets/landing/case-${i + 1}.png`}
                      alt={`${c.name} — organic traffic growth in the seodada dashboard`}
                      className="block w-full rounded-2xl border border-border"
                      fallback={
                        <div className="rounded-2xl border border-border bg-[var(--lp-panel)] p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-text">Organic traffic</span>
                            <span className="text-sm font-semibold text-emerald-600">{c.metrics[0].prefix}{c.metrics[0].v.toLocaleString()}{c.metrics[0].suffix}</span>
                          </div>
                          <div className="mt-2 h-40">
                            <AreaChart values={c.traffic} id={`case-${i}`} height={150} tone={i % 2 ? "violet" : "emerald"} />
                          </div>
                        </div>
                      }
                    />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== STATISTICS ==================== */}
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

      {/* ==================== TESTIMONIALS CAROUSEL ==================== */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-1 text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={16} fill="currentColor" />
                ))}
                <span className="ml-2 text-sm font-semibold text-text">4.9/5 · 500+ reviews</span>
              </div>
              <h2 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Loved by SEO teams</h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setTIdx((n) => (n - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)}
                aria-label="Previous testimonial"
                className="grid h-11 w-11 place-items-center rounded-full border border-border bg-surface text-text-muted transition hover:border-primary hover:text-primary"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setTIdx((n) => (n + 1) % TESTIMONIALS.length)}
                aria-label="Next testimonial"
                className="grid h-11 w-11 place-items-center rounded-full border border-border bg-surface text-text-muted transition hover:border-primary hover:text-primary"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </Reveal>

          <div className="mt-10 overflow-hidden">
            <motion.div className="flex" animate={{ x: `calc(-${tIdx} * (100% / 1))` }} transition={{ type: "spring", stiffness: 120, damping: 20 }}>
              {TESTIMONIALS.map((t) => (
                <div key={t.name} className="w-full shrink-0 md:w-1/2 md:pr-6 lg:w-1/3">
                  <figure className="lp-card flex h-full flex-col rounded-3xl border border-border lp-glass p-7 lp-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={13} fill="currentColor" />
                        ))}
                      </div>
                      <button aria-label="Play video testimonial" className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-primary transition hover:gradient-fill hover:text-white">
                        <Play size={14} />
                      </button>
                    </div>
                    <blockquote className="mt-4 flex-1 leading-relaxed text-text">"{t.quote}"</blockquote>
                    <figcaption className="mt-6 flex items-center gap-3">
                      <LandingImage
                        src={t.avatar}
                        alt={t.name}
                        className="h-11 w-11 shrink-0 rounded-full object-cover"
                        fallback={
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full gradient-fill text-sm font-bold text-white">
                            {t.initials}
                          </span>
                        }
                      />
                      <span>
                        <span className="block text-sm font-semibold text-text">{t.name}</span>
                        <span className="block text-xs text-text-muted">{t.role}</span>
                      </span>
                    </figcaption>
                  </figure>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ==================== PRICING ==================== */}
      <section className="border-t border-border bg-[var(--lp-tint)] py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Pricing</span>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Simple, <span className="gradient-text">transparent pricing</span>
            </h2>
            <p className="mt-4 text-lg text-text-muted">Every plan unlocks the full suite. Scale by daily analyses.</p>
            <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1 text-sm font-semibold">
              <button onClick={() => setAnnual(false)} className={`rounded-full px-4 py-1.5 transition ${!annual ? "gradient-fill text-white shadow" : "text-text-muted"}`}>Monthly</button>
              <button onClick={() => setAnnual(true)} className={`rounded-full px-4 py-1.5 transition ${annual ? "gradient-fill text-white shadow" : "text-text-muted"}`}>
                Yearly <span className="ml-1.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-600">2 months free</span>
              </button>
            </div>
          </Reveal>

          <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-4">
            {PLANS.map((p, i) => {
              const price = annual ? p.monthly * 10 : p.monthly;
              return (
                <Reveal key={p.name} delay={i * 0.06} className="h-full">
                  <div className={`lp-card relative flex h-full flex-col rounded-3xl border lp-glass p-7 lp-shadow ${p.popular ? "lp-ring border-transparent" : "border-border"}`}>
                    {p.popular && (
                      <span className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full gradient-fill px-3 py-1 text-xs font-semibold text-white shadow-glow">
                        <Sparkles size={13} /> Most popular
                      </span>
                    )}
                    <h3 className="text-lg font-bold">{p.name}</h3>
                    <p className="mt-1 text-sm text-text-muted">{p.blurb}</p>
                    <div className="mt-6 flex items-end gap-1.5">
                      <span className="text-4xl font-extrabold tracking-tight">{inr(price)}</span>
                      <span className="pb-1 text-sm text-text-muted">/{annual ? "yr" : "mo"}</span>
                    </div>
                    <p className="mt-1 text-xs text-text-muted">{p.perDay} analyses / day</p>
                    <RouterLink to={authed ? "/billing" : "/register"} className="mt-6">
                      <Button className={`w-full rounded-full ${p.popular ? "gradient-fill text-white shadow-glow hover:opacity-95" : ""}`} variant={p.popular ? "primary" : "secondary"}>
                        {authed ? "Choose plan" : "Start free"}
                      </Button>
                    </RouterLink>
                    <ul className="mt-6 space-y-2.5 border-t border-border pt-6">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-text">
                          <Check size={16} className="mt-0.5 shrink-0 text-primary" /> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              );
            })}

            {/* Enterprise — deep brand gradient card (premium tier) */}
            <Reveal delay={0.18} className="h-full">
              <div
                className="lp-card relative flex h-full flex-col justify-between overflow-hidden rounded-3xl p-7 text-white lp-shadow-lg"
                style={{
                  background:
                    "radial-gradient(120% 120% at 100% 0%, rgba(34,195,238,0.28), transparent 55%)," +
                    "linear-gradient(150deg, #1b2a63 0%, #2e3f87 45%, #1d7dbd 100%)",
                }}
              >
                {/* subtle sheen */}
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
                <div className="relative">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                    <Sparkles size={12} /> Enterprise
                  </span>
                  <h3 className="mt-4 text-lg font-bold">Enterprise</h3>
                  <p className="mt-1 text-sm text-white/75">For large orgs and agencies at scale.</p>
                  <div className="mt-6 text-4xl font-extrabold tracking-tight">Custom</div>
                  <p className="mt-1 text-xs text-white/70">Unlimited seats &amp; analyses</p>
                  <ul className="mt-6 space-y-2.5 border-t border-white/20 pt-6">
                    {["SSO & audit logs", "Dedicated infrastructure", "Custom integrations", "SLA & onboarding"].map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-white/95">
                        <Check size={16} className="mt-0.5 shrink-0 text-sky-300" /> {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <RouterLink to="/contact" className="relative mt-6">
                  <Button className="w-full rounded-full bg-white text-[#2e3f87] hover:bg-white/90">Contact sales</Button>
                </RouterLink>
              </div>
            </Reveal>
          </div>
          <p className="mt-6 text-center text-xs text-text-muted">Prices in ₹ (India, incl. Razorpay + GST). Cancel any time.</p>
        </div>
      </section>

      {/* ==================== FAQ ==================== */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <Reveal className="text-center">
            <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Frequently asked questions</h2>
            <p className="mt-4 text-lg text-text-muted">Everything you need to know before you start.</p>
          </Reveal>
          <div className="mt-12 space-y-3">
            {FAQS.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ==================== FINAL CTA ==================== */}
      <section className="px-4 pb-24 sm:px-6">
        <Reveal>
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[36px] px-6 py-20 text-center lp-shadow-lg sm:px-12 sm:py-24">
            <div className="absolute inset-0 -z-10 gradient-fill" />
            <div className="lp-mesh absolute inset-0 -z-10 opacity-40 mix-blend-overlay" />
            <Particles count={20} className="-z-10 opacity-60" />
            <h2 className="mx-auto max-w-3xl text-5xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl">
              Dominate search — classic, AI, and everything next.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-white/80">
              Start free, no credit card. Or book a demo and we'll map your growth plan.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Magnetic>
                <RouterLink to={primaryTo}>
                  <Button size="lg" className="rounded-full bg-white text-[#2e3f87] shadow-lg hover:bg-white/90">
                    {primaryLabel} <ArrowRight size={16} />
                  </Button>
                </RouterLink>
              </Magnetic>
              <RouterLink to="/contact">
                <Button size="lg" variant="secondary" className="rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20">
                  <PhoneCall size={15} /> Book a demo
                </Button>
              </RouterLink>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-sm text-white/80">
              {[
                { icon: Zap, label: "Free instant tools" },
                { icon: ShieldCheck, label: "GDPR-friendly" },
                { icon: Bell, label: "Cancel any time" },
              ].map((t) => (
                <span key={t.label} className="inline-flex items-center gap-2">
                  <t.icon size={15} /> {t.label}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

/** Accessible glass accordion item with animated expansion. */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-border lp-glass lp-shadow transition-colors hover:border-primary">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-text"
      >
        {q}
        <ChevronDown size={18} className={`shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <p className="px-5 pb-5 text-sm leading-relaxed text-text-muted">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
