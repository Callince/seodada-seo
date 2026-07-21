import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { getPage } from "@/content";
import { PublicHero } from "@/components/public/PublicHero";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Seo } from "@/lib/seo";
import { BASE_CURRENCY, formatMoney, useSiteCurrency } from "@/lib/currency";

/** The real, active seodada subscription plans — migrated from the production
 *  database (public.subscriptions). Prices in ₹/month (India, Razorpay + GST).
 *  Live checkout is wired once billing lands (Phase 4); until then these drive
 *  the public pricing page from real numbers, not placeholders. */
const PLANS = [
  {
    name: "Basic",
    price: 799,
    perDay: 30,
    blurb: "For solo SEOs and small sites getting serious about search.",
    popular: false,
  },
  {
    name: "Pro",
    price: 4999,
    perDay: 50,
    blurb: "For growing teams and agencies running SEO daily.",
    popular: true,
  },
  {
    name: "Premium",
    price: 8999,
    perDay: 100,
    blurb: "For high-volume operators and enterprise workloads.",
    popular: false,
  },
] as const;


/**
 * The page LLMs read to answer "how much does seodada cost" — without this
 * they guess from prose. Built from the same PLANS array the cards render, so
 * the schema can never quote a price the page doesn't show. The free tier is
 * included because the product genuinely has one (signup, daily analysis
 * quota, no card) and "is there a free plan" is the single most-asked pricing
 * question an answer engine fields.
 */
const PRICING_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "seodada",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "AI-powered SEO platform — keyword research, technical audits, rank tracking, and AI visibility across ChatGPT, Perplexity and Google AI Overviews.",
  offers: [
    {
      "@type": "Offer",
      name: "Free",
      price: 0,
      priceCurrency: "INR",
      description: "Free daily analyses with an account — no credit card.",
    },
    ...PLANS.map((p) => ({
      "@type": "Offer" as const,
      name: p.name,
      price: p.price,
      priceCurrency: "INR",
      description: `${p.blurb} ${p.perDay} analyses per day, billed monthly with GST invoice.`,
    })),
  ],
};

/** Features included in every plan, migrated from the seodada pricing copy. */
function includedFeatures(): string[] {
  const page = getPage("pricing");
  if (!page) {
    // Fallback so the section is never empty if the catalog changes.
    return [
      "Full SEO analytics suite",
      "SERP & rank tracking",
      "Keyword research",
      "Backlink intelligence",
      "Technical site audits",
      "AI content & advisor",
    ];
  }
  const seen = new Set<string>();
  return page.text_blocks
    .filter((b) => b.length > 14 && /[a-z]/i.test(b) && !/^\W|₹|POPULAR/i.test(b))
    .filter((b) => !seen.has(b) && seen.add(b))
    .slice(0, 8);
}

export default function Pricing() {
  const features = includedFeatures();
  // Site-wide currency, set by an admin. Public endpoint, so this page can
  // convert for anonymous visitors like everything else.
  const { data: fx } = useSiteCurrency();
  const currency = fx?.code || BASE_CURRENCY;
  const rates = fx?.rates;
  // PLANS holds major units (799); formatMoney takes minor units, like every
  // stored amount does.
  const show = (rupees: number) => formatMoney(rupees * 100, currency, rates);

  return (
    <div>
      <Seo
        title="Pricing"
        description="Simple, transparent pricing. Every plan unlocks the full seodada analytics suite — Basic ₹799, Pro ₹4,999, and Premium ₹8,999 per month."
        path="/pricing"
        jsonLd={PRICING_JSONLD}
      />
      {/* ===== Hero ===== */}
      <PublicHero
        eyebrow="Pricing"
        title="Simple,"
        highlight="transparent pricing"
        subtitle="Choose the plan that fits your SEO needs. Every plan unlocks the full analytics suite — you scale by how many analyses you run per day."
      />

      {/* ===== Plan cards ===== */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="-mt-8 grid gap-6 md:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={cn(
                "relative flex flex-col rounded-3xl border bg-surface p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
                p.popular
                  ? "border-primary/40 shadow-glow md:-translate-y-2 md:hover:-translate-y-3"
                  : "border-border",
              )}
            >
              {p.popular && (
                <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
                  <div className="absolute inset-x-0 -top-10 h-40 bg-gradient-to-b from-primary/15 to-transparent blur-2xl" />
                </div>
              )}
              {p.popular && (
                <span className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full gradient-fill px-3 py-1 text-xs font-semibold text-white shadow-glow">
                  <Sparkles size={13} /> Most popular
                </span>
              )}
              <h2 className="text-lg font-semibold text-text">{p.name}</h2>
              <p className="mt-1 min-h-[2.5rem] text-sm text-text-muted">{p.blurb}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold tracking-tight text-text">
                  {show(p.price).text}
                </span>
                <span className="text-sm text-text-muted">/month</span>
              </div>
              <div className="mt-4 flex items-baseline gap-1.5 rounded-xl bg-primary-soft px-4 py-3 text-primary-ink">
                <span className="text-lg font-bold tabular-nums">{p.perDay}</span>
                <span className="text-sm font-medium">analyses per day</span>
              </div>
              <Link to="/register" className="mt-6">
                <Button
                  size="lg"
                  variant={p.popular ? "primary" : "secondary"}
                  className={cn("w-full", p.popular && "gradient-fill text-white shadow-glow")}
                >
                  Get started
                  <ArrowRight size={16} />
                </Button>
              </Link>
              <p className="mt-3 text-center text-xs text-text-muted">
                30-day billing · GST invoice included
              </p>
            </div>
          ))}
        </div>

        {/* ===== Included in every plan ===== */}
        <div className="mx-auto mt-16 max-w-4xl rounded-3xl border border-border bg-surface-2 p-8 sm:p-10">
          <h2 className="text-lg font-semibold">Every plan includes</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success/12 text-success">
                  <Check size={13} strokeWidth={3} />
                </span>
                <span className="text-text-muted">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ===== Bottom CTA ===== */}
        <div className="mx-auto my-16 max-w-4xl rounded-3xl border border-border bg-surface p-8 text-center shadow-sm sm:p-10">
          <h2 className="text-2xl font-bold tracking-tight">Not sure which plan?</h2>
          <p className="mx-auto mt-2 max-w-lg text-text-muted">
            Start free and upgrade any time, or talk to us about a custom volume plan for your team.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/register">
              <Button size="lg">
                Start free <ArrowRight size={16} />
              </Button>
            </Link>
            <Link to="/contact">
              <Button size="lg" variant="secondary">
                Talk to sales
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
