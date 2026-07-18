import { ExternalLink, Frown, Gauge, Meh, RefreshCw, Search, Smile } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { useContentAnalysis, usePhraseTrends, useSentiment } from "@/api/hooks/useContent";
import { apiErrorMessage } from "@/api/client";
import { AreaChart } from "@/components/public/landingKit";
import { CacheBadge } from "@/components/shared/CacheBadge";
import { ExcelButton } from "@/components/shared/ExcelButton";
import { MetricCard } from "@/components/shared/MetricCard";
import { SaveToProject } from "@/components/shared/SaveToProject";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtInt } from "@/lib/format";
import { usePersistedState } from "@/lib/persist";
import type { Connotations, ContentResponse, PhraseTrendsResponse, SentimentResponse } from "@/types";

const SENTIMENT_COLORS = {
  positive: "var(--success)",
  neutral: "var(--text-muted)",
  negative: "var(--danger)",
};

function pct(v: number | null, total: number): number {
  return total > 0 ? Math.round(((v ?? 0) / total) * 100) : 0;
}

function SentimentDonut({ data }: { data: ContentResponse }) {
  const s = data.sentiment;
  const slices = [
    { name: "Positive", value: s.positive ?? 0, color: SENTIMENT_COLORS.positive },
    { name: "Neutral", value: s.neutral ?? 0, color: SENTIMENT_COLORS.neutral },
    { name: "Negative", value: s.negative ?? 0, color: SENTIMENT_COLORS.negative },
  ].filter((x) => x.value > 0);
  const total = slices.reduce((a, b) => a + b.value, 0);

  if (!slices.length)
    return <EmptyState title="No sentiment data" hint="No connotation breakdown was returned." />;

  return (
    <div className="flex flex-col items-center gap-3">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={slices} dataKey="value" innerRadius={60} outerRadius={90} paddingAngle={2}>
            {slices.map((sl) => (
              <Cell key={sl.name} fill={sl.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => `${pct(Number(v), total)}%`}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex gap-4 text-sm">
        {slices.map((sl) => (
          <span key={sl.name} className="flex items-center gap-1.5 text-text-muted">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: sl.color }} />
            {sl.name} {pct(sl.value, total)}%
          </span>
        ))}
      </div>
    </div>
  );
}

// Categorical chart palette (like TrendChart's series colors) — emotions have
// no semantic tokens, so these stay literal by design.
const CONNOTATION_COLORS: Record<keyof Connotations, string> = {
  happiness: "#10B981",
  love: "#EC4899",
  fun: "#F59E0B",
  sadness: "#0EA5E9",
  anger: "#F43F5E",
};

function ConnotationBars({ data }: { data: Connotations }) {
  const entries = (Object.keys(CONNOTATION_COLORS) as (keyof Connotations)[]).map((k) => ({
    label: k,
    value: data[k] ?? 0,
  }));
  const max = Math.max(...entries.map((e) => e.value), 0.0001);

  return (
    <div className="space-y-2.5">
      {entries.map((e) => (
        <div key={e.label} className="flex items-center gap-3">
          <span className="w-20 text-sm capitalize text-text-muted">{e.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full"
              style={{ width: `${(e.value / max) * 100}%`, background: CONNOTATION_COLORS[e.label] }}
            />
          </div>
          <span className="w-10 text-right font-mono text-xs text-text-muted">
            {(e.value * 100).toFixed(0)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Design-token fill for a connotation bar; unknown connotations fall back to primary. */
function connotationFill(label: string): string {
  const k = label.toLowerCase();
  if (k === "positive") return "bg-success";
  if (k === "negative") return "bg-danger";
  if (k === "neutral") return "bg-text-muted/40";
  return "bg-[color:var(--section)]";
}

function BrandSentiment({ data }: { data: SentimentResponse }) {
  const entries = Object.entries(data.connotations);
  const max = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div>
      <p className="text-3xl font-semibold text-text">
        {data.total_citations !== null ? fmtInt(data.total_citations) : "—"}
      </p>
      <p className="text-xs text-text-muted">total citations</p>
      {entries.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {entries.map(([label, value]) => (
            <div key={label} className="flex items-center gap-3">
              <span className="w-20 truncate text-sm capitalize text-text-muted">{label}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={`h-full rounded-full ${connotationFill(label)}`}
                  style={{ width: `${(value / max) * 100}%` }}
                />
              </div>
              <span className="w-12 text-right font-mono text-xs text-text-muted">{fmtInt(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CitationTrend({ data }: { data: PhraseTrendsResponse }) {
  const values = data.rows.map((r) => r.citations ?? 0);
  if (values.length < 2) return <p className="text-sm text-text-muted">Not enough data yet.</p>;

  const first = data.rows[0]?.date ?? "—";
  const last = data.rows[data.rows.length - 1]?.date ?? "—";

  return (
    <div>
      <div className="h-36">
        <AreaChart values={values} id="citation-trend" height={144} tone="violet" />
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-xs text-text-muted">
        <span>{first}</span>
        <span>{last}</span>
      </div>
    </div>
  );
}

export default function ContentAnalysis({ embedded }: { embedded?: boolean }) {
  const [keyword, setKeyword] = usePersistedState("content.keyword", "");
  const mutation = useContentAnalysis();
  const sentimentMutation = useSentiment();
  const trendsMutation = usePhraseTrends();
  // Persisted so results survive navigating away and back.
  const [data, setData] = usePersistedState<ContentResponse | null>("content.data", null);
  const [sentimentData, setSentimentData] = usePersistedState<SentimentResponse | null>("content.sentiment", null);
  const [trendsData, setTrendsData] = usePersistedState<PhraseTrendsResponse | null>("content.trends", null);

  const run = (force_live = false) => {
    const k = keyword.trim();
    if (!k) return;
    mutation.mutate({ keyword: k, force_live }, { onSuccess: setData });
    // Non-blocking enrichment: errors are swallowed (the cards simply don't render).
    sentimentMutation.mutate(
      { keyword: k, force_live },
      { onSuccess: setSentimentData, onError: () => setSentimentData(null) },
    );
    trendsMutation.mutate(
      { keyword: k, force_live },
      { onSuccess: setTrendsData, onError: () => setTrendsData(null) },
    );
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run();
  };

  const buildExcel = () => {
    if (!data) return null;
    const s = data.sentiment;
    return {
      summary: {
        Report: "Content Analysis",
        Keyword: data.keyword,
        "Total citations": data.total_count,
        Generated: new Date().toLocaleString(),
      },
      sheets: [
        {
          name: "Sentiment",
          columns: [
            { header: "Sentiment", key: "sentiment", width: 14 },
            { header: "Citations", key: "count", width: 12 },
          ],
          rows: [
            { sentiment: "Positive", count: s.positive },
            { sentiment: "Neutral", count: s.neutral },
            { sentiment: "Negative", count: s.negative },
          ] as unknown as Record<string, unknown>[],
        },
        {
          name: "Connotations",
          columns: [
            { header: "Connotation", key: "connotation", width: 16 },
            { header: "Score", key: "score", width: 12 },
          ],
          rows: Object.entries(data.connotations).map(([connotation, score]) => ({
            connotation,
            score,
          })) as unknown as Record<string, unknown>[],
        },
        {
          name: "Top citations",
          columns: [
            { header: "Domain", key: "domain", width: 28 },
            { header: "Title", key: "title", width: 50 },
            { header: "URL", key: "url", width: 60 },
            { header: "Snippet", key: "snippet", width: 80 },
          ],
          rows: data.top_citations as unknown as Record<string, unknown>[],
        },
        {
          name: "Brand sentiment",
          columns: [
            { header: "Connotation", key: "connotation", width: 16 },
            { header: "Citations", key: "citations", width: 12 },
          ],
          rows: Object.entries(sentimentData?.connotations ?? {}).map(
            ([connotation, citations]) => ({ connotation, citations }),
          ) as unknown as Record<string, unknown>[],
        },
        {
          name: "Citation trend",
          columns: [
            { header: "Date", key: "date", width: 14 },
            { header: "Citations", key: "citations", width: 12 },
          ],
          rows: (trendsData?.rows ?? []) as unknown as Record<string, unknown>[],
        },
      ],
    };
  };

  return (
    <div>
      {!embedded && (
        <PageHeader title="Content Analysis" subtitle="Sentiment, emotional connotations, and top citations for a keyword or brand." />
      )}

      <Card className="mb-5">
        <CardBody>
          <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Keyword or brand, e.g. patagonia" className="sm:flex-1" />
            <Button type="submit" disabled={mutation.isPending || !keyword.trim()}>
              <Search size={16} /> {mutation.isPending ? "Analyzing…" : "Analyze"}
            </Button>
            {data && (
              <Button type="button" variant="secondary" title="Bypass the cache and fetch live"
                disabled={mutation.isPending || !keyword.trim()} onClick={() => run(true)}>
                <RefreshCw size={15} className={mutation.isPending ? "animate-spin" : ""} /> Refresh
              </Button>
            )}
          </form>
          {data?.meta && <div className="mt-3"><CacheBadge meta={data.meta} /></div>}
        </CardBody>
      </Card>

      {mutation.isPending && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      )}
      {mutation.isError && !mutation.isPending && (
        <ErrorState message={apiErrorMessage(mutation.error)} onRetry={() => run()} />
      )}
      {!mutation.isPending && !mutation.isError && !data && (
        <EmptyState title="Analyze content sentiment" hint="Enter a keyword or brand to see how the web talks about it." />
      )}

      {data && !mutation.isPending && (
        <div className="animate-fade-rise space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-muted">
              Based on <span className="font-mono text-text">{fmtInt(data.total_count)}</span> citations
            </p>
            <div className="flex items-center gap-2">
              <CacheBadge meta={data.meta} />
              <ExcelButton filename={`content-${data.keyword}`} build={buildExcel} />
              <SaveToProject
                module="content"
                params={{ keyword: data.keyword }}
                result={data as unknown as Record<string, unknown>}
              />
            </div>
          </div>

          {(() => {
            const s = data.sentiment;
            const total = (s.positive ?? 0) + (s.neutral ?? 0) + (s.negative ?? 0);
            const tone =
              total === 0
                ? "—"
                : (["positive", "neutral", "negative"] as const).reduce((a, b) =>
                    (s[b] ?? 0) > (s[a] ?? 0) ? b : a,
                  );
            const toneLabel = tone === "—" ? "—" : tone.charAt(0).toUpperCase() + tone.slice(1);
            return (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <MetricCard icon={Gauge} label="Overall tone" value={toneLabel} />
                <MetricCard icon={Smile} label="Positive" value={`${pct(s.positive, total)}%`} />
                <MetricCard icon={Meh} label="Neutral" value={`${pct(s.neutral, total)}%`} />
                <MetricCard icon={Frown} label="Negative" value={`${pct(s.negative, total)}%`} />
              </div>
            );
          })()}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Sentiment</CardTitle></CardHeader>
              <CardBody><SentimentDonut data={data} /></CardBody>
            </Card>
            <Card>
              <CardHeader><CardTitle>Emotional connotations</CardTitle></CardHeader>
              <CardBody><ConnotationBars data={data.connotations} /></CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Top citations</CardTitle></CardHeader>
            <CardBody className="space-y-3">
              {data.top_citations.length ? (
                data.top_citations.map((c, i) => (
                  <a
                    key={i}
                    href={c.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-md border border-border p-3 hover:bg-surface-2"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-text">
                      {c.title || c.url}
                      <ExternalLink size={12} className="text-text-muted" />
                    </div>
                    {c.domain && <p className="text-xs text-[color:var(--section)]">{c.domain}</p>}
                    {c.snippet && <p className="mt-1 line-clamp-2 text-sm text-text-muted">{c.snippet}</p>}
                  </a>
                ))
              ) : (
                <p className="text-sm text-text-muted">No citations returned.</p>
              )}
            </CardBody>
          </Card>

          {(sentimentMutation.isPending || sentimentData || trendsMutation.isPending || trendsData) && (
            <div className="grid gap-4 lg:grid-cols-2">
              {(sentimentMutation.isPending || sentimentData) && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle>How the web talks about it</CardTitle>
                      {!sentimentMutation.isPending && sentimentData && <CacheBadge meta={sentimentData.meta} />}
                    </div>
                  </CardHeader>
                  <CardBody>
                    {sentimentMutation.isPending ? (
                      <Skeleton className="h-48" />
                    ) : (
                      sentimentData && <BrandSentiment data={sentimentData} />
                    )}
                  </CardBody>
                </Card>
              )}
              {(trendsMutation.isPending || trendsData) && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle>Citations over 12 months</CardTitle>
                      {!trendsMutation.isPending && trendsData && <CacheBadge meta={trendsData.meta} />}
                    </div>
                  </CardHeader>
                  <CardBody>
                    {trendsMutation.isPending ? (
                      <Skeleton className="h-48" />
                    ) : (
                      trendsData && <CitationTrend data={trendsData} />
                    )}
                  </CardBody>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
