import { ArrowRight, Check } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { getPage } from "@/content";
import type { FlowNode } from "@/content/types";
import { PublicHero } from "@/components/public/PublicHero";
import { Button } from "@/components/ui/button";
import { Seo } from "@/lib/seo";

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

const isBoilerplate = (t: string) => /\|\s*SEO\s*Dada\s*$/i.test(t);

/** A rendered block: a section heading, a paragraph, or a run of short text
 *  blocks grouped into a check-list. Built from the flat flow so the six
 *  content pages (about/help/contact/privacy/terms/cookies) all get real
 *  structure instead of a wall of <p>. */
type Block =
  | { kind: "h2"; id: string; text: string }
  | { kind: "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] };

function buildBlocks(flow: FlowNode[], skip: Set<string>): Block[] {
  const nodes = flow.filter((f) => !skip.has(f.text) && !isBoilerplate(f.text));
  const blocks: Block[] = [];
  let run: string[] = [];

  const flushRun = () => {
    if (!run.length) return;
    // A run of 2+ short text blocks reads as a list; longer prose stays paragraphs.
    if (run.length >= 2 && run.every((t) => t.length <= 130)) {
      blocks.push({ kind: "list", items: run });
    } else {
      run.forEach((t) => blocks.push({ kind: "p", text: t }));
    }
    run = [];
  };

  for (const n of nodes) {
    if (n.type === "heading") {
      flushRun();
      if (n.level === "h2") blocks.push({ kind: "h2", id: slugify(n.text), text: n.text });
      else if (n.level === "h1") continue; // hero owns the h1
      else blocks.push({ kind: "h3", text: n.text });
    } else {
      run.push(n.text);
    }
  }
  flushRun();
  return blocks;
}

/** Renders any migrated catalog page as a styled article. Copy comes straight
 *  from the seodada templates — no hand-retyping. */
export default function ContentPage({ slug, title }: { slug: string; title?: string }) {
  const page = getPage(slug);

  // Prefer the migrated SEO title (minus the "| SEO Dada" suffix) over the first
  // heading — some pages start with a "Table of Contents" heading.
  const cleanSeoTitle = page?.seo.title?.replace(/\s*\|\s*SEO\s*Dada\s*$/i, "").trim();
  const heading = title || cleanSeoTitle || page?.headings[0]?.text || slug;

  const blocks = useMemo(() => {
    if (!page) return [];
    const skip = new Set<string>();
    const firstH1 = page.flow.find((f) => f.type === "heading" && f.level === "h1");
    if (firstH1) skip.add(firstH1.text);
    return buildBlocks(page.flow, skip);
  }, [page]);

  const toc = useMemo(
    () => blocks.filter((b): b is Extract<Block, { kind: "h2" }> => b.kind === "h2"),
    [blocks],
  );

  // Lead paragraph: the migrated SEO description, else the first paragraph.
  const lead = page?.seo.description || blocks.find((b) => b.kind === "p")?.["text"];
  // CTA text nodes are the last few "action" lines; render real buttons from links.
  const ctas = (page?.links ?? []).filter((l) => l.href && l.text && !isBoilerplate(l.text)).slice(0, 2);

  if (!page) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-28 text-center sm:px-6">
        <Seo title="Page not found" noindex />
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-text-muted">No content is available for “{slug}”.</p>
        <Link to="/" className="mt-6 inline-block">
          <Button variant="secondary">Back home</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Seo title={heading} description={page.seo.description || lead} />
      {/* ===== Hero ===== */}
      <PublicHero
        align="left"
        eyebrow="seodada"
        title={heading}
        subtitle={lead}
        compact
        normalCase
      />

      {/* ===== Body + sticky TOC ===== */}
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:grid lg:grid-cols-[1fr_15rem] lg:gap-12">
        <article className="min-w-0 max-w-3xl">
          {blocks.map((b, i) => {
            if (b.kind === "h2")
              return (
                <h2
                  key={i}
                  id={b.id}
                  className="mt-12 flex items-center gap-3 border-b border-border pb-2 text-2xl font-bold tracking-tight scroll-mt-24 first:mt-0"
                >
                  <span className="h-6 w-1 rounded-full gradient-fill" />
                  {b.text}
                </h2>
              );
            if (b.kind === "h3")
              return (
                <h3 key={i} className="mt-8 text-lg font-semibold text-text">
                  {b.text}
                </h3>
              );
            if (b.kind === "list")
              return (
                <ul key={i} className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {b.items.map((it, j) => (
                    <li
                      key={j}
                      className="flex items-start gap-2.5 rounded-xl border border-border bg-surface p-3.5 text-sm text-text"
                    >
                      <Check size={16} className="mt-0.5 shrink-0 text-primary" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              );
            // Skip the lead — it's already shown in the hero.
            if (b.text === lead) return null;
            return (
              <p key={i} className="mt-4 leading-relaxed text-text-muted">
                {b.text}
              </p>
            );
          })}

          {ctas.length > 0 && (
            <div className="mt-12 flex flex-wrap gap-3 rounded-2xl border border-border bg-surface-2 p-6">
              {ctas.map((c, i) => (
                <Link key={c.href + i} to={c.href}>
                  <Button
                    variant={i === 0 ? "primary" : "secondary"}
                  >
                    {c.text}
                    {i === 0 && <ArrowRight size={15} />}
                  </Button>
                </Link>
              ))}
            </div>
          )}
        </article>

        {/* Sticky table of contents (desktop) */}
        {toc.length > 1 && (
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                On this page
              </p>
              <nav className="mt-3 space-y-1 border-l border-border">
                {toc.map((t) => (
                  <a
                    key={t.id}
                    href={`#${t.id}`}
                    className="-ml-px block border-l border-transparent py-1 pl-4 text-sm text-text-muted transition-colors hover:border-primary hover:text-primary-ink"
                  >
                    {t.text}
                  </a>
                ))}
              </nav>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
