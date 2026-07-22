import { motion } from "framer-motion";
import { ArrowRight, Check, Search, X } from "lucide-react";
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import { apiErrorMessage } from "@/api/client";
import { usePublicAnalyze } from "@/api/hooks/usePublicAnalyze";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Result of the anonymous page audit.
 *
 * Shows genuine passes AND failures — a demo that only ever says "all good"
 * proves nothing. The sign-up CTA is the next step, not the price of entry.
 *
 * Extracted from the landing hero so the hero and the features page render one
 * implementation rather than two that drift.
 */
export function AnalyzerResult({
  state,
  onReset,
  detailed = false,
}: {
  state: ReturnType<typeof usePublicAnalyze>;
  onReset: () => void;
  /** Also show the page-inventory counts. The hero stays compact; the features
   *  page has room and is billed as "all-in-one page analytics". */
  detailed?: boolean;
}) {
  if (state.isPending) {
    return <p className="mt-3 text-sm text-text-muted">Fetching and analysing that page…</p>;
  }
  if (state.isError) {
    const status = (state.error as { response?: { status?: number } })?.response?.status;
    return (
      <p className="mt-3 text-sm text-danger">
        {status === 429
          ? "That's a few checks in a row — give it a minute, or create a free account for unlimited runs."
          : apiErrorMessage(state.error)}
      </p>
    );
  }
  const d = state.data;
  if (!d) return null;

  const tone = d.score >= 80 ? "text-success" : d.score >= 50 ? "text-warning" : "text-danger";
  const failed = d.checks.filter((c) => !c.ok);

  const inventory = [
    { label: "Headings", value: d.summary.headings },
    { label: "Images", value: d.summary.images },
    { label: "Internal links", value: d.summary.internal_links },
    { label: "External links", value: d.summary.external_links },
  ].filter((s) => s.value != null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "mx-auto mt-4 rounded-2xl border border-border bg-[var(--lp-glass)] p-4 text-left shadow-lg backdrop-blur",
        detailed ? "max-w-2xl" : "max-w-lg",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-text-muted">{d.url}</p>
          <p className="mt-0.5 text-sm font-semibold text-text">
            <span className={`font-mono text-xl ${tone}`}>{d.score}%</span>{" "}
            <span className="text-text-muted">— {d.passed} of {d.total} checks passed</span>
          </p>
        </div>
        <button
          onClick={onReset}
          className="shrink-0 rounded-md px-2 py-1 text-xs text-text-muted hover:bg-surface-2 hover:text-text"
        >
          Clear
        </button>
      </div>

      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {d.checks.map((c) => (
          <li key={c.label} className="flex items-center gap-1.5 text-xs">
            {c.ok ? (
              <Check size={13} className="shrink-0 text-success" />
            ) : (
              <X size={13} className="shrink-0 text-danger" />
            )}
            <span className={c.ok ? "text-text-muted" : "font-medium text-text"}>{c.label}</span>
            {detailed && c.detail && (
              <span className="ml-auto min-w-0 truncate pl-2 text-text-muted" title={c.detail}>
                {c.detail}
              </span>
            )}
          </li>
        ))}
      </ul>

      {detailed && inventory.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 sm:grid-cols-4">
          {inventory.map((s) => (
            <div key={s.label}>
              <dt className="text-[11px] uppercase tracking-wide text-text-muted">{s.label}</dt>
              <dd className="font-mono text-lg text-text">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <p className="mt-3 border-t border-border pt-3 text-xs text-text-muted">
        {failed.length > 0
          ? `${failed.length} issue${failed.length > 1 ? "s" : ""} found on this page. `
          : "The basics look good. "}
        Create a free account to crawl the whole site, track rankings, and see the full fix list.
      </p>
      <RouterLink to="/register" className="mt-2 inline-block">
        <Button size="sm" className="rounded-full">
          See the full report <ArrowRight size={14} />
        </Button>
      </RouterLink>
    </motion.div>
  );
}

/**
 * Self-contained "try it now" analyzer: input + result, no account.
 *
 * The whole point is that a visitor gets a real audit without ever reaching the
 * dashboard. Server-side this is free ($0, runs in-process), SSRF-guarded and
 * per-IP rate limited, so exposing it anonymously is safe.
 */
export function PageAnalyzer() {
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
      <form onSubmit={submit} className="mx-auto flex max-w-xl flex-col gap-2 sm:flex-row">
        <label htmlFor="pa-url" className="sr-only">Page URL to analyse</label>
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            id="pa-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="yoursite.com/page"
            inputMode="url"
            className="w-full rounded-full border border-border bg-surface py-2.5 pl-9 pr-4 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--section)]"
          />
        </div>
        <Button type="submit" loading={analyze.isPending} disabled={!url.trim()} className="rounded-full">
          {!analyze.isPending && <>Analyse <ArrowRight size={15} /></>}
        </Button>
      </form>
      <p className="mt-2 text-center text-xs text-text-muted">
        Free, no account, no card. Runs on our own crawler — nothing is billed.
      </p>
      <AnalyzerResult state={analyze} onReset={() => analyze.reset()} detailed />
    </div>
  );
}
