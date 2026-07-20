/** Per-page SEO head tags for the public pages.
 *
 * These are RENDERED as real elements, not written into document.head from an
 * effect. React 19 hoists <title>/<meta>/<link>/<script> to the head either
 * way, but only rendered elements appear in renderToString output — and that
 * output is what the prerender step (scripts/prerender.mjs) writes into each
 * page's static HTML. An effect does not run during server rendering, so the
 * previous DOM-mutating version produced perfect tags for browsers and nothing
 * at all for the crawlers that never execute JS. Those crawlers include every
 * LLM fetcher (GPTBot, ClaudeBot, PerplexityBot), which is the audience an
 * AEO/GEO product can least afford to miss.
 *
 * The catch, and why it was written the old way: React 19 hoists but does NOT
 * dedupe against tags already in index.html. Two <title> elements leave
 * document.title correct (the rendered one wins — measured) but a crawler
 * reading the FIRST <title> or description gets the shell's generic copy. So
 * index.html deliberately no longer declares any per-page tag; it keeps only
 * a fallback <title> for the authenticated app, which renders no <Seo> at all,
 * and the prerender step replaces that fallback per route.
 */
export const SITE_URL = "https://seodada.com";
// Real seodada social-share image (1200×630), migrated from the seodada static.
const OG_IMAGE = "/og-seodada.png";

interface SeoProps {
  title: string;
  description?: string;
  /** Canonical path, e.g. "/pricing". Defaults to the current location. */
  path?: string;
  image?: string;
  type?: "website" | "article";
  noindex?: boolean;
  jsonLd?: object | object[];
}

export function Seo({ title, description, path, image = OG_IMAGE, type = "website", noindex, jsonLd }: SeoProps) {
  // During prerender there is no window; the caller passes `path` for every
  // route that matters, and falling back to "" keeps the canonical origin-only
  // rather than throwing.
  const pathname = path ?? (typeof window === "undefined" ? "" : window.location.pathname);
  const url = SITE_URL + pathname;
  const fullTitle = /seodada/i.test(title) ? title : `${title} — seodada`;
  const img = image.startsWith("http") ? image : SITE_URL + image;
  const jsonLdStr = jsonLd
    ? JSON.stringify(Array.isArray(jsonLd) && jsonLd.length === 1 ? jsonLd[0] : jsonLd)
    : "";

  return (
    <>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={url} />
      <meta name="robots" content={noindex ? "noindex,nofollow" : "index,follow"} />

      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={img} />

      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={img} />

      {jsonLdStr && (
        // dangerouslySetInnerHTML, not a text child: React escapes text, and an
        // escaped JSON-LD block is invalid to every parser that reads it. The
        // value is JSON.stringify output of our own objects, never user input.
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStr }} />
      )}
    </>
  );
}
