import { ArrowLeft, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { assetUrl, usePublicBlog } from "@/api/hooks/useContentPublic";
import { PublicHero } from "@/components/public/PublicHero";
import { cn } from "@/lib/cn";
import { Seo, SITE_URL } from "@/lib/seo";
import { Button } from "@/components/ui/button";

interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

/** Give every h2/h3 in the body a stable id and collect them for the TOC. */
function useToc(html: string): { html: string; toc: TocItem[] } {
  return useMemo(() => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const seen = new Set<string>();
    const toc: TocItem[] = [];
    doc.querySelectorAll("h2, h3").forEach((h) => {
      const text = (h.textContent || "").trim();
      if (!text) return;
      let id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section";
      while (seen.has(id)) id += "-x";
      seen.add(id);
      h.id = id;
      toc.push({ id, text, level: h.tagName === "H2" ? 2 : 3 });
    });
    return { html: doc.body.innerHTML, toc };
  }, [html]);
}

/** The heading currently at the top of the reading area — drives the TOC's
 *  live highlight as the reader scrolls. */
function useActiveHeading(toc: TocItem[]): string {
  const [active, setActive] = useState("");
  const key = toc.map((t) => t.id).join("|");

  useEffect(() => {
    const ids = key ? key.split("|") : [];
    if (!ids.length) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      // The last heading whose top has passed under the fixed header wins.
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 120) current = id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [key]);

  return active;
}

export default function BlogPost() {
  const { slug = "" } = useParams();
  const { data: post, isLoading, isError } = usePublicBlog(slug);
  const { html, toc } = useToc(post?.body_html ?? "");
  const active = useActiveHeading(toc);

  if (isLoading) {
    return <div className="mx-auto max-w-3xl px-4 py-24 text-center text-text-muted sm:px-6">Loading…</div>;
  }
  if (isError || !post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
        <Seo title="Post not found" noindex />
        <h1 className="text-2xl font-bold">Post not found</h1>
        <Link to="/blog" className="mt-6 inline-block">
          <Button variant="secondary">Back to blog</Button>
        </Link>
      </div>
    );
  }

  const jsonLd: object[] = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.meta_description || post.excerpt,
      author: { "@type": "Organization", name: post.author || "seodada" },
      datePublished: post.published_at,
      image: post.cover_image_url ? `${SITE_URL}${assetUrl(post.cover_image_url)}` : undefined,
      mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
    },
  ];
  if (post.faqs.length) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: post.faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    });
  }

  return (
    <div>
      <Seo
        title={post.meta_title || post.title}
        description={post.meta_description || post.excerpt}
        type="article"
        path={`/blog/${post.slug}`}
        jsonLd={jsonLd}
      />
      <PublicHero
        align="left"
        normalCase
        compact
        eyebrow={
          <Link to="/blog" className="inline-flex items-center gap-1.5 text-white/70 hover:text-white">
            <ArrowLeft size={14} /> Blog
          </Link>
        }
        title={post.title}
      >
        <p className="text-sm text-white/60">By {post.author}</p>
        {/* Spacer the banner image overlaps into — the cover sits mostly inside
            the hero, bleeding onto the light page below. */}
        {post.cover_image_url && <div className="h-40 sm:h-56" aria-hidden />}
      </PublicHero>

      <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-10">
          <article className="min-w-0 max-w-3xl">
            {/* Banner — straddles the hero edge. */}
            {post.cover_image_url && (
              <img
                src={assetUrl(post.cover_image_url)}
                alt={post.title}
                className="relative z-10 mx-auto -mt-40 mb-10 h-auto w-auto max-w-full rounded-2xl border border-white/10 shadow-xl sm:-mt-56"
                style={{ maxHeight: "min(24rem, 45vh)" }}
              />
            )}

            {/* Mobile / tablet TOC — the sidebar takes over on lg+. */}
            {toc.length > 1 && (
              <div className="mb-8 lg:hidden">
                <TocCard toc={toc} active={active} />
              </div>
            )}

            <div className="pillar-prose pt-2" dangerouslySetInnerHTML={{ __html: html }} />
            {post.faqs.length > 0 && (
              <div className="mt-12">
                <h2 className="text-2xl font-bold tracking-tight">Frequently asked questions</h2>
                {/* Native <details> — keyboard + screen-reader support for free,
                    and the answers stay in the DOM for crawlers. */}
                <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border">
                  {post.faqs.map((f, i) => (
                    <details key={i} className="group">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                        <span className="font-semibold text-text">{f.question}</span>
                        <ChevronDown
                          size={16}
                          aria-hidden
                          className="shrink-0 text-text-muted transition-transform duration-200 group-open:rotate-180"
                        />
                      </summary>
                      <p className="px-4 pb-4 text-sm leading-relaxed text-text-muted">{f.answer}</p>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </article>

          {/* Right rail — sticky table of contents. */}
          {toc.length > 1 && (
            <aside className="hidden lg:block">
              <div className="sticky top-24 pt-8">
                <TocCard toc={toc} active={active} />
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

/** Un-boxed TOC rail — a left guide-line with the active section lit up,
 *  matching the pillar guide's treatment. */
function TocCard({ toc, active }: { toc: TocItem[]; active: string }) {
  return (
    <nav aria-label="Table of contents">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
        On this page
      </p>
      <ol className="mt-3 max-h-[70vh] space-y-1 overflow-y-auto border-l border-border">
        {toc.map((item) => {
          const isActive = item.id === active;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "-ml-px block border-l py-1 text-sm transition-colors",
                  item.level === 3 ? "pl-7" : "pl-4",
                  isActive
                    ? "border-primary font-medium text-primary-ink"
                    : "border-transparent text-text-muted hover:border-primary/50 hover:text-text",
                )}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
