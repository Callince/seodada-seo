import { ArrowRight, Check, ImageIcon, Heading as HeadingIcon, Link2, Lock, Network, Search, Tags, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { apiErrorMessage } from "@/api/client";
import { usePublicAnalyze, type PublicDetail } from "@/api/hooks/usePublicAnalyze";
import { DisplayHeading } from "@/components/public/display";
import { PublicHero } from "@/components/public/PublicHero";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";
import { ToolFaqs, ToolProse } from "@/components/public/ToolProse";
import { faqJsonLd } from "@/content/toolContent";
import { Seo } from "@/lib/seo";

/**
 * Public, no-login SEO tools.
 *
 * Every tool here runs off ONE fetch of the page: `/public/analyze` returns the
 * full breakdown, and each tab is a different view of it. That is why the whole
 * set is free — it is a single in-process crawl ($0, no billed API), not six
 * separate lookups.
 *
 * These were previously behind `RequireAuth`, so a visitor clicking "free tool"
 * was redirected to /login — advertised as free, gated in practice.
 */

/** Sitemap Explorer is deliberately absent: it crawls an entire site rather
 *  than one page, so it cannot run off this single fetch and stays an
 *  account feature. Saying so beats a tab that silently does nothing. */
const TABS = [
  { key: "overview", label: "URL", icon: Link2 },
  { key: "meta", label: "Meta", icon: Tags },
  { key: "headings", label: "Headings", icon: HeadingIcon },
  { key: "keywords", label: "Keywords", icon: Search },
  { key: "images", label: "Images", icon: ImageIcon },
  { key: "links", label: "Links", icon: Network },
];

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-[11px] uppercase tracking-wide text-text-muted">{label}</p>
      <p className={cn(
        "mt-0.5 font-mono text-lg",
        tone === "good" ? "text-success" : tone === "bad" ? "text-danger" : "text-text",
      )}>
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-border py-2 text-sm last:border-0">
      <span className="w-40 shrink-0 text-text-muted">{label}</span>
      <span className="min-w-0 flex-1 break-words text-text">{value || <span className="text-text-muted">—</span>}</span>
    </div>
  );
}

function Results({ d }: { d: PublicDetail }) {
  const [tab, setTab] = useState("overview");
  const H = d.headings.counts ?? {};

  return (
    <Tabs value={tab} onChange={setTab}>
      <TabsList>
        {TABS.map((t) => (
          <TabsTrigger key={t.key} value={t.key}>
            <t.icon size={14} /> {t.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <div className="mt-5">
        <TabsContent value="overview">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Status" value={d.url.status_code ?? "—"} tone={d.url.status_code === 200 ? "good" : "bad"} />
            <Stat label="HTTPS" value={d.url.https ? "Yes" : "No"} tone={d.url.https ? "good" : "bad"} />
            <Stat label="Redirected" value={d.url.redirected ? "Yes" : "No"} />
            <Stat label="Path depth" value={d.url.path_depth ?? "—"} />
          </div>
          <div className="mt-4">
            <Row label="Final URL" value={d.url.final_url} />
            <Row label="Canonical" value={d.url.canonical} />
            <Row label="Robots meta" value={d.url.robots_meta} />
            <Row label="Slug" value={d.url.slug} />
          </div>
          {d.url.checks.length > 0 && (
            <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
              {d.url.checks.map((c) => (
                <li key={c.label} className="flex items-start gap-1.5 text-sm">
                  {c.ok ? <Check size={14} className="mt-0.5 shrink-0 text-success" />
                        : <X size={14} className="mt-0.5 shrink-0 text-danger" />}
                  <span className={c.ok ? "text-text-muted" : "text-text"}>{c.label}</span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="meta">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Title length" value={d.meta.title_length ?? "—"}
                  tone={(d.meta.title_length ?? 0) >= 30 && (d.meta.title_length ?? 0) <= 60 ? "good" : "bad"} />
            <Stat label="Description length" value={d.meta.description_length ?? "—"}
                  tone={(d.meta.description_length ?? 0) >= 70 && (d.meta.description_length ?? 0) <= 160 ? "good" : "bad"} />
            <Stat label="Schema types" value={d.meta.schema_types.length} />
          </div>
          <div className="mt-4">
            <Row label="Title" value={d.meta.title} />
            <Row label="Description" value={d.meta.description} />
            <Row label="Canonical" value={d.meta.canonical} />
            <Row label="Robots" value={d.meta.robots} />
            <Row label="Viewport" value={d.meta.viewport} />
            <Row label="Language" value={d.meta.language} />
            <Row label="Open Graph" value={Object.keys(d.meta.open_graph).length ? `${Object.keys(d.meta.open_graph).length} tags` : null} />
            <Row label="Twitter card" value={Object.keys(d.meta.twitter).length ? `${Object.keys(d.meta.twitter).length} tags` : null} />
            <Row label="Schema" value={d.meta.schema_types.join(", ")} />
          </div>
        </TabsContent>

        <TabsContent value="headings">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {["h1", "h2", "h3", "h4", "h5", "h6"].map((h) => (
              <Stat key={h} label={h.toUpperCase()} value={H[h] ?? 0}
                    tone={h === "h1" ? ((H.h1 ?? 0) === 1 ? "good" : "bad") : undefined} />
            ))}
          </div>
          {d.headings.issues.length > 0 && (
            <ul className="mt-4 space-y-1">
              {d.headings.issues.map((i) => (
                <li key={i} className="flex items-start gap-1.5 text-sm text-text">
                  <X size={14} className="mt-0.5 shrink-0 text-warning" /> {i}
                </li>
              ))}
            </ul>
          )}
          <ol className="mt-4 space-y-1">
            {d.headings.items.map((h, i) => (
              <li key={`${h.level}-${i}`} className="flex gap-2 text-sm" style={{ paddingLeft: (h.level - 1) * 16 }}>
                <span className="shrink-0 font-mono text-xs text-text-muted">H{h.level}</span>
                <span className="min-w-0 break-words text-text">{h.text}</span>
              </li>
            ))}
          </ol>
          {d.headings.truncated && <p className="mt-3 text-xs text-text-muted">Showing the first 50 headings.</p>}
        </TabsContent>

        <TabsContent value="keywords">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Word count" value={d.keywords.word_count ?? "—"} />
            <Stat label="Unique words" value={d.keywords.unique_words ?? "—"} />
            <Stat label="Reading time" value={`${d.keywords.reading_time_min ?? 0} min`} />
          </div>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            {[
              { title: "Top keywords", rows: d.keywords.top_keywords },
              { title: "Top phrases", rows: d.keywords.top_phrases },
            ].map((col) => col.rows.length > 0 && (
              <div key={col.title}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{col.title}</p>
                <ul className="space-y-1.5">
                  {col.rows.map((k) => (
                    <li key={k.phrase} className="flex items-center gap-2 text-sm">
                      <span className="w-40 shrink-0 truncate text-text" title={k.phrase}>{k.phrase}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <span className="block h-full rounded-full bg-[color:var(--section,var(--primary))]"
                              style={{ width: `${Math.min(100, k.density * 12)}%` }} />
                      </span>
                      <span className="w-14 shrink-0 text-right font-mono text-xs text-text-muted">{k.density}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="images">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Images" value={d.images.total ?? 0} />
            <Stat label="Missing alt" value={d.images.missing_alt ?? 0} tone={(d.images.missing_alt ?? 0) === 0 ? "good" : "bad"} />
            <Stat label="With alt" value={d.images.with_alt ?? 0} />
            <Stat label="Lazy-loaded" value={d.images.lazy_count ?? 0} />
          </div>
          <ul className="mt-4 space-y-2">
            {d.images.items.map((img, i) => (
              <li key={`${img.src}-${i}`} className="flex items-start gap-2 border-b border-border pb-2 text-sm last:border-0">
                {img.alt ? <Check size={14} className="mt-0.5 shrink-0 text-success" />
                         : <X size={14} className="mt-0.5 shrink-0 text-danger" />}
                <div className="min-w-0">
                  <p className="truncate text-text" title={img.src}>{img.src}</p>
                  <p className="text-xs text-text-muted">{img.alt ? `alt: ${img.alt}` : "no alt text"}</p>
                </div>
              </li>
            ))}
            {d.images.items.length === 0 && <li className="text-sm text-text-muted">No images found on this page.</li>}
          </ul>
          {d.images.truncated && <p className="mt-3 text-xs text-text-muted">Showing the first 50 images.</p>}
        </TabsContent>

        <TabsContent value="links">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Total links" value={d.links.total ?? 0} />
            <Stat label="Internal" value={d.links.internal_count ?? 0} />
            <Stat label="External" value={d.links.external_count ?? 0} />
            <Stat label="Nofollow" value={d.links.nofollow_count ?? 0} />
          </div>
          <ul className="mt-4 space-y-1">
            {d.links.samples.map((l, i) => (
              <li key={`${l.url}-${i}`} className="flex gap-2 border-b border-border py-1.5 text-sm last:border-0">
                <span className={cn("shrink-0 text-[11px] uppercase", l.internal ? "text-text-muted" : "text-[color:var(--primary-ink)]")}>
                  {l.internal ? "int" : "ext"}
                </span>
                <span className="min-w-0 flex-1 truncate text-text" title={l.url}>{l.text || l.url}</span>
              </li>
            ))}
          </ul>
        </TabsContent>
      </div>
    </Tabs>
  );
}


/**
 * Copy for this page.
 *
 * Unlike /content-checker and /blog-title-generator — whose prose is lifted
 * verbatim from the seodada templates — the backup has no tools-overview page
 * to port, so this is written fresh. Kept here rather than in
 * toolContent.raw.json so the extracted-vs-authored distinction stays obvious.
 */
const SECTIONS = [
  {
    level: 2,
    title: "What this free SEO tool checks",
    paras: [
      "Paste any URL and the analyser fetches that single page and reads it the way a crawler does: the response status and redirect chain, the canonical and robots directives, the title and meta description, the heading outline, every image and its alt text, and the internal and external links on the page.",
      "Everything comes from one fetch of one page. That is the whole reason it is free and instant — there is no queue, no crawl budget and no account, because the work is a single request rather than a site-wide crawl.",
    ],
  },
  {
    level: 2,
    title: "Why on-page checks still decide rankings",
    paras: [
      "Search engines still have to understand a page before they can rank it. A missing title, a duplicated H1, a canonical pointing at the wrong URL or a page returning 302 instead of 200 will hold back content that is otherwise excellent.",
      "These are also the cheapest problems to fix. Most take a single edit, and unlike link building or content production the result is entirely under your control.",
    ],
  },
  {
    level: 3,
    title: "What it will not tell you",
    paras: [
      "One page is one data point. It cannot tell you whether the rest of the site links to that page, whether other pages compete with it for the same keyword, or how the page ranks today. Those questions need a crawl and live ranking data, which is what the full platform adds.",
    ],
  },
];

const FAQS = [
  {
    q: "Is this SEO tool really free?",
    a: "Yes. There is no account, no card and no trial. The analysis runs on our own crawler and costs us nothing meaningful per page, so there is nothing to charge for.",
  },
  {
    q: "Do you store the pages I analyse?",
    a: "The result is cached for about 30 minutes so that re-checking the same URL is instant, and then it expires. We do not build a profile from what you check.",
  },
  {
    q: "How many URLs can I check?",
    a: "A few per minute from the same connection. The limit exists because every check fetches somebody else's page, and we would rather not look like a crawler to the sites being analysed.",
  },
  {
    q: "Why does the Sitemap Explorer need an account?",
    a: "It crawls an entire site rather than one page, so it cannot run off the single fetch that powers everything else here. That work is queued and metered, which is what the account is for.",
  },
  {
    q: "Can I check a competitor's page?",
    a: "Yes — the tool fetches public pages, so any URL you can open in a browser works. Comparing your page against a competitor's is one of the more useful ways to use it.",
  },
];

export default function FreeTools() {
  const [url, setUrl] = useState("");
  const analyze = usePublicAnalyze();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = url.trim();
    if (!q || analyze.isPending) return;
    analyze.mutate(q.startsWith("http") ? q : `https://${q}`);
  };

  return (
    <div>
      <Seo
        title="Free SEO Tools"
        description="Free instant SEO tools — analyse any URL's meta tags, headings, keywords, images and links in seconds. No account, no card, no limits to sign up for."
        path="/free-tools"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Free SEO Tools",
            applicationCategory: "SEOApplication",
            operatingSystem: "Any",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          },
          ...(faqJsonLd(FAQS) ? [faqJsonLd(FAQS) as object] : []),
        ]}
      />

      <PublicHero
        eyebrow="Free tools"
        title="One URL. Six checks."
        highlight="No account."
        subtitle="Paste any page and get the full on-page breakdown — meta tags, heading structure, keyword density, image alt text and link profile. One fetch, six views, nothing to sign up for."
      >
        <form onSubmit={submit} className="mx-auto flex max-w-xl flex-col gap-2 sm:flex-row">
          <label htmlFor="ft-url" className="sr-only">Page URL to analyse</label>
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              id="ft-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="yoursite.com/page"
              inputMode="url"
              className="w-full rounded-full border border-border bg-surface py-2.5 pl-9 pr-4 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]"
            />
          </div>
          <Button type="submit" loading={analyze.isPending} disabled={!url.trim()} className="rounded-full">
            {!analyze.isPending && <>Analyse <ArrowRight size={15} /></>}
          </Button>
        </form>
      </PublicHero>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        {analyze.isPending && (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {analyze.isError && (
          <p className="text-sm text-danger">
            {(analyze.error as { response?: { status?: number } })?.response?.status === 429
              ? "That's a few checks in a row — give it a minute, or create a free account for unlimited runs."
              : apiErrorMessage(analyze.error)}
          </p>
        )}

        {!analyze.isPending && !analyze.data && !analyze.isError && (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center">
            <p className="text-sm text-text-muted">
              Enter a URL above. Everything runs on our own crawler — no account, and nothing is billed.
            </p>
          </div>
        )}

        {analyze.data && !analyze.isPending && (
          <div className="animate-fade-rise">
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="min-w-0 truncate text-lg font-semibold text-text" title={analyze.data.url}>
                {analyze.data.url}
              </h2>
              <span className="text-sm text-text-muted">
                {analyze.data.passed} of {analyze.data.total} headline checks passed
              </span>
            </div>
            <Results d={analyze.data.detail} />
          </div>
        )}

        {/* Sibling tools — same no-account promise, different job.
            The h2 is not decorative: without it these cards were h3s directly
            under the page h1, a heading-level jump that screen readers and
            search engines both read as a broken outline. */}
        <DisplayHeading className="mt-12">More free tools</DisplayHeading>
        <p className="mt-2 text-text-muted">
          Two more that need no account — one for a draft you are still writing, one for the
          headline on top of it.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            { to: "/content-checker", title: "Content Checker",
              desc: "Score a draft as you write — keyword density, readability, passive voice and heading structure." },
            { to: "/blog-title-generator", title: "Blog Title Generator",
              desc: "Title ideas built around the phrase your outline actually repeats." },
          ].map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="group rounded-2xl border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow"
            >
              <h3 className="flex items-center gap-1 font-semibold text-text">
                {t.title}
                <ArrowRight size={14} className="opacity-0 transition-opacity group-hover:opacity-100" />
              </h3>
              <p className="mt-1 text-sm text-text-muted">{t.desc}</p>
            </Link>
          ))}
        </div>

      </div>

      <ToolProse sections={SECTIONS} />
      <ToolFaqs faqs={FAQS} subtitle="Common questions about the free page analyser." />

      <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        {/* Honest about the one tool that cannot run here. */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-[var(--lp-tint)] p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-text-muted">
              <Lock size={18} />
            </span>
            <div>
              <h2 className="font-semibold text-text">Need the whole site, not one page?</h2>
              <p className="mt-1 max-w-xl text-sm text-text-muted">
                Sitemap Explorer, full-site crawls, rank tracking and keyword research work across
                every page at once — those need an account.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/register"><Button>Start free <ArrowRight size={15} /></Button></Link>
            <Link to="/features"><Button variant="secondary">See all features</Button></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
