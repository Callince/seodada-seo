import { Check, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import { Reveal } from "@/components/public/landingKit";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/store/auth";

const PLANS = [
  { name: "Basic", monthly: 799, perDay: 30, blurb: "Solo SEOs and small sites.", popular: false, features: ["Full analytics suite", "30 analyses / day", "Free on-page tools", "Email support"] },
  { name: "Pro", monthly: 4999, perDay: 50, blurb: "Growing teams and agencies.", popular: true, features: ["Everything in Basic", "50 analyses / day", "Rank tracking + AI advisor", "Scheduled monitoring", "Priority support"] },
  { name: "Premium", monthly: 8999, perDay: 100, blurb: "High-volume operators.", popular: false, features: ["Everything in Pro", "100 analyses / day", "AI content factory", "Web stories", "Success manager"] },
] as const;

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

export function Pricing() {
  const authed = useAuth((s) => !!s.accessToken);
  const [annual, setAnnual] = useState(false);

  return (
    <section className="border-t border-border bg-[var(--lp-tint)] py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-ink">Pricing</span>
          <h2 className="mt-3 text-balance text-[2rem] font-extrabold tracking-tight sm:text-5xl">
            Simple, <span className="gradient-text">transparent pricing</span>
          </h2>
          <p className="mt-4 text-lg text-text-muted">Every plan unlocks the full suite. Scale by daily analyses.</p>
          <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1 text-sm font-semibold">
            <button onClick={() => setAnnual(false)} className={`rounded-full px-4 py-1.5 transition ${!annual ? "gradient-fill text-white shadow" : "text-text-muted"}`}>Monthly</button>
            <button onClick={() => setAnnual(true)} className={`rounded-full px-4 py-1.5 transition ${annual ? "gradient-fill text-white shadow" : "text-text-muted"}`}>
              {/* Tokens, not raw emerald-500/600: that pairing measured 3.27:1
                  at 10px. --sec-rank-ink is the token-side green that passes. */}
              Yearly <span className="ml-1.5 rounded-full bg-[color:var(--sec-rank-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--sec-rank-ink)]">2 months free</span>
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
                <Button variant="secondary" className="w-full rounded-full bg-white text-[#2e3f87] hover:bg-white/90">Contact sales</Button>
              </RouterLink>
            </div>
          </Reveal>
        </div>
        <p className="mt-6 text-center text-xs text-text-muted">Prices in ₹ (India, incl. Razorpay + GST). Cancel any time.</p>
      </div>
    </section>
  );
}
