import { ArrowRight, BookOpen, Clock, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { assetUrl, usePublicBlogs } from "@/api/hooks/useContentPublic";
import { getPage } from "@/content";
import { PublicHero } from "@/components/public/PublicHero";
import { Seo } from "@/lib/seo";

/** Public blog index — a static content hub featuring the Technical SEO pillar
 *  guide. (The AI content factory was removed; real posts arrive with the
 *  content migration.) */
const CATEGORIES = [
  "Technical SEO",
  "Keyword Research",
  "Content Strategy",
  "Link Building",
  "Analytics",
  "AI & Automation",
];

export default function Blog() {
  const pillar = getPage("pillar_technical_seo");
  const { data: posts } = usePublicBlogs();

  return (
    <div>
      <Seo
        title="Blog"
        description="Explore our latest blog posts about SEO, digital marketing, and technology insights."
        path="/blog"
      />
      {/* ===== Hero ===== */}
      <PublicHero
        align="left"
        eyebrow="Blog"
        title="Insights on"
        highlight="SEO, content & growth"
        subtitle="Practical guides, data-driven playbooks, and product updates from the seodada team — built to help your team rank, analyse, and publish better."
      >
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <span
              key={c}
              className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-sm font-medium text-white/75"
            >
              {c}
            </span>
          ))}
        </div>
      </PublicHero>

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        {/* ===== Featured post — the real pillar guide ===== */}
        {pillar && (
          <Link
            to="/guides/technical-seo"
            className="group grid overflow-hidden rounded-3xl border border-border bg-surface shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg lg:grid-cols-2"
          >
            <div className="relative min-h-[220px] overflow-hidden bg-surface-2">
              <img
                src="/content-assets/pillar/technical-seo-elements.webp"
                alt="Technical SEO elements — HTTPS, sitemap, robots.txt, page speed, structured data"
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              />
              <span className="absolute left-6 top-6 inline-flex items-center gap-1.5 rounded-full gradient-fill px-3 py-1 text-xs font-semibold text-white shadow-glow">
                <Sparkles size={13} /> Featured guide
              </span>
            </div>
            <div className="flex flex-col justify-center gap-3 p-8">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Technical SEO
              </span>
              <h2 className="text-2xl font-bold tracking-tight group-hover:text-primary">
                {pillar.seo.title || "Technical SEO Guide 2026"}
              </h2>
              <p className="text-text-muted">{pillar.seo.description}</p>
              <div className="mt-2 flex items-center gap-4 text-sm text-text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={15} /> 18 min read
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-primary">
                  Read guide <ArrowRight size={15} />
                </span>
              </div>
            </div>
          </Link>
        )}

        {/* ===== Latest posts (migrated) ===== */}
        {posts && posts.length > 0 && (
          <div className="mt-14">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
              Latest articles
            </h2>
            <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => (
                <Link
                  key={p.slug}
                  to={`/blog/${p.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
                >
                  {/* Cover at its native 1500x900 ratio — never cropped. */}
                  <div className="aspect-[5/3] overflow-hidden bg-surface-2">
                    {p.cover_image_url ? (
                      <img
                        src={assetUrl(p.cover_image_url)}
                        alt={p.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="aurora-bg grid h-full place-items-center">
                        <BookOpen size={40} className="text-primary/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="line-clamp-2 text-base font-semibold leading-snug group-hover:text-primary">
                      {p.title}
                    </h3>
                    <p className="mt-2 line-clamp-3 flex-1 text-sm text-text-muted">{p.excerpt}</p>
                    <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-text-muted">
                      <span className="inline-flex items-center gap-2">
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary-soft text-[10px] font-bold uppercase text-primary">
                          {(p.author || "s").slice(0, 1)}
                        </span>
                        {p.author || "seodada"}
                        {p.published_at && (
                          <>
                            <span aria-hidden>·</span>
                            {new Date(p.published_at).toLocaleDateString("en-US", {
                              month: "short", day: "numeric", year: "numeric",
                            })}
                          </>
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1 font-medium text-primary">
                        Read <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
