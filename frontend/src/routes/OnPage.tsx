import { BookOpen, FileText, Gauge, GraduationCap, RefreshCw, Search, Wrench } from "lucide-react";
import { useState } from "react";

import { useLighthouse, useOnPage } from "@/api/hooks/useOnPage";
import { apiErrorMessage } from "@/api/client";
import { ScoreRing, type Tone } from "@/components/public/landingKit";
import { CacheBadge } from "@/components/shared/CacheBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { ExcelButton } from "@/components/shared/ExcelButton";
import { MetricCard } from "@/components/shared/MetricCard";
import { SaveToProject } from "@/components/shared/SaveToProject";
import { ScoreGauge } from "@/components/shared/ScoreGauge";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtInt } from "@/lib/format";
import { usePersistedState } from "@/lib/persist";
import type {
  Benchmark,
  DensityRow,
  ImageAudit,
  Indexability,
  KeywordAnalysis,
  LinkAudit,
  OnPageResponse,
  SnippetPreview,
  SubScore,
} from "@/types";

const STATUS_BAR: Record<SubScore["status"], string> = {
  good: "bg-success",
  warn: "bg-warning",
  bad: "bg-danger",
  "n/a": "bg-text-muted/40",
};

const HEALTH_TONE: Record<KeywordAnalysis["health"], "success" | "warning" | "danger" | "info"> = {
  optimal: "success",
  low: "info",
  high: "warning",
  stuffed: "danger",
  absent: "danger",
};

const PLACEMENT_LABELS: Record<string, string> = {
  in_title: "Title",
  in_h1: "H1",
  in_meta_description: "Meta description",
  in_intro: "Intro",
  in_url: "URL",
};

function ScoreBreakdown({ subscores }: { subscores: SubScore[] }) {
  if (!subscores.length) return null;
  return (
    <div className="space-y-2.5">
      {subscores.map((s) => (
        <div key={s.label}>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text">{s.label}</span>
            <span className="font-mono text-xs text-text-muted">
              {s.score}/{s.max}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className={`h-full rounded-full ${STATUS_BAR[s.status]}`}
              style={{ width: `${Math.max(4, (s.score / s.max) * 100)}%` }}
            />
          </div>
          {s.note && <p className="mt-0.5 text-xs text-text-muted">{s.note}</p>}
        </div>
      ))}
    </div>
  );
}

function KeywordPanel({ ka }: { ka: KeywordAnalysis }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-text-muted">
          “{ka.keyword}” · {ka.frequency}× · {ka.density.toFixed(2)}%
        </span>
        <Badge tone={HEALTH_TONE[ka.health]}>{ka.health}</Badge>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(ka.placements).map(([k, ok]) => (
          <span
            key={k}
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              ok ? "bg-success/12 text-success" : "bg-surface-2 text-text-muted line-through"
            }`}
          >
            {ok ? "✓" : "✕"} {PLACEMENT_LABELS[k] ?? k}
          </span>
        ))}
      </div>
    </div>
  );
}

const densityCols: Column<DensityRow>[] = [
  { key: "keyword", header: "Term", sortValue: (r) => r.keyword },
  { key: "frequency", header: "Count", align: "right", mono: true, sortValue: (r) => r.frequency },
  {
    key: "density",
    header: "Density",
    align: "right",
    mono: true,
    sortValue: (r) => r.density,
    render: (r) => `${r.density.toFixed(2)}%`,
    csvValue: (r) => r.density,
  },
];

function SnippetCard({ snippet }: { snippet: SnippetPreview }) {
  const { title, meta_description: meta } = snippet;
  let host = snippet.url;
  try {
    host = new URL(snippet.url).hostname;
  } catch {
    /* keep raw */
  }
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="text-xs text-text-muted">{host}</p>
        <p className="text-lg leading-tight text-[#1a0dab]">{title.preview || "—"}</p>
        <p className="mt-1 text-sm text-text-muted">{meta.preview || "—"}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <PixelBar label="Title" m={title} />
        <PixelBar label="Meta" m={meta} />
      </div>
    </div>
  );
}

function PixelBar({ label, m }: { label: string; m: SnippetPreview["title"] }) {
  return (
    <div>
      <div className="flex justify-between text-text-muted">
        <span>{label}</span>
        <span className={m.truncated ? "text-danger" : "text-success"}>
          {Math.round(m.pixels)}/{m.limit_pixels}px {m.truncated ? "· truncates" : "· fits"}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full ${m.truncated ? "bg-danger" : "bg-success"}`}
          style={{ width: `${Math.min(100, m.fill_pct)}%` }}
        />
      </div>
    </div>
  );
}

function Flag({ ok, label, bad }: { ok: boolean; label: string; bad?: boolean }) {
  const tone = bad ? "bg-danger/15 text-danger" : ok ? "bg-success/12 text-success" : "bg-surface-2 text-text-muted";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{ok ? "✓" : "✕"} {label}</span>;
}

function TechnicalPanel({
  indexability,
  images,
  links,
}: {
  indexability: Indexability;
  images: ImageAudit | null;
  links: LinkAudit | null;
}) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-1.5">
        {indexability.noindex ? (
          <span className="rounded-full bg-danger/15 px-2 py-0.5 text-xs font-medium text-danger">
            ⚠ noindex — page can’t rank
          </span>
        ) : (
          <Flag ok label="indexable" />
        )}
        <Flag ok={!!indexability.canonical} label="canonical" />
        <Flag ok={indexability.has_viewport} label="viewport" />
        <Flag ok={!!indexability.lang} label={`lang${indexability.lang ? ` (${indexability.lang})` : ""}`} />
        <Flag ok={indexability.open_graph} label="Open Graph" />
        <Flag ok={indexability.twitter_card} label="Twitter card" />
        <Flag ok={indexability.schema_types.length > 0} label="schema" />
      </div>
      {indexability.schema_types.length > 0 && (
        <p className="text-xs text-text-muted">Schema: {indexability.schema_types.join(", ")}</p>
      )}
      {images && (
        <p className="text-text-muted">
          Images: <span className="text-text">{images.total}</span>
          {images.missing_alt > 0 && (
            <span className="text-danger"> · {images.missing_alt} missing alt</span>
          )}
        </p>
      )}
      {links && (
        <p className="text-text-muted">
          Links: <span className="text-text">{links.internal}</span> internal ·{" "}
          <span className="text-text">{links.external}</span> external
        </p>
      )}
    </div>
  );
}

function ImagesCard({ images }: { images: ImageAudit }) {
  const [open, setOpen] = useState(false);
  const fileName = (src: string) => {
    try {
      return decodeURIComponent(new URL(src).pathname.split("/").pop() || src);
    } catch {
      return src;
    }
  };
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <p className="text-text-muted">
          <span className="font-mono text-text">{images.total}</span> images ·{" "}
          {images.missing_alt > 0 ? (
            <span className="text-danger">{images.missing_alt} missing alt text</span>
          ) : (
            <span className="text-success">all have alt text</span>
          )}
        </p>
        {images.items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
            {open ? "Hide images" : `View all ${images.total}`}
          </Button>
        )}
      </div>
      {open && (
        <ul className="max-h-96 space-y-2 overflow-auto pr-1">
          {images.items.map((img, i) => (
            <li
              key={i}
              className={`flex items-center gap-3 rounded-md border p-2 ${
                img.has_alt ? "border-border" : "border-danger/40 bg-danger/5"
              }`}
            >
              <img
                src={img.src}
                alt=""
                loading="lazy"
                className="h-12 w-12 shrink-0 rounded bg-surface-2 object-cover"
                onError={(e) => {
                  e.currentTarget.style.visibility = "hidden";
                }}
              />
              <div className="min-w-0 flex-1">
                <a
                  href={img.src}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-[color:var(--section-ink)] hover:underline"
                >
                  {fileName(img.src) || "(no src)"}
                </a>
                {img.has_alt ? (
                  <p className="truncate text-text-muted">alt: {img.alt}</p>
                ) : (
                  <span className="mt-0.5 inline-block rounded-full bg-danger/15 px-2 py-0.5 text-xs font-medium text-danger">
                    missing alt text
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BenchmarkPanel({ b }: { b: Benchmark }) {
  const wc = b.word_count;
  const max = Math.max(wc.you, wc.median, wc.max, 1);
  const row = (label: string, val: number, tone: string) => (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-sm text-text-muted">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${(val / max) * 100}%` }} />
      </div>
      <span className="w-16 text-right font-mono text-xs text-text">{fmtInt(val)}</span>
    </div>
  );
  return (
    <div className="space-y-4">
      <p className="text-xs text-text-muted">
        Compared against the top {b.competitors_analyzed} ranking pages for “{b.keyword}”.
      </p>
      <div className="space-y-2">
        {row("Your words", wc.you, wc.you >= wc.median ? "bg-success" : "bg-warning")}
        {row("Top median", wc.median, "bg-primary")}
        {row("Top max", wc.max, "bg-accent")}
      </div>
      <p className="text-sm text-text-muted">
        Headings: <span className="text-text">{b.headings.you}</span> vs top median{" "}
        <span className="text-text">{b.headings.median}</span>
      </p>
      {b.missing_terms.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
            Content gap — terms competitors use that you’re missing
          </p>
          <div className="flex flex-wrap gap-1.5">
            {b.missing_terms.map((g) => (
              <span
                key={g.term}
                className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning"
                title={`${g.competitors_using} of top competitors use this`}
              >
                {g.term} · {g.competitors_using}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const LH_CATEGORIES: { key: string; label: string }[] = [
  { key: "performance", label: "Performance" },
  { key: "accessibility", label: "Accessibility" },
  { key: "best-practices", label: "Best Practices" },
  { key: "seo", label: "SEO" },
];

const LH_VITALS: { key: string; label: string }[] = [
  { key: "lcp", label: "LCP" },
  { key: "cls", label: "CLS" },
  { key: "tbt", label: "TBT" },
  { key: "fcp", label: "FCP" },
  { key: "speed_index", label: "SI" },
  { key: "tti", label: "TTI" },
];

const ringTone = (score: number): Tone => (score >= 90 ? "emerald" : score >= 50 ? "amber" : "blue");

const vitalDot = (score: number | null) =>
  score == null ? "bg-text-muted/40" : score >= 90 ? "bg-success" : score >= 50 ? "bg-warning" : "bg-danger";

function LighthouseCard({ url }: { url: string }) {
  const lh = useLighthouse();
  const data = lh.data;
  const run = (force_live = false) => lh.mutate({ url, force_live });

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle>Core Web Vitals (Lighthouse)</CardTitle>
          <p className="mt-0.5 text-xs text-text-muted">Mobile Lighthouse run via DataForSEO.</p>
        </div>
        <div className="flex items-center gap-2">
          {data && <CacheBadge meta={data.meta} />}
          <Button
            type="button"
            size="sm"
            variant={data ? "secondary" : "primary"}
            disabled={lh.isPending}
            onClick={() => run(!!data)}
            title={data ? "Bypass the cache and run live" : "Runs a separate billed Lighthouse audit"}
          >
            <Gauge size={15} /> {lh.isPending ? "Running…" : data ? "Re-run" : "Run Lighthouse"}
          </Button>
        </div>
      </CardHeader>
      <CardBody>
        {lh.isPending && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-6">
              {LH_CATEGORIES.map((c) => (
                <Skeleton key={c.key} className="h-[88px] w-[88px] rounded-full" />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {LH_VITALS.map((v) => (
                <Skeleton key={v.key} className="h-16" />
              ))}
            </div>
          </div>
        )}
        {lh.isError && !lh.isPending && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-danger">{apiErrorMessage(lh.error)}</p>
            <Button type="button" variant="ghost" size="sm" onClick={() => run()}>
              Retry
            </Button>
          </div>
        )}
        {!lh.isPending && !lh.isError && !data && (
          <p className="text-sm text-text-muted">
            Measure performance, accessibility, and Core Web Vitals with Google Lighthouse. This is a
            separate billed call, so it only runs when you ask.
          </p>
        )}
        {data && !lh.isPending && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
              {LH_CATEGORIES.filter((c) => data.categories[c.key] != null).map((c) => {
                const score = Math.round(data.categories[c.key]);
                return <ScoreRing key={c.key} value={score} size={88} label={c.label} tone={ringTone(score)} />;
              })}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {LH_VITALS.map((v) => {
                const m = data.vitals[v.key];
                return (
                  <div key={v.key} className="rounded-lg border border-border bg-surface p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{v.label}</p>
                      <span className={`h-2 w-2 shrink-0 rounded-full ${vitalDot(m?.score ?? null)}`} />
                    </div>
                    <p className="mt-1 font-mono text-lg text-text">{m?.display ?? "—"}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export default function OnPage({ embedded }: { embedded?: boolean }) {
  const [url, setUrl] = usePersistedState("onpage.url", "");
  const [keyword, setKeyword] = usePersistedState("onpage.keyword", "");
  const [detailTab, setDetailTab] = usePersistedState("onpage.tab", "overview");
  const mutation = useOnPage();
  // Persisted so the report survives navigating away and back.
  const [data, setData] = usePersistedState<OnPageResponse | null>("onpage.data", null);

  const run = (force_live = false) => {
    const u = url.trim();
    if (u) mutation.mutate({ url: u, target_keyword: keyword.trim() || undefined, force_live }, { onSuccess: setData });
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run();
  };

  return (
    <div>
      {!embedded && (
        <PageHeader title="On-Page Analysis" subtitle="Content score, readability, keyword density, and on-page issues for any URL." />
      )}

      <Card className="mb-5">
        <CardBody>
          <form onSubmit={submit} className="flex flex-col gap-3 md:flex-row">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/page" className="lg:flex-1" />
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Target keyword (optional)" className="lg:w-64" />
            <Button type="submit" disabled={mutation.isPending || !url.trim()}>
              <Search size={16} /> {mutation.isPending ? "Analyzing…" : "Analyze"}
            </Button>
            {data && (
              <Button type="button" variant="secondary" title="Bypass the cache and fetch live"
                disabled={mutation.isPending || !url.trim()} onClick={() => run(true)}>
                <RefreshCw size={15} className={mutation.isPending ? "animate-spin" : ""} /> Refresh
              </Button>
            )}
          </form>
          {data?.meta && <div className="mt-3"><CacheBadge meta={data.meta} /></div>}
        </CardBody>
      </Card>

      {mutation.isPending && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48 lg:col-span-2" />
        </div>
      )}
      {mutation.isError && !mutation.isPending && (
        <ErrorState message={apiErrorMessage(mutation.error)} onRetry={() => run()} />
      )}
      {!mutation.isPending && !mutation.isError && !data && (
        <EmptyState title="Analyze a page" hint="Enter a URL to score its content and inspect keyword density." />
      )}

      {data && !mutation.isPending && (
        <OnPageReport
          data={data}
          keyword={keyword}
          tab={detailTab}
          onTab={setDetailTab}
        />
      )}
    </div>
  );
}

function OnPageReport({
  data,
  keyword,
  tab,
  onTab,
}: {
  data: OnPageResponse;
  keyword: string;
  tab: string;
  onTab: (t: string) => void;
}) {
  const buildExcel = () => {
    const b = data.benchmark;
    const scoreRows = [
      { metric: "Content score", score: data.content_score, max: 100, status: null, note: null },
      { metric: "Technical score", score: data.technical_score, max: 100, status: null, note: null },
      { metric: "Word count", score: data.word_count, max: null, status: null, note: null },
      { metric: "Readability (Flesch-Kincaid)", score: data.readability.flesch_kincaid, max: null, status: null, note: null },
      { metric: "Readability (ARI)", score: data.readability.ari, max: null, status: null, note: null },
      ...data.subscores.map((s) => ({
        metric: s.label, score: s.score, max: s.max, status: s.status, note: s.note,
      })),
    ];
    return {
      summary: {
        Report: "On-Page Analysis",
        URL: data.url,
        "Target keyword": keyword.trim() || undefined,
        Generated: new Date().toLocaleString(),
      },
      sheets: [
        {
          name: "Scores",
          columns: [
            { header: "Metric", key: "metric", width: 30 },
            { header: "Score", key: "score", width: 10 },
            { header: "Max", key: "max", width: 8 },
            { header: "Status", key: "status", width: 10 },
            { header: "Note", key: "note", width: 60 },
          ],
          rows: scoreRows as unknown as Record<string, unknown>[],
        },
        {
          name: "Issues & recommendations",
          columns: [
            { header: "Type", key: "type", width: 16 },
            { header: "Item", key: "item", width: 90 },
          ],
          rows: [
            ...data.issues.map((i) => ({ type: "Issue", item: i })),
            ...data.recommendations.map((r) => ({ type: "Recommendation", item: r })),
          ] as unknown as Record<string, unknown>[],
        },
        {
          name: "Keyword density",
          columns: [
            { header: "Term", key: "keyword", width: 32 },
            { header: "Count", key: "frequency", width: 10 },
            { header: "Density %", key: "density", width: 12 },
          ],
          rows: data.keyword_density as unknown as Record<string, unknown>[],
        },
        {
          name: "Benchmark",
          columns: [
            { header: "Metric", key: "metric", width: 20 },
            { header: "You", key: "you", width: 12 },
            { header: "Top median", key: "median", width: 12 },
            { header: "Top max", key: "max", width: 12 },
          ],
          rows: (b
            ? [
                { metric: "Word count", you: b.word_count.you, median: b.word_count.median, max: b.word_count.max },
                { metric: "Headings", you: b.headings.you, median: b.headings.median, max: null },
              ]
            : []) as unknown as Record<string, unknown>[],
        },
        {
          name: "Content gap",
          columns: [
            { header: "Term", key: "term", width: 28 },
            { header: "Competitors using", key: "competitors_using", width: 18 },
            { header: "Your count", key: "your_count", width: 12 },
          ],
          rows: (b?.missing_terms ?? []) as unknown as Record<string, unknown>[],
        },
      ],
    };
  };

  const sections = [
    { key: "overview", label: "Overview", show: data.subscores.length > 0 || data.recommendations.length > 0 },
    { key: "keyword", label: "Keyword", show: !!data.keyword_analysis || data.keyword_density.length > 0 },
    { key: "snippet", label: "Snippet & meta", show: !!data.snippet || !!data.title || !!data.meta_description },
    { key: "technical", label: "Technical", show: !!data.indexability || !!(data.images && data.images.total > 0) },
    { key: "competitive", label: "Competitive", show: !!data.benchmark },
  ].filter((s) => s.show);
  const active = sections.some((s) => s.key === tab) ? tab : sections[0]?.key;

  return (
    <div className="animate-fade-rise space-y-4">
      {/* Summary header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="truncate text-lg font-semibold text-text">
          {(() => {
            try {
              return new URL(data.url).hostname;
            } catch {
              return data.url;
            }
          })()}
        </h2>
        <div className="flex items-center gap-2">
          <CacheBadge meta={data.meta} />
          <ExcelButton
            filename={`onpage-${(() => {
              try {
                return new URL(data.url).hostname;
              } catch {
                return data.url;
              }
            })()}`}
            build={buildExcel}
          />
          <SaveToProject
            module="onpage"
            params={{ url: data.url, target_keyword: keyword.trim() || undefined }}
            result={data as unknown as Record<string, unknown>}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardBody className="flex flex-col items-center justify-center gap-3 py-6">
            <ScoreGauge score={data.content_score} label="content score" />
            {(() => {
              const s = data.content_score;
              const v =
                s == null
                  ? null
                  : s >= 90
                    ? { t: "Excellent", c: "success" as const }
                    : s >= 70
                      ? { t: "Good", c: "success" as const }
                      : s >= 50
                        ? { t: "Fair", c: "warning" as const }
                        : { t: "Needs work", c: "danger" as const };
              return v ? <Badge tone={v.c}>{v.t}</Badge> : null;
            })()}
          </CardBody>
        </Card>
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <MetricCard icon={FileText} label="Word count" value={fmtInt(data.word_count)} />
          <MetricCard icon={BookOpen} label="Readability (FK)" value={data.readability.flesch_kincaid?.toFixed(1) ?? "—"} />
          <MetricCard icon={GraduationCap} label="ARI" value={data.readability.ari?.toFixed(1) ?? "—"} />
          {data.technical_score != null && (
            <MetricCard icon={Wrench} label="Technical" value={data.technical_score.toFixed(0)} />
          )}
        </div>
      </div>

      {/* Core Web Vitals — explicit, separately billed Lighthouse run */}
      <LighthouseCard key={data.url} url={data.url} />

      {/* Detail tabs */}
      {sections.length > 0 && (
        <div className="sticky top-0 z-10 -mx-1 bg-app-bg/90 px-1 py-1 backdrop-blur">
          <Tabs value={active ?? "overview"} onChange={onTab}>
            <TabsList>
              {sections.map((s) => (
                <TabsTrigger key={s.key} value={s.key}>
                  {s.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      {active === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.subscores.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Score breakdown</CardTitle>
              </CardHeader>
              <CardBody>
                <ScoreBreakdown subscores={data.subscores} />
              </CardBody>
            </Card>
          )}
          {data.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
              </CardHeader>
              <CardBody>
                <ul className="space-y-1.5 text-sm text-text">
                  {data.recommendations.map((r, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-[color:var(--section-ink)]">→</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {active === "keyword" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.keyword_analysis && (
            <Card>
              <CardHeader>
                <CardTitle>Keyword optimization</CardTitle>
              </CardHeader>
              <CardBody>
                <KeywordPanel ka={data.keyword_analysis} />
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Keyword density</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              {data.keyword_density.length ? (
                <DataTable columns={densityCols} rows={data.keyword_density} csvName="keyword-density" />
              ) : (
                <div className="px-5 py-4 text-sm text-text-muted">
                  Page text could not be fetched for density analysis.
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {active === "snippet" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.snippet && (
            <Card>
              <CardHeader>
                <CardTitle>SERP snippet preview</CardTitle>
              </CardHeader>
              <CardBody>
                <SnippetCard snippet={data.snippet} />
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Meta &amp; headings</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">Title</p>
                <p className="text-text">{data.title || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">Meta description</p>
                <p className="text-text-muted">{data.meta_description || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">H1</p>
                {data.h1.length ? (
                  <ul className="list-inside list-disc text-text">
                    {data.h1.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-text-muted">—</p>
                )}
              </div>
              {data.issues.length > 0 && (
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-text-muted">Issues</p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.issues.map((iss, i) => (
                      <Badge key={i} tone="warning">
                        {iss}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {active === "technical" && (
        <div className="space-y-4">
          {data.indexability && (
            <Card>
              <CardHeader>
                <CardTitle>Technical &amp; indexability</CardTitle>
              </CardHeader>
              <CardBody>
                <TechnicalPanel indexability={data.indexability} images={data.images} links={data.links} />
              </CardBody>
            </Card>
          )}
          {data.images && data.images.total > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Images &amp; alt text</CardTitle>
              </CardHeader>
              <CardBody>
                <ImagesCard images={data.images} />
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {active === "competitive" && data.benchmark && (
        <Card>
          <CardHeader>
            <CardTitle>Competitive benchmark &amp; content gap</CardTitle>
          </CardHeader>
          <CardBody>
            <BenchmarkPanel b={data.benchmark} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
