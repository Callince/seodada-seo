import { ArrowRight, Check as CheckIcon, CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { PublicHero } from "@/components/public/PublicHero";
import { ToolFaqs, ToolProse } from "@/components/public/ToolProse";
import { faqJsonLd, getToolContent } from "@/content/toolContent";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { analyze, type Check, type CheckStatus } from "@/lib/contentCheck";
import { cn } from "@/lib/cn";
import { Seo } from "@/lib/seo";

/**
 * Real-time content analysis — public, no account.
 *
 * Ported from the seodada Flask tool, whose analysis was already client-side
 * (`static/js/script.js`); the route only ever rendered a template. Keeping it
 * in the browser means it stays free, instant and private — the draft never
 * leaves the page, which matters when people paste unpublished work.
 */

const TONE: Record<CheckStatus, { icon: typeof CircleCheck; cls: string }> = {
  good: { icon: CircleCheck, cls: "text-success" },
  ok: { icon: CircleAlert, cls: "text-warning" },
  poor: { icon: CircleX, cls: "text-danger" },
};

function CheckRow({ c }: { c: Check }) {
  const { icon: Icon, cls } = TONE[c.status];
  return (
    <li className="flex items-start gap-2.5 border-b border-border py-2 last:border-0">
      <Icon size={16} className={cn("mt-0.5 shrink-0", cls)} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-text">{c.label}</p>
        <p className="text-xs text-text-muted">{c.detail}</p>
      </div>
    </li>
  );
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const tone = score >= 70 ? "text-success" : score >= 40 ? "text-warning" : "text-danger";
  const C = 2 * Math.PI * 42;
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 100 100" className="h-20 w-20 shrink-0 -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className="stroke-surface-2" />
        <circle
          cx="50" cy="50" r="42" fill="none" strokeWidth="8" strokeLinecap="round"
          className={cn("transition-[stroke-dashoffset] duration-500", tone)}
          stroke="currentColor"
          strokeDasharray={C}
          strokeDashoffset={C - (score / 100) * C}
        />
      </svg>
      <div>
        <p className={cn("font-mono text-3xl leading-none", tone)}>{score}</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-text-muted">{label}</p>
      </div>
    </div>
  );
}

const SAMPLE = `<h2>Why keyword research still matters</h2>
<p>Keyword research is the foundation of every content strategy. However, most teams stop at search volume and never look at intent.</p>
<p>Therefore, the pages they publish rank for terms nobody actually converts on. For example, a "best running shoes" page written for a brand term will struggle.</p>`;

const CONTENT = getToolContent("content-checker");

export default function ContentChecker() {
  const [html, setHtml] = useState("");
  const [keyword, setKeyword] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [tab, setTab] = useState("seo");

  // Recomputed on every keystroke — that is the "real-time" in the tool's name,
  // and it is affordable because nothing leaves the browser.
  const a = useMemo(
    () => analyze({ html, keyword, seoTitle, metaDescription, slug }),
    [html, keyword, seoTitle, metaDescription, slug],
  );

  const hasContent = a.words > 0;

  return (
    <div>
      <Seo
        title="Free SEO Content Checker"
        description="Analyse your draft as you write — keyword density, readability, passive voice, transition words, heading structure and a Google snippet preview. Free, no account, nothing leaves your browser."
        path="/content-checker"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "SEO Content Checker",
            applicationCategory: "SEOApplication",
            operatingSystem: "Any",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          },
          ...(faqJsonLd(CONTENT.faqs) ? [faqJsonLd(CONTENT.faqs) as object] : []),
        ]}
      />

      <PublicHero
        eyebrow="Free tool"
        title="Fix the draft before you publish it."
        highlight="As you type."
        subtitle="Paste a draft and see the SEO and readability problems immediately — keyword density, sentence length, passive voice, transitions and heading structure. Your text never leaves this page."
      />

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          {/* ── Input ─────────────────────────────────────────────── */}
          <div className="min-w-0 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="cc-kw" className="mb-1 block text-sm font-medium text-text">Focus keyword</label>
                <input
                  id="cc-kw" value={keyword} onChange={(e) => setKeyword(e.target.value)}
                  placeholder="e.g. keyword research"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]"
                />
              </div>
              <div>
                <label htmlFor="cc-slug" className="mb-1 block text-sm font-medium text-text">URL slug</label>
                <input
                  id="cc-slug" value={slug} onChange={(e) => setSlug(e.target.value)}
                  placeholder="keyword-research-guide"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="cc-title" className="mb-1 flex items-baseline justify-between text-sm font-medium text-text">
                SEO title
                <span className={cn("text-xs", seoTitle.length > 60 ? "text-danger" : "text-text-muted")}>
                  {seoTitle.length}/60
                </span>
              </label>
              <input
                id="cc-title" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="Keyword Research: The Complete Guide"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]"
              />
            </div>

            <div>
              <label htmlFor="cc-desc" className="mb-1 flex items-baseline justify-between text-sm font-medium text-text">
                Meta description
                <span className={cn("text-xs", metaDescription.length > 160 ? "text-danger" : "text-text-muted")}>
                  {metaDescription.length}/160
                </span>
              </label>
              <textarea
                id="cc-desc" value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={2}
                placeholder="What this page answers, in one sentence."
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]"
              />
            </div>

            <div>
              <label htmlFor="cc-body" className="mb-1 flex items-baseline justify-between text-sm font-medium text-text">
                Content
                <button
                  type="button"
                  onClick={() => { setHtml(SAMPLE); setKeyword("keyword research"); }}
                  className="text-xs font-normal text-primary-ink hover:underline"
                >
                  load a sample
                </button>
              </label>
              <textarea
                id="cc-body" value={html} onChange={(e) => setHtml(e.target.value)} rows={16}
                placeholder={"Paste your draft. Plain text works; HTML (<h2>, <p>) also works and unlocks the heading checks."}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs leading-relaxed text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]"
              />
            </div>

            {/* Google preview */}
            {(seoTitle || metaDescription || slug) && (
              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Google preview</p>
                <p className="truncate text-xs text-text-muted">seodada.com › {slug || "your-slug"}</p>
                <p className="mt-0.5 truncate text-base text-[color:var(--primary-ink)]">
                  {seoTitle || "Your SEO title appears here"}
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm text-text-muted">
                  {metaDescription || "Your meta description appears here — this is what searchers read before deciding to click."}
                </p>
              </div>
            )}
          </div>

          {/* ── Analysis ──────────────────────────────────────────── */}
          <div className="min-w-0">
            {!hasContent ? (
              <div className="rounded-2xl border border-border bg-surface p-8 text-center">
                <p className="text-sm text-text-muted">
                  Start typing and the analysis appears here — instantly, and without your draft
                  leaving the browser.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4 rounded-2xl border border-border bg-surface p-4">
                  <ScoreRing score={a.seoScore} label="SEO" />
                  <ScoreRing score={a.readabilityScore} label="Readability" />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Words", value: a.words },
                    { label: "Sentences", value: a.sentences },
                    { label: "Reading", value: `${a.readingTimeMin}m` },
                    { label: "Density", value: keyword ? `${a.density}%` : "—" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border border-border bg-surface p-3">
                      <p className="text-[11px] uppercase tracking-wide text-text-muted">{s.label}</p>
                      <p className="mt-0.5 font-mono text-lg text-text">{s.value}</p>
                    </div>
                  ))}
                </div>

                <Tabs value={tab} onChange={setTab}>
                  <TabsList>
                    <TabsTrigger value="seo">SEO ({a.seo.length})</TabsTrigger>
                    <TabsTrigger value="read">Readability ({a.readability.length})</TabsTrigger>
                    <TabsTrigger value="structure">Structure</TabsTrigger>
                  </TabsList>
                  <div className="mt-3 rounded-xl border border-border bg-surface px-4">
                    <TabsContent value="seo"><ul>{a.seo.map((c) => <CheckRow key={c.id} c={c} />)}</ul></TabsContent>
                    <TabsContent value="read"><ul>{a.readability.map((c) => <CheckRow key={c.id} c={c} />)}</ul></TabsContent>
                    <TabsContent value="structure">
                      <div className="py-3">
                        {a.headings.length === 0 ? (
                          <p className="text-sm text-text-muted">
                            No headings found. Paste HTML with <code>&lt;h2&gt;</code> tags, or add
                            headings to your draft — they are what gives a long page structure.
                          </p>
                        ) : (
                          <ol className="space-y-1">
                            {a.headings.map((h, i) => (
                              <li key={`${h.level}-${i}`} className="flex gap-2 text-sm" style={{ paddingLeft: (h.level - 1) * 14 }}>
                                <span className="shrink-0 font-mono text-xs text-text-muted">H{h.level}</span>
                                <span className="min-w-0 break-words text-text">{h.text}</span>
                              </li>
                            ))}
                          </ol>
                        )}

                        {a.topKeywords.length > 0 && (
                          <>
                            <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                              Most used words
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {a.topKeywords.map((k) => (
                                <span key={k.word} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-muted">
                                  {k.word} <span className="font-mono">{k.count}</span>
                                </span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            )}
          </div>
        </div>

      </div>

      <ToolProse sections={CONTENT.sections} />
      <ToolFaqs faqs={CONTENT.faqs} subtitle="Common questions about real-time content analysis." />

      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-[var(--lp-tint)] p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-success">
              <CheckIcon size={18} />
            </span>
            <div>
              <h2 className="font-semibold text-text">This checks your draft. We can check the live page too.</h2>
              <p className="mt-1 max-w-xl text-sm text-text-muted">
                Run the same checks against any published URL, or crawl the whole site for the issues
                a single page can't show you.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/free-tools"><Button variant="secondary">Check a live URL</Button></Link>
            <Link to="/register"><Button>Start free <ArrowRight size={15} /></Button></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
