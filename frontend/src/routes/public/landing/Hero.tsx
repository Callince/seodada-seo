import { motion } from "framer-motion";
import { ArrowRight, Check, PhoneCall, Search, Sparkles, Star, X } from "lucide-react";
import { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import { apiErrorMessage } from "@/api/client";
import { usePublicAnalyze } from "@/api/hooks/usePublicAnalyze";
import { Magnetic, Particles } from "@/components/public/landingKit";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/store/auth";

import { ToolConstellation } from "./ToolConstellation";

/** A URL is analysable here; a bare keyword isn't — route those to the app. */
const looksLikeUrl = (q: string) => /\.[a-z]{2,}(\/|$|\?)/i.test(q.replace(/^https?:\/\//i, ""));

/** The payoff: a real audit of the visitor's own page, inline, before signup.
 *  Shows genuine passes AND failures — a demo that only ever says "all good"
 *  proves nothing. The sign-up CTA is the next step, not the price of entry. */
function InstantResult({
  state,
  onReset,
}: {
  state: ReturnType<typeof usePublicAnalyze>;
  onReset: () => void;
}) {
  if (state.isPending) {
    return (
      <p className="mt-3 text-sm text-text-muted lg:text-left">
        Fetching and analysing that page…
      </p>
    );
  }
  if (state.isError) {
    const status = (state.error as { response?: { status?: number } })?.response?.status;
    return (
      <p className="mt-3 text-sm text-danger lg:text-left">
        {status === 429
          ? "That's a few checks in a row — give it a minute, or create a free account for unlimited runs."
          : apiErrorMessage(state.error)}
      </p>
    );
  }
  const d = state.data;
  if (!d) return null;

  const tone = d.score >= 80 ? "text-success" : d.score >= 50 ? "text-warning" : "text-danger";
  const failed = d.checks.filter((c) => !c.ok);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto mt-4 max-w-lg rounded-2xl border border-border bg-[var(--lp-glass)] p-4 text-left shadow-lg backdrop-blur lg:mx-0"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-text-muted">{d.url}</p>
          <p className="mt-0.5 text-sm font-semibold text-text">
            <span className={`font-mono text-xl ${tone}`}>{d.score}%</span>{" "}
            <span className="text-text-muted">— {d.passed} of {d.total} checks passed</span>
          </p>
        </div>
        <button
          onClick={onReset}
          className="shrink-0 rounded-md px-2 py-1 text-xs text-text-muted hover:bg-surface-2 hover:text-text"
        >
          Clear
        </button>
      </div>

      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {d.checks.map((c) => (
          <li key={c.label} className="flex items-center gap-1.5 text-xs">
            {c.ok ? (
              <Check size={13} className="shrink-0 text-success" />
            ) : (
              <X size={13} className="shrink-0 text-danger" />
            )}
            <span className={c.ok ? "text-text-muted" : "font-medium text-text"}>{c.label}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 border-t border-border pt-3 text-xs text-text-muted">
        {failed.length > 0
          ? `${failed.length} issue${failed.length > 1 ? "s" : ""} found on this page. `
          : "The basics look good. "}
        Create a free account to crawl the whole site, track rankings, and see the full fix list.
      </p>
      <RouterLink to="/register" className="mt-2 inline-block">
        <Button size="sm" className="rounded-full">
          See the full report <ArrowRight size={14} />
        </Button>
      </RouterLink>
    </motion.div>
  );
}

export function Hero() {
  const authed = useAuth((s) => !!s.accessToken);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const analyze = usePublicAnalyze();

  const primaryTo = authed ? "/dashboard" : "/register";
  const primaryLabel = authed ? "Go to dashboard" : "Start free trial";

  const onAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    // Signed in, or it's a keyword rather than a URL → the full tool handles it.
    if (authed || !looksLikeUrl(q)) {
      const to = authed ? "/workspace" : "/register";
      navigate(`${to}?q=${encodeURIComponent(q)}`);
      return;
    }
    // Anonymous visitor with a URL: show them a real result right here. Asking
    // someone to type a URL and then paywalling the answer is where trust dies.
    analyze.mutate(q.startsWith("http") ? q : `https://${q}`);
  };

  return (
    <section
      className="lp-hero lp-noise cyber-grid grid-drift relative flex min-h-[100svh] items-center overflow-hidden"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
        e.currentTarget.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
      }}
    >
      {/* Deep navy → ocean surface: the same backdrop the tools and other
          public pages use (PublicHero), on the --hero-* tokens so it is
          identical in both themes. */}
      <div
        className="absolute inset-0 -z-20"
        style={{
          background:
            "linear-gradient(180deg,var(--hero-deep) 0%,var(--hero-mid) 46%,var(--hero-rim) 100%)",
        }}
      />
      {/* Aurora light pools — slowly drifting. */}
      <div
        className="aurora-drift absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(70% 60% at 50% 118%, color-mix(in srgb, var(--hero-glow) 38%, transparent), transparent 62%)," +
            "radial-gradient(46% 42% at 12% 4%, color-mix(in srgb, var(--hero-wash) 55%, transparent), transparent 60%)," +
            "radial-gradient(42% 40% at 90% 8%, color-mix(in srgb, var(--hero-tide) 42%, transparent), transparent 60%)",
        }}
      />
      {/* Floating neon orbs. */}
      <div
        className="float-slow absolute right-[-8%] top-[16%] -z-10 h-72 w-72 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "conic-gradient(from 130deg,var(--hero-wash),var(--hero-tide),var(--hero-glow),var(--hero-wash))",
        }}
      />
      <div
        className="float-slower absolute left-[-6%] top-[48%] -z-10 h-56 w-56 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle,var(--hero-glow),transparent 70%)" }}
      />
      <div className="lp-cursor absolute inset-0 -z-10" />
      <Particles count={18} className="-z-10" />
      {/* Vignette so the section below reads cleanly against the hero. */}
      <div
        className="absolute inset-x-0 bottom-0 -z-10 h-1/3"
        style={{
          background:
            "linear-gradient(180deg, transparent, color-mix(in srgb, var(--hero-deep) 85%, transparent))",
        }}
      />

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
            className="inline-flex items-center gap-2 rounded-full border border-[var(--lp-primary-border)] bg-primary-soft px-3.5 py-1.5 text-xs font-semibold text-primary-ink"
          >
            <Sparkles size={13} /> AI-powered SEO · GEO · AEO
          </motion.span>
          <motion.h1
            variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
            className="mt-5 text-balance text-[2rem] font-extrabold leading-[1.08] tracking-tight text-text sm:text-5xl sm:leading-[1.03] lg:text-6xl xl:text-7xl"
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
            <Button
              type="submit"
              loading={analyze.isPending}
              className="gradient-fill rounded-full px-5 text-white shadow-glow"
            >
              {!analyze.isPending && <>Analyze <ArrowRight size={15} /></>}
            </Button>
          </motion.form>

          <InstantResult
            state={analyze}
            onReset={() => analyze.reset()}
          />

          <motion.div
            variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
            className="mt-5 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
          >
            <Magnetic>
              <RouterLink to={primaryTo}>
                <Button size="lg" className="rounded-full">
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
            className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6 sm:gap-y-3 lg:justify-start"
          >
            <div className="flex -space-x-2">
              {["PN", "AM", "SO", "RK"].map((x, i) => (
                <span
                  key={x}
                  className="grid h-8 w-8 place-items-center rounded-full border-2 border-surface text-[10px] font-bold text-white"
                  style={{ background: i % 2 ? "var(--signal-0)" : "var(--signal-1)" }}
                >
                  {x}
                </span>
              ))}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-0.5 text-warning">
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
          <div className="absolute inset-8 -z-10 rounded-[2.5rem] bg-gradient-to-tr from-[color-mix(in_srgb,var(--signal-1)_40%,transparent)] to-[color-mix(in_srgb,var(--signal-2)_40%,transparent)] blur-3xl" />
          <ToolConstellation />
        </motion.div>
      </div>
    </section>
  );
}
