import { ArrowRight, Check } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";

import { getPage } from "@/content";
import { Button } from "@/components/ui/button";

/** Included-in-every-plan features, migrated from the seodada pricing page.
 *  Actual priced tiers are served from the billing DB (Phase 4/6); until a
 *  plan is selected we show what every plan includes + a clear call to action. */
function includedFeatures(): string[] {
  const page = getPage("pricing");
  if (!page) return [];
  // The pricing template lists inclusions as short prose blocks; keep the
  // sentence-style ones (skip dynamic fragments like "for days").
  const seen = new Set<string>();
  return page.text_blocks
    .filter((b) => b.length > 14 && /[a-z]/i.test(b) && !/^\W|₹|POPULAR/i.test(b))
    .filter((b) => !seen.has(b) && seen.add(b))
    .slice(0, 8);
}

export default function Pricing() {
  useEffect(() => {
    document.title = "Pricing — seodada";
  }, []);
  const features = includedFeatures();

  return (
    <div className="aurora-bg">
      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Simple, <span className="gradient-text">transparent pricing</span>
          </h1>
          <p className="mt-4 text-lg text-text-muted">
            Choose the plan that fits your SEO needs. Every plan includes access to the full
            analytics suite — pay only for the operations you run.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-3xl rounded-3xl border border-border bg-surface p-8 shadow-lg sm:p-10">
          <h2 className="text-lg font-semibold">All plans include</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm">
                <Check size={18} className="mt-0.5 shrink-0 text-success" />
                <span className="text-text-muted">{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border pt-6">
            <Link to="/register">
              <Button size="lg" className="gradient-fill text-white shadow-glow hover:opacity-95">
                Start free
                <ArrowRight size={16} />
              </Button>
            </Link>
            <Link to="/contact">
              <Button size="lg" variant="secondary">
                Need a custom plan?
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
