import raw from "@/content/toolContent.raw.json";

export interface ToolSection { level: number; title: string; paras: string[] }
export interface ToolFaq { q: string; a: string }
export interface ToolContent { sections: ToolSection[]; faqs: ToolFaq[] }

/**
 * Explanatory copy for the public free-tool pages.
 *
 * Extracted verbatim from the seodada templates rather than rewritten, so each
 * page keeps the wording it already earned rankings with. A tool page without
 * this is ~1 KB of text and has nothing to rank for.
 *
 * Data lives here rather than in the component file so `ToolProse.tsx` exports
 * only components — otherwise every consumer trips the react-refresh rule.
 */
const CONTENT = raw as Record<string, ToolContent>;

export function getToolContent(slug: string): ToolContent {
  return CONTENT[slug] ?? { sections: [], faqs: [] };
}

/** FAQPage structured data. Returns null when there are no FAQs, so a page
 *  never emits an empty schema block. */
export function faqJsonLd(faqs: ToolFaq[]): object | null {
  if (!faqs.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
