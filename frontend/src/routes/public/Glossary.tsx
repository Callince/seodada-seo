import { PublicHero } from "@/components/public/PublicHero";
import { Seo, SITE_URL } from "@/lib/seo";

/**
 * SEO / AEO / GEO glossary — definitional content, which answer engines cite
 * more readily than any other kind. Everything here is deliberately factual
 * and checkable; the product appears only where the term genuinely maps to a
 * feature. Plain visible text (no accordions): the value of this page IS its
 * crawlability, and it prerenders in document order.
 *
 * Each term carries an anchor id, so /glossary#geo is linkable from articles,
 * the app, and — the actual goal — other sites' citations.
 */
const GROUPS: { title: string; terms: { id: string; term: string; def: string }[] }[] = [
  {
    title: "The AI era: AEO & GEO",
    terms: [
      {
        id: "aeo",
        term: "AEO (Answer Engine Optimization)",
        def: "Optimizing content so answer engines — ChatGPT, Perplexity, Google's AI Overviews — cite it when they answer a question directly. Where classic SEO competes for a ranking position, AEO competes for the citation inside the answer itself.",
      },
      {
        id: "geo",
        term: "GEO (Generative Engine Optimization)",
        def: "The broader practice of making a brand visible in generatively-produced search results. GEO covers how language models learn about, describe, and recommend a brand — including content structure, entity clarity, and the sources models tend to trust.",
      },
      {
        id: "ai-overview",
        term: "AI Overview",
        def: "Google's generated summary shown above classic results. It synthesizes several sources and links a handful of citations; pages cited in it receive visibility even when they rank below the fold — and pages that are not cited lose clicks even at #1.",
      },
      {
        id: "citation-share",
        term: "Citation share",
        def: "Of the answers an AI engine gives for a set of queries, the fraction that cite a given domain. The AI-era counterpart of rank tracking: it measures presence in the answer rather than position on a page.",
      },
      {
        id: "llm-visibility",
        term: "LLM visibility",
        def: "How often and how favourably large language models mention a brand when asked relevant questions. Distinct from search rankings — a model may recommend brands it learned about in training data regardless of their current SERP position.",
      },
      {
        id: "share-of-voice",
        term: "Share of voice",
        def: "A brand's portion of the total visibility available in a market — across rankings, mentions, or AI citations — relative to competitors. A share-of-voice trend tells you whether you are winning ground or merely growing with the market.",
      },
    ],
  },
  {
    title: "Classic search",
    terms: [
      {
        id: "serp",
        term: "SERP (Search Engine Results Page)",
        def: "The page of results returned for a query, including organic listings, ads, and features such as the map pack, featured snippets, and AI Overviews. Modern rank tracking maps which features appear, not just who holds position one.",
      },
      {
        id: "keyword-difficulty",
        term: "Keyword difficulty",
        def: "An estimate of how hard it is to rank on the first page for a keyword, usually derived from the authority of the pages currently ranking. Useful for prioritisation: high-volume, low-difficulty terms are the classic opportunity quadrant.",
      },
      {
        id: "search-intent",
        term: "Search intent",
        def: "What the searcher is actually trying to do — learn (informational), find a site (navigational), compare (commercial), or buy (transactional). Content that mismatches intent rarely ranks regardless of quality.",
      },
      {
        id: "backlink",
        term: "Backlink",
        def: "A link from another site to yours. Search engines treat editorially-earned links as endorsements; the count of distinct referring domains matters more than raw link volume, and anchor text signals what the target page is about.",
      },
      {
        id: "domain-authority",
        term: "Domain authority",
        def: "A third-party estimate of a domain's overall ranking strength, modelled mainly on its backlink profile. Search engines do not use these scores directly; they are comparative tools for judging sites against each other.",
      },
      {
        id: "organic-traffic",
        term: "Organic traffic",
        def: "Visits arriving from unpaid search results. The core outcome metric of SEO, usually read alongside the keywords and pages that earn it.",
      },
    ],
  },
  {
    title: "Technical & on-page",
    terms: [
      {
        id: "technical-seo",
        term: "Technical SEO",
        def: "Making a site crawlable, indexable, and fast: status codes, redirects, canonical tags, sitemaps, structured data, and rendering. Technical problems cap the results of every other SEO effort, which is why audits start here.",
      },
      {
        id: "crawl-budget",
        term: "Crawl budget",
        def: "The number of URLs a search engine will fetch from a site in a given period. Wasting it on duplicates, redirect chains, or broken pages delays the discovery of content that matters — a real constraint mainly for large sites.",
      },
      {
        id: "canonical",
        term: "Canonical tag",
        def: "A link element that names the definitive URL among duplicates or near-duplicates, consolidating ranking signals onto one address. A sitemap that disagrees with the pages' canonicals is largely ignored.",
      },
      {
        id: "structured-data",
        term: "Structured data (schema)",
        def: "Machine-readable JSON-LD describing what a page contains — an article, product, FAQ, or price list. It powers rich results, and answer engines lean on it to extract facts with confidence.",
      },
      {
        id: "core-web-vitals",
        term: "Core Web Vitals",
        def: "Google's user-experience metrics: LCP (loading), INP (interactivity), and CLS (visual stability), measured on real users. A ranking factor at the margin and a conversion factor everywhere.",
      },
      {
        id: "on-page-seo",
        term: "On-page SEO",
        def: "Everything controllable within a single page: title and meta description, heading hierarchy, internal links, image alt text, and how well the copy covers the topic. The first thing to fix because it needs no one's permission.",
      },
      {
        id: "eeat",
        term: "E-E-A-T",
        def: "Experience, Expertise, Authoritativeness, Trustworthiness — the lens of Google's quality guidelines. Not a direct ranking signal but the standard content is evaluated against, and increasingly what answer engines proxy when choosing whom to cite.",
      },
    ],
  },
];

const JSONLD = {
  "@context": "https://schema.org",
  "@type": "DefinedTermSet",
  name: "SEO, AEO & GEO glossary",
  url: `${SITE_URL}/glossary`,
  hasDefinedTerm: GROUPS.flatMap((g) =>
    g.terms.map((t) => ({
      "@type": "DefinedTerm",
      "@id": `${SITE_URL}/glossary#${t.id}`,
      name: t.term,
      description: t.def,
    })),
  ),
};

export default function Glossary() {
  return (
    <div>
      <Seo
        title="SEO, AEO & GEO Glossary"
        description="Plain-language definitions of the terms that matter in modern search — from SERP and keyword difficulty to AEO, GEO, AI Overviews and citation share."
        path="/glossary"
        jsonLd={JSONLD}
      />
      <PublicHero
        eyebrow="Reference"
        title="The language of modern search"
        subtitle="Every term you'll meet across seodada and the wider industry — classic SEO, technical, and the AI era — defined in plain language."
        compact
      />

      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20">
        {GROUPS.map((g) => (
          <section key={g.title} className="mb-14 last:mb-0">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{g.title}</h2>
            <dl className="mt-6 space-y-8">
              {g.terms.map((t) => (
                <div key={t.id} id={t.id} className="scroll-mt-24 border-l-2 border-border pl-5">
                  <dt className="text-lg font-bold tracking-tight text-text">{t.term}</dt>
                  <dd className="mt-2 leading-relaxed text-text-muted">{t.def}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
