import { ChevronDown } from "lucide-react";

import { Reveal } from "@/components/public/landingKit";

const FAQS = [
  { q: "Is there a free plan?", a: "Yes. Create an account and run a set number of analyses every day for free — no credit card. Upgrade any time for a higher daily limit." },
  { q: "What is GEO and AEO?", a: "Generative Engine Optimization and Answer Engine Optimization — making your content the source AI assistants (ChatGPT, Google AI) cite. seodada tracks and improves your AI visibility alongside classic SEO." },
  { q: "What data does seodada use?", a: "Live data from your own pages (our in-house crawler) plus search-intelligence providers for SERP, keywords, and backlinks — with free fallbacks so nothing breaks." },
  { q: "Can I cancel or change my plan?", a: "Any time, from the Billing page. Plans are billed via Razorpay with a GST invoice you can download." },
  { q: "Is my data secure?", a: "Your account is isolated to your organization, passwords are hashed with bcrypt, and we never share your data with third parties." },
];

export function Faq() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Reveal className="text-center">
          <h2 className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">Frequently asked questions</h2>
          <p className="mt-4 text-lg text-text-muted">Everything you need to know before you start.</p>
        </Reveal>
        <div className="mt-12 space-y-3">
          {FAQS.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Native <details> accordion (UI_DESIGN_PROMPTS §8, item 8).
 *
 * Deliberately not a JS-state accordion: with <details> the answers stay in
 * the DOM when collapsed, so search engines index them and in-page find (⌘F)
 * reaches them — which matters more here than anywhere else in the product,
 * because this is the page we most want crawled. Keyboard operation, the
 * expanded state and screen-reader semantics all come free from the element.
 *
 * The trade-off is that height can't be animated (no framer-motion here);
 * the marker rotation carries the state change instead.
 */
function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group overflow-hidden rounded-xl border border-border bg-surface lp-shadow transition-colors hover:border-[color:var(--primary)] open:border-[color:var(--primary)]">
      <summary
        className={[
          "flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4",
          "font-semibold text-text marker:hidden [&::-webkit-details-marker]:hidden",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--primary)]",
        ].join(" ")}
      >
        {q}
        {/* Uses the standalone `rotate` property rather than Tailwind's
            `rotate-180`: the latter composes through --tw-transform, and
            something later in this page's cascade flattens that stack back to
            identity. `rotate` sidesteps it and animates just as well. */}
        <ChevronDown
          size={18}
          aria-hidden
          className="shrink-0 text-text-muted transition-[rotate] duration-[var(--dur-2)] ease-[var(--ease)] group-open:[rotate:180deg]"
        />
      </summary>
      <p className="px-5 pb-5 text-sm leading-relaxed text-text-muted">{a}</p>
    </details>
  );
}
