import { Seo, SITE_URL } from "@/lib/seo";

import { AiVisibility } from "./landing/AiVisibility";
import { Faq, FAQS } from "./landing/Faq";
import { FeatureBento } from "./landing/FeatureBento";
import { FinalCta } from "./landing/FinalCta";
import { FreeToolsStrip } from "./landing/FreeToolsStrip";
import { Hero } from "./landing/Hero";
import { Pricing } from "./landing/Pricing";
import { ProductRail } from "./landing/ProductRail";
import { Roles } from "./landing/Roles";
import { Stats } from "./landing/Stats";
import { Testimonials } from "./landing/Testimonials";
import { TrustMarquee } from "./landing/TrustMarquee";
import { Workflow } from "./landing/Workflow";

const SITE_JSONLD = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "seodada",
    url: SITE_URL,
    // The 512px raster, not favicon.svg: Google requires a real bitmap it can
    // crop for the knowledge panel, and this is the same mark as the favicon.
    logo: `${SITE_URL}/icon-512.png`,
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
  // Built from the same FAQS array the visible accordion renders, so the
  // markup can never claim questions the page doesn't show. Google demoted
  // FAQ rich results, but LLMs parse FAQPage heavily — this is an AEO block,
  // not a SERP one, and definitional Q&A is what answer engines quote.
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  },
];

/**
 * Section order is also the background rhythm. From ProductRail down:
 *
 *   rail · BENTO · workflow · AI-VIZ · roles · [stats] · quotes ·
 *   PRICING · faq+cta        (caps = tinted, [brackets] = dark navy)
 *
 * Base and --lp-tint alternate strictly, with ONE deliberate exception: Stats
 * is a full-contrast dark band (the ahrefs colour-blocking move) so the middle
 * of the scroll has an anchor between the dark hero and the gradient CTA. A
 * dark band counts as "opposite fill" to both of its neighbours, so the
 * alternation survives around it.
 *
 * The alternation is also why no section carries `border-t`: a rule between
 * two bands that already differ in fill is a redundant line. If you insert a
 * section here, give it the opposite fill of its neighbour rather than a
 * border — and keep the pairing, or the rhythm breaks two sections deep.
 */
export default function Landing() {
  return (
    <div className="lp overflow-x-clip">
      <Seo
        title="AI SEO Built for the Future of Search"
        description="seodada is an AI-powered SEO intelligence platform — keyword research, technical audits, rank tracking, GEO, AEO and AI visibility in one place."
        path="/"
        jsonLd={SITE_JSONLD}
      />

      {/* ============================ HERO ============================ */}
      <Hero />

      {/* ==================== TRUST MARQUEE ==================== */}
      <TrustMarquee />

      {/* ============= PRODUCT MODULES (pinned horizontal scroll on desktop) ============= */}
      <ProductRail />

      {/* ==================== FREE TOOLS ==================== */}
      {/* Directly after the product rail: the visitor has just seen what the
          platform does, and these are the parts they can use without signing
          up. Further down the page is below the fold for most. */}
      <FreeToolsStrip />

      {/* ==================== FEATURE BENTO ==================== */}
      <FeatureBento />

      {/* ==================== STICKY WORKFLOW ==================== */}
      <Workflow />

      {/* ============ AI VISIBILITY — the differentiator ============ */}
      <AiVisibility />

      {/* ==================== ROLES — what each seat gets ==================== */}
      <Roles />

      {/* ==================== STATISTICS ==================== */}
      <Stats />

      {/* ==================== TESTIMONIALS CAROUSEL ==================== */}
      <Testimonials />

      {/* ==================== PRICING ==================== */}
      <Pricing />

      {/* ==================== FAQ ==================== */}
      <Faq />

      {/* ==================== FINAL CTA ==================== */}
      <FinalCta />
    </div>
  );
}
