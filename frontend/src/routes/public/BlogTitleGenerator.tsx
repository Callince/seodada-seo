import { ArrowRight, Check, Copy, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { PublicHero } from "@/components/public/PublicHero";
import { ToolFaqs, ToolProse } from "@/components/public/ToolProse";
import { faqJsonLd, getToolContent } from "@/content/toolContent";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  STYLES, TONES, generateTitles, type TitleStyle, type TitleTone,
} from "@/lib/blogTitles";
import { Seo } from "@/lib/seo";
import { toast } from "@/store/toast";

/**
 * Blog title generator — public, no account.
 *
 * Runs entirely in the browser: the logic is template-based (ported from the
 * seodada Flask tool, which called no model either), so there is no API, no key
 * and no cost. That is what lets it sit outside the login wall with no rate
 * limit to police.
 */
const CONTENT = getToolContent("blog-title-generator");

export default function BlogTitleGenerator() {
  const [topic, setTopic] = useState("");
  const [focusKeyword, setFocusKeyword] = useState("");
  const [style, setStyle] = useState<TitleStyle>("mixed");
  const [tone, setTone] = useState<TitleTone>("formal");
  const [count, setCount] = useState(5);
  const [titles, setTitles] = useState<string[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const run = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!topic.trim()) return;
    setTitles(generateTitles({ topic, focusKeyword, style, tone, count }));
  };

  const copy = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
      setCopied(t);
      setTimeout(() => setCopied((c) => (c === t ? null : c)), 1500);
    } catch {
      toast.error("Couldn't copy — select the text and copy manually.");
    }
  };

  const copyAll = async () => {
    if (!titles?.length) return;
    try {
      await navigator.clipboard.writeText(titles.join("\n"));
      toast.success(`${titles.length} titles copied`);
    } catch {
      toast.error("Couldn't copy to the clipboard.");
    }
  };

  return (
    <div>
      <Seo
        title="Free Blog Title Generator"
        description="Generate SEO-friendly blog title ideas in seconds — how-to, listicle, question, emotional and keyword-led styles. Free, no account, runs entirely in your browser."
        path="/blog-title-generator"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Blog Title Generator",
            applicationCategory: "SEOApplication",
            operatingSystem: "Any",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          },
          ...(faqJsonLd(CONTENT.faqs) ? [faqJsonLd(CONTENT.faqs) as object] : []),
        ]}
      />

      <PublicHero
        eyebrow="Free tool"
        title="Better headlines."
        highlight="Instantly."
        subtitle="Give it a topic — or paste a whole outline — and get title ideas built around the phrase that actually repeats. Nothing is sent anywhere; it all runs in your browser."
      >
        <form onSubmit={run} className="mx-auto w-full max-w-2xl space-y-3 text-left">
          <div>
            <label htmlFor="bt-topic" className="mb-1 block text-sm font-medium text-white/90">
              Topic or outline
            </label>
            <textarea
              id="bt-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              placeholder={"electric scooters in india\n\nOr paste several subtopics, one per line — the most repeated phrase becomes the theme."}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="bt-kw" className="mb-1 block text-xs font-medium text-white/80">
                Focus keyword <span className="font-normal text-white/60">(optional)</span>
              </label>
              <input
                id="bt-kw"
                value={focusKeyword}
                onChange={(e) => setFocusKeyword(e.target.value)}
                placeholder="overrides the topic"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]"
              />
            </div>
            <div>
              <label htmlFor="bt-style" className="mb-1 block text-xs font-medium text-white/80">Style</label>
              <Select id="bt-style" value={style} onChange={(e) => setStyle(e.target.value as TitleStyle)}>
                {STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </div>
            <div>
              <label htmlFor="bt-tone" className="mb-1 block text-xs font-medium text-white/80">Tone</label>
              <Select id="bt-tone" value={tone} onChange={(e) => setTone(e.target.value as TitleTone)}>
                {TONES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </Select>
            </div>
            <div>
              <label htmlFor="bt-count" className="mb-1 block text-xs font-medium text-white/80">How many</label>
              <Select id="bt-count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[3, 5, 8, 10].map((n) => <option key={n} value={n}>{n} titles</option>)}
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-white/70">
              {STYLES.find((s) => s.id === style)?.hint}
            </p>
            <Button type="submit" disabled={!topic.trim()} className="rounded-full">
              <Sparkles size={15} /> {titles ? "Generate again" : "Generate titles"}
            </Button>
          </div>
        </form>
      </PublicHero>

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {titles === null && (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center">
            <p className="text-sm text-text-muted">
              Enter a topic above. Every title is built from templates in your browser — free, instant,
              and nothing leaves this page.
            </p>
          </div>
        )}

        {titles?.length === 0 && (
          <p className="text-sm text-text-muted">Couldn't find a theme in that — try a few more words.</p>
        )}

        {titles && titles.length > 0 && (
          <div className="animate-fade-rise">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-text">
                {titles.length} title{titles.length === 1 ? "" : "s"}
              </h2>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => run()}>
                  <RefreshCw size={14} /> Shuffle
                </Button>
                <Button variant="secondary" size="sm" onClick={copyAll}>
                  <Copy size={14} /> Copy all
                </Button>
              </div>
            </div>

            <ol className="space-y-2">
              {titles.map((t, i) => (
                <li
                  key={t}
                  className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:border-primary/40"
                >
                  <span className="mt-0.5 w-5 shrink-0 text-right font-mono text-xs text-text-muted">{i + 1}</span>
                  <p className="min-w-0 flex-1 text-sm text-text">{t}</p>
                  <div className="flex shrink-0 items-center gap-2">
                    {/* Length matters more than most people realise: Google
                        truncates around 60 characters in the SERP. */}
                    <span
                      className={t.length > 60 ? "text-xs text-warning" : "text-xs text-text-muted"}
                      title={t.length > 60 ? "Longer than ~60 characters — Google may truncate it" : "Fits a typical SERP"}
                    >
                      {t.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => copy(t)}
                      aria-label={`Copy title ${i + 1}`}
                      className="rounded-md p-1 text-text-muted opacity-0 transition-opacity hover:bg-surface-2 hover:text-text focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      {copied === t ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                    </button>
                  </div>
                </li>
              ))}
            </ol>

            <p className="mt-4 text-xs text-text-muted">
              Titles over 60 characters are flagged — Google usually truncates around there.
            </p>
          </div>
        )}

      </div>

      <ToolProse sections={CONTENT.sections} />
      <ToolFaqs faqs={CONTENT.faqs} subtitle="Common questions about generating blog titles." />

      <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-[var(--lp-tint)] p-6">
          <div>
            <h2 className="font-semibold text-text">Want to know which title will actually rank?</h2>
            <p className="mt-1 max-w-xl text-sm text-text-muted">
              Check the search volume, difficulty and intent behind the keyword first — then pick the
              title that matches what people are really searching for.
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/free-tools"><Button variant="secondary">More free tools</Button></Link>
            <Link to="/register"><Button>Start free <ArrowRight size={15} /></Button></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
