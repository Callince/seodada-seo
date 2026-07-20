import { Seo, SITE_URL } from "@/lib/seo";

import { AiVisibility } from "./landing/AiVisibility";
import { CaseStudies } from "./landing/CaseStudies";
import { Faq } from "./landing/Faq";
import { FeatureBento } from "./landing/FeatureBento";
import { FinalCta } from "./landing/FinalCta";
import { Hero } from "./landing/Hero";
import { Pricing } from "./landing/Pricing";
import { ProductRail } from "./landing/ProductRail";
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

/**
 * Section order is also the background rhythm. From ProductRail down, sections
 * alternate base / --lp-tint strictly:
 *
 *   rail · BENTO · workflow · AI-VIZ · cases · STATS · quotes · PRICING · faq+cta
 *   (caps = tinted)
 *
 * It used to run base / tint / base / base / base / tint / base / tint — three
 * flat sections in a row through the middle of the page, so Workflow, AI
 * Visibility and Case Studies read as one undifferentiated scroll.
 *
 * The alternation is also why no section carries `border-t` any more: a rule
 * between two bands that already differ in fill is a redundant line. If you
 * insert a section here, give it the opposite fill of its neighbour rather than
 * a border — and keep the pairing, or the rhythm breaks two sections deep.
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

      {/* ==================== FEATURE BENTO ==================== */}
      <FeatureBento />

      {/* ==================== STICKY WORKFLOW ==================== */}
      <Workflow />

      {/* ============ AI VISIBILITY — the differentiator ============ */}
      <AiVisibility />

      {/* ==================== CASE STUDIES ==================== */}
      <CaseStudies />

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
