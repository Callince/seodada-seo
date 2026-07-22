import { motion } from "framer-motion";
import { ArrowRight, PhoneCall, Search, Sparkles, Star } from "lucide-react";
import { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import { usePublicAnalyze } from "@/api/hooks/usePublicAnalyze";
import { AnalyzerResult } from "@/components/public/PageAnalyzer";
import { Magnetic, Particles } from "@/components/public/landingKit";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/store/auth";

/** A URL is analysable here; a bare keyword is not — route those to the app. */
const looksLikeUrl = (q: string) => /\.[a-z]{2,}(\/|$|\?)/i.test(q.replace(/^https?:\/\//i, ""));

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

      {/* Single centred column — the 3D model that used to fill a right
          column is gone, and centred copy carries a hero better than
          left-aligned copy beside empty space. */}
      <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-24 sm:px-6 lg:pb-14 lg:pt-20">
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.09 } } }}
          className="relative z-10 mx-auto max-w-3xl text-center"
        >
          <motion.span
            variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--lp-primary-border)] bg-primary-soft px-3.5 py-1.5 text-xs font-semibold text-primary-ink"
          >
            <Sparkles size={13} /> AI-powered SEO · GEO · AEO
          </motion.span>
          {/* Display size and 0.95–1.0 leading are the point, not a garnish —
              measured ahrefs' hero at 60px/57px. Loose leading on huge type is
              what makes a page read "template"; the tight setting is what reads
              as conviction. */}
          <motion.h1
            variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
            className="mt-5 text-balance text-[2.1rem] font-black uppercase leading-[0.98] tracking-[-0.02em] text-text sm:text-5xl sm:leading-[0.95] lg:text-6xl xl:text-[4.75rem]"
          >
            Rank in search.
            <br />
            <span className="gradient-text-anim">And in the answers.</span>
          </motion.h1>
          <motion.p
            variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
            className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-text-muted sm:text-lg"
          >
            One platform to research, audit, optimise and track — across classic search, AI answer
            engines and generative results. Paste a URL and get the full breakdown in seconds.
          </motion.p>

          <motion.form
            variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
            onSubmit={onAnalyze}
            className="mx-auto mt-6 flex max-w-lg items-center gap-2 rounded-full border border-border bg-[var(--lp-glass)] p-1.5 pl-4 shadow-lg backdrop-blur"
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

          <AnalyzerResult
            state={analyze}
            onReset={() => analyze.reset()}
          />

          <motion.div
            variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
            className="mt-5 flex flex-wrap items-center justify-center gap-3"
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

          {/* Data-scale proof, ahrefs-style: numbers with rules between them,
              not an avatar pile. Every figure here is a claim the site already
              makes elsewhere (Stats, reviews) — nothing is invented for the
              hero, so the two sections can never disagree. */}
          <motion.div
            variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
            className="mx-auto mt-8 grid max-w-lg grid-cols-3 divide-x divide-border border-t border-border pt-5 text-left"
          >
            {[
              { n: "1.2M+", l: "URLs analysed" },
              { n: "2,000+", l: "teams on board" },
              { n: "4.9/5", l: "from 500+ reviews", star: true },
            ].map((s) => (
              <div key={s.l} className="px-4 first:pl-0 last:pr-0">
                <div className="flex items-baseline gap-1 text-xl font-extrabold tracking-tight text-text sm:text-2xl">
                  {s.n}
                  {s.star && <Star size={13} className="text-warning" fill="currentColor" aria-hidden />}
                </div>
                <div className="mt-0.5 text-xs leading-snug text-text-muted">{s.l}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
