import { useEffect } from "react";

import { getPage } from "@/content";

/** Renders any migrated catalog page (about, help, privacy, terms, cookies…)
 *  as a styled article from its ordered content flow. Copy comes straight from
 *  the seodada templates — no hand-retyping. */
export default function ContentPage({ slug, title }: { slug: string; title?: string }) {
  const page = getPage(slug);

  // Reflect the migrated SEO title in the tab.
  useEffect(() => {
    const t = title || page?.seo.title || slug;
    document.title = `${t} — seodada`;
  }, [slug, title, page]);

  if (!page) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-text-muted">No content is available for “{slug}”.</p>
      </div>
    );
  }

  const heading = title || page.headings[0]?.text || page.seo.title || slug;
  // Skip the leading "<Title> | SEO Dada" boilerplate and the first h1 (shown as hero).
  const skip = new Set<string>();
  const firstH1 = page.flow.find((f) => f.type === "heading" && f.level === "h1");
  if (firstH1) skip.add(firstH1.text);
  const body = page.flow.filter(
    (f) => !skip.has(f.text) && !/\|\s*SEO\s*Dada\s*$/i.test(f.text),
  );

  return (
    <article className="aurora-bg">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{heading}</h1>
        {page.seo.description && (
          <p className="mt-4 text-lg text-text-muted">{page.seo.description}</p>
        )}
        <div className="mt-10 space-y-4">
          {body.map((node, i) =>
            node.type === "heading" ? (
              node.level === "h2" ? (
                <h2 key={i} className="!mt-10 border-b border-border pb-2 text-2xl font-bold tracking-tight">
                  {node.text}
                </h2>
              ) : (
                <h3 key={i} className="!mt-6 text-lg font-semibold">
                  {node.text}
                </h3>
              )
            ) : (
              <p key={i} className="leading-relaxed text-text-muted">
                {node.text}
              </p>
            ),
          )}
        </div>
      </div>
    </article>
  );
}
