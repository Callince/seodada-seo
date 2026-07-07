/** Content catalog — the single source of copy migrated from the seodada
 *  (App B) Jinja templates. Every page's extracted content is loaded here so
 *  React pages render from data, never hardcoded strings. Regenerate the raw
 *  files with: `python backend/scripts/extract_content.py`. */
import type { PageContent } from "./types";

// Vite eagerly bundles every extracted page as JSON. One-liner glob so new
// templates appear automatically after re-running the extractor.
const modules = import.meta.glob<PageContent>("./raw/*.json", {
  eager: true,
  import: "default",
});

const bySlug: Record<string, PageContent> = {};
for (const path in modules) {
  const slug = path.replace("./raw/", "").replace(".json", "");
  if (slug === "_index") continue;
  bySlug[slug] = modules[path];
}

/** Get one page's migrated content, or undefined if the slug isn't in the catalog. */
export function getPage(slug: string): PageContent | undefined {
  return bySlug[slug];
}

/** All catalog slugs (excludes the generated _index manifest). */
export function pageSlugs(): string[] {
  return Object.keys(bySlug);
}

export type { PageContent } from "./types";
