import { useEffect } from "react";

/** Per-page SEO head tags for the public pages. React 19 hoists rendered
 *  <meta>/<link> but does NOT dedupe them against the static tags in
 *  index.html, so we upsert (update-in-place) instead — guaranteeing exactly
 *  one <title>, description, canonical, and OG/Twitter set per page. Static
 *  index.html tags remain as the no-JS fallback and get overwritten here for
 *  JS-rendering crawlers (Googlebot). */

// ponytail: single canonical origin — change here if the public domain moves.
export const SITE_URL = "https://seodada.com";
// Real seodada social-share image (1200×630), migrated from the seodada static.
const OG_IMAGE = "/og-seodada.png";
const JSONLD_ID = "seo-jsonld";

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

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function Seo({ title, description, path, image = OG_IMAGE, type = "website", noindex, jsonLd }: SeoProps) {
  const jsonLdStr = jsonLd
    ? JSON.stringify(Array.isArray(jsonLd) && jsonLd.length === 1 ? jsonLd[0] : jsonLd)
    : "";

  useEffect(() => {
    const pathname = path ?? window.location.pathname;
    const url = SITE_URL + pathname;
    const fullTitle = /seodada/i.test(title) ? title : `${title} — seodada`;
    const img = image.startsWith("http") ? image : SITE_URL + image;

    document.title = fullTitle;
    if (description) {
      upsertMeta("name", "description", description);
      upsertMeta("property", "og:description", description);
      upsertMeta("name", "twitter:description", description);
    }
    upsertLink("canonical", url);
    upsertMeta("name", "robots", noindex ? "noindex,nofollow" : "index,follow");
    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:type", type);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:image", img);
    upsertMeta("name", "twitter:title", fullTitle);
    upsertMeta("name", "twitter:image", img);

    // JSON-LD: one managed <script>, replaced per page.
    let s = document.getElementById(JSONLD_ID) as HTMLScriptElement | null;
    if (jsonLdStr) {
      if (!s) {
        s = document.createElement("script");
        s.id = JSONLD_ID;
        s.type = "application/ld+json";
        document.head.appendChild(s);
      }
      s.textContent = jsonLdStr;
    } else if (s) {
      s.remove();
    }
  }, [title, description, path, image, type, noindex, jsonLdStr]);

  return null;
}
