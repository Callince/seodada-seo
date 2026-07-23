import { ArrowRight, Clock } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";

// The real seodada article body, extracted from the template with structure
// intact (25 sections, callouts, FAQ). Rendered as HTML in .pillar-prose — the
// flattened content-catalog flow loses the section structure, so we use the
// source HTML for the flagship guide.
import body from "@/content/raw/pillar_technical_seo.body.html?raw";
import { getPage } from "@/content";
import { PublicHero } from "@/components/public/PublicHero";
import { Button } from "@/components/ui/button";
import { Seo, SITE_URL } from "@/lib/seo";

/** Headline stats from the article hero (value + label pairs). */
const STATS = [
  { value: "90%+", label: "Ranking failures from tech issues" },
  { value: "3.5s", label: "Ideal page load time" },
  { value: "60%+", label: "Traffic from mobile" },
  { value: "HTTPS", label: "Required for rankings" },
];

/** Parse `<h2 id="…">Text</h2>` from the body for a sticky table of contents. */
function tocFromHtml(html: string) {
  const out: { id: string; text: string }[] = [];
  const re = /<h2[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const text = m[2].replace(/<[^>]+>/g, "").trim();
    if (text) out.push({ id: m[1], text });
  }
  return out;
}

export default function PillarGuide() {
  const page = getPage("pillar_technical_seo");
  const title = page?.seo.title || "Technical SEO Guide 2026";
  const description =
    page?.seo.description ||
    "Master Technical SEO to ensure search engines can crawl, index, and rank your website in 2026.";

  const toc = useMemo(() => tocFromHtml(body), []);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: title,
    description,
    author: { "@type": "Organization", name: "seodada" },
    publisher: {
      "@type": "Organization",
      name: "seodada",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png` },
    },
    mainEntityOfPage: `${SITE_URL}/guides/technical-seo`,
  };

  return (
    <div>
      <Seo title={title} description={description} type="article" path="/guides/technical-seo" jsonLd={jsonLd} />
      {/* ===== Hero ===== */}
      <PublicHero
        align="left"
        normalCase
        eyebrow={
          <Link to="/blog" className="text-white/70 hover:text-white">
            ← Back to blog · Technical SEO · Pillar guide
          </Link>
        }
        title={title}
        subtitle={description}
      >
        <div className="inline-flex items-center gap-2 text-sm text-white/60">
          <Clock size={15} /> 18 min read
        </div>
        {/* Stat cards */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"
            >
              <div className="text-2xl font-extrabold text-white">{s.value}</div>
              <div className="mt-1 text-xs text-white/60">{s.label}</div>
            </div>
          ))}
        </div>
      </PublicHero>

      {/* ===== Body + sticky TOC ===== */}
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:grid lg:grid-cols-[1fr_16rem] lg:gap-12">
        <article
          className="pillar-prose min-w-0 max-w-3xl"
          dangerouslySetInnerHTML={{ __html: body }}
        />

        {toc.length > 1 && (
          <aside className="hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
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

      {/* ===== CTA ===== */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Ready to fix your technical SEO?
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-text-muted">
            Run a full technical audit, track rankings, and get AI-guided fixes — all in seodada.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/register">
              <Button size="lg">
                Start free <ArrowRight size={16} />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="secondary">
                See pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
