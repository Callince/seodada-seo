import { ExternalLink, Search } from "lucide-react";
import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { useContentAnalysis } from "@/api/hooks/useContent";
import { apiErrorMessage } from "@/api/client";
import { CacheBadge } from "@/components/shared/CacheBadge";
import { SaveToProject } from "@/components/shared/SaveToProject";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtInt } from "@/lib/format";
import type { Connotations, ContentResponse } from "@/types";

const SENTIMENT_COLORS = { positive: "#10B981", neutral: "#94A3B8", negative: "#F43F5E" };

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

export default function ContentAnalysis({ embedded }: { embedded?: boolean }) {
  const [keyword, setKeyword] = useState("");
  const mutation = useContentAnalysis();
  const data = mutation.data;

  const run = () => {
    const k = keyword.trim();
    if (k) mutation.mutate({ keyword: k });
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run();
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
          </form>
        </CardBody>
      </Card>

      {mutation.isPending && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      )}
      {mutation.isError && !mutation.isPending && (
        <ErrorState message={apiErrorMessage(mutation.error)} onRetry={run} />
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
            const toneLabel = tone === "—" ? "—" : `Mostly ${tone}`;
            return (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Overall tone" value={toneLabel} accent mono={false} />
                <StatCard label="Positive" value={`${pct(s.positive, total)}%`} />
                <StatCard label="Neutral" value={`${pct(s.neutral, total)}%`} />
                <StatCard label="Negative" value={`${pct(s.negative, total)}%`} />
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
                    {c.domain && <p className="text-xs text-primary">{c.domain}</p>}
                    {c.snippet && <p className="mt-1 line-clamp-2 text-sm text-text-muted">{c.snippet}</p>}
                  </a>
                ))
              ) : (
                <p className="text-sm text-text-muted">No citations returned.</p>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
