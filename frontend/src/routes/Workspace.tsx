import { Info, Rocket } from "lucide-react";
import { useState, type ReactNode } from "react";

import { apiErrorMessage } from "@/api/client";
import { useContentAnalysis } from "@/api/hooks/useContent";
import { useTrends, useVolume } from "@/api/hooks/useKeywords";
import { useSiteReport } from "@/api/hooks/useReport";
import { useSerpRanking } from "@/api/hooks/useSerp";
import { AiAdvisor } from "@/components/shared/AiAdvisor";
import { CacheBadge } from "@/components/shared/CacheBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { LocationLanguagePicker } from "@/components/shared/LocationLanguagePicker";
import { PAAList } from "@/components/shared/PAAList";
import { ScoreGauge } from "@/components/shared/ScoreGauge";
import { StatCard } from "@/components/shared/StatCard";
import { TrendChart } from "@/components/shared/TrendChart";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtInt } from "@/lib/format";
import type {
  CompetitorRow,
  PageReport,
  RankedKeywordRow,
  SerpResult,
} from "@/types";

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const serpCols: Column<SerpResult>[] = [
  { key: "position", header: "#", align: "right", mono: true, sortValue: (r) => r.position },
  {
    key: "title", header: "Title", sortValue: (r) => r.title,
    render: (r) => (
      <a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-text hover:text-primary hover:underline">
        {r.title || r.url}
      </a>
    ),
  },
  { key: "brand_name", header: "Brand", sortValue: (r) => r.brand_name },
  { key: "brand_volume", header: "Brand vol", align: "right", mono: true, sortValue: (r) => r.brand_volume ?? 0, render: (r) => fmtInt(r.brand_volume), csvValue: (r) => r.brand_volume },
];

const pageCols: Column<PageReport>[] = [
  {
    key: "url", header: "Page", sortValue: (r) => r.url,
    render: (r) => (
      <a href={r.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
        {(() => { try { return new URL(r.url).pathname || r.url; } catch { return r.url; } })()}
      </a>
    ),
  },
  { key: "content_score", header: "Score", align: "right", mono: true, sortValue: (r) => r.content_score ?? -1, render: (r) => (r.content_score == null ? "—" : `${r.content_score}`) },
  { key: "word_count", header: "Words", align: "right", mono: true, sortValue: (r) => r.word_count ?? 0, render: (r) => fmtInt(r.word_count) },
  { key: "recommendation", header: "Top fix", render: (r) => <span className="text-text-muted">{r.recommendation ?? "—"}</span> },
];

const rkCols: Column<RankedKeywordRow>[] = [
  { key: "keyword", header: "Keyword", sortValue: (r) => r.keyword },
  { key: "position", header: "Pos", align: "right", mono: true, sortValue: (r) => r.position ?? 999, render: (r) => (r.position == null ? "—" : `#${r.position}`) },
  { key: "search_volume", header: "Volume", align: "right", mono: true, sortValue: (r) => r.search_volume ?? 0, render: (r) => fmtInt(r.search_volume), csvValue: (r) => r.search_volume },
  { key: "etv", header: "ETV", align: "right", mono: true, sortValue: (r) => r.etv ?? 0, render: (r) => (r.etv == null ? "—" : r.etv.toFixed(0)), csvValue: (r) => r.etv },
];

const compCols: Column<CompetitorRow>[] = [
  { key: "domain", header: "Competitor", sortValue: (r) => r.domain },
  { key: "common_keywords", header: "Shared kw", align: "right", mono: true, sortValue: (r) => r.common_keywords ?? 0, render: (r) => fmtInt(r.common_keywords), csvValue: (r) => r.common_keywords },
  { key: "etv", header: "ETV", align: "right", mono: true, sortValue: (r) => r.etv ?? 0, render: (r) => (r.etv == null ? "—" : r.etv.toFixed(0)), csvValue: (r) => r.etv },
];

function Section({
  title, pending, error, empty, noPad, children, meta,
}: {
  title: string;
  pending: boolean;
  error?: string | null;
  empty?: boolean;
  noPad?: boolean;
  children: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{title}</CardTitle>
          {meta}
        </div>
      </CardHeader>
      <CardBody className={noPad && !pending && !error ? "p-0" : undefined}>
        {pending ? (
          <Skeleton className="h-40 w-full" />
        ) : error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : empty ? (
          <p className="text-sm text-text-muted">No data returned.</p>
        ) : (
          children
        )}
      </CardBody>
    </Card>
  );
}

export default function Workspace() {
  const [keyword, setKeyword] = useState("");
  const [domain, setDomain] = useState("");
  const [loc, setLoc] = useState({ location_code: 2840, language_code: "en" });
  const [started, setStarted] = useState(false);

  const report = useSiteReport();
  const serp = useSerpRanking();
  const volume = useVolume();
  const trends = useTrends();
  const content = useContentAnalysis();

  const run = () => {
    const k = keyword.trim();
    const d = domain.trim();
    if (!k || !d) return;
    setStarted(true);
    report.mutate({ ...loc, domain: d, keyword: k });
    serp.mutate({ ...loc, keyword: k });
    volume.mutate({ ...loc, keywords: [k] });
    trends.mutate({ ...loc, keywords: [k] });
    content.mutate({ keyword: k });
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run();
  };

  const reportError = report.isError ? apiErrorMessage(report.error) : null;
  const serpError = serp.isError ? apiErrorMessage(serp.error) : null;
  const volumeError = volume.isError ? apiErrorMessage(volume.error) : null;
  const trendsError = trends.isError ? apiErrorMessage(trends.error) : null;
  const contentError = content.isError ? apiErrorMessage(content.error) : null;

  const rep = report.data;
  const vol = volume.data?.rows[0];
  const monthly = vol
    ? [...vol.monthly_searches]
        .filter((m) => m.year && m.month)
        .sort((a, b) => a.year! - b.year! || a.month! - b.month!)
        .map((m) => ({ date: `${MONTHS[m.month!]} ${String(m.year).slice(2)}`, volume: m.volume }))
    : [];
  const sent = content.data?.sentiment;
  const sentTotal = sent ? (sent.positive ?? 0) + (sent.neutral ?? 0) + (sent.negative ?? 0) : 0;
  const sPct = (v: number | null) => (sentTotal > 0 ? Math.round(((v ?? 0) / sentTotal) * 100) : 0);

  // Compact analysis context for the AI advisor.
  const aiContext: Record<string, unknown> = {
    keyword: keyword.trim(),
    domain: domain.trim(),
    health_score: rep?.health_score ?? null,
    organic_keywords: rep?.overview.organic.count ?? null,
    ranking: rep?.ranking ?? null,
    findings: rep?.findings ?? [],
    automated_recommendations: rep?.recommendations ?? [],
    top_pages: (rep?.pages ?? []).slice(0, 6).map((p) => ({
      url: p.url, score: p.content_score, words: p.word_count, top_fix: p.recommendation,
    })),
    competitors: (rep?.competitors ?? []).slice(0, 6).map((c) => c.domain),
    top_ranked_keywords: (rep?.top_keywords ?? []).slice(0, 10).map((k) => ({
      keyword: k.keyword, position: k.position, volume: k.search_volume,
    })),
    serp_top: (serp.data?.results ?? []).slice(0, 5).map((r) => ({ position: r.position, domain: r.domain })),
    keyword_volume: vol?.search_volume ?? null,
    content_sentiment: content.data?.sentiment ?? null,
  };

  return (
    <div>
      <PageHeader
        title="All-in-One Analysis"
        subtitle="Enter a keyword and a domain, then run every tool at once — everything on one page."
        icon={Rocket}
      />

      <Card className="mb-5">
        <CardBody>
          <form onSubmit={submit} className="flex flex-col gap-3 md:flex-row">
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Keyword — e.g. running shoes" className="md:flex-1" />
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="Domain — e.g. nike.com" className="md:flex-1" />
            <LocationLanguagePicker value={loc} onChange={setLoc} />
            <Button type="submit" loading={report.isPending || serp.isPending} disabled={!keyword.trim() || !domain.trim()}>
              {!(report.isPending || serp.isPending) && <Rocket size={16} />}
              Run full analysis
            </Button>
          </form>
          <p className="mt-2.5 flex items-center gap-1.5 text-xs text-text-muted">
            <Info size={13} className="shrink-0" />
            Runs every tool at once — SERP, keywords, trends, content, on-page, competitors, and rankings.
            Repeat runs for the same keyword + domain are served instantly from cache.
          </p>
        </CardBody>
      </Card>

      {!started ? (
        <EmptyState
          title="Run a complete analysis"
          hint="One keyword + one domain runs SERP, keywords, trends, content sentiment, on-page scores, competitors, and rankings — all below."
        />
      ) : (
        <div className="animate-fade-rise space-y-4">
          {/* Bento hero — gauge anchors a 6-col mosaic of audit metrics */}
          {report.isPending ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
              <Skeleton className="col-span-2 row-span-2 h-full min-h-48" />
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 lg:col-span-2" />)}
            </div>
          ) : rep ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
              <Card className="col-span-2 row-span-2 bg-gradient-to-br from-primary-soft/70 to-surface transition-shadow hover:shadow-md">
                <CardBody className="flex h-full items-center justify-center py-6">
                  <ScoreGauge
                    score={rep.health_score}
                    label="site health"
                    size={190}
                    emptyHint={rep.pages.length === 0 ? "site blocked crawling" : undefined}
                  />
                </CardBody>
              </Card>
              <StatCard className="lg:col-span-2" label="Organic keywords" value={fmtInt(rep.overview.organic.count)} accent />
              <StatCard
                className="lg:col-span-2"
                label="Est. traffic value"
                value={rep.overview.organic.traffic_cost == null ? "—" : `$${(rep.overview.organic.traffic_cost / 100).toFixed(0)}`}
              />
              <StatCard
                className="lg:col-span-2"
                label={`Rank · ${keyword.trim()}`}
                value={rep.ranking ? (rep.ranking.found ? `#${rep.ranking.position}` : "Not found") : "—"}
                accent
              />
              <StatCard className="lg:col-span-2" label="Pages analyzed" value={String(rep.pages.length)} />
            </div>
          ) : null}

          {/* Advisor dominates; findings + recommendations stack beside it */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
            <div className={report.isPending || rep ? "lg:col-span-4" : "lg:col-span-6"}>
              <AiAdvisor context={aiContext} ready={!!(rep || serp.data)} />
            </div>
            {(report.isPending || rep) && (
              <div className="flex flex-col gap-4 lg:col-span-2">
                <Section title="Key findings" pending={report.isPending} error={reportError} empty={!!rep && rep.findings.length === 0}>
                  <ul className="space-y-1.5 text-sm text-text">
                    {rep?.findings.map((f, i) => (
                      <li key={i} className="flex gap-2"><span className="text-primary">•</span><span>{f}</span></li>
                    ))}
                  </ul>
                </Section>
                <Section title="Recommendations" pending={report.isPending} error={reportError} empty={!!rep && rep.recommendations.length === 0}>
                  <ul className="space-y-1.5 text-sm text-text">
                    {rep?.recommendations.map((r, i) => (
                      <li key={i} className="flex gap-2"><span className="text-primary">→</span><span>{r}</span></li>
                    ))}
                  </ul>
                </Section>
              </div>
            )}
          </div>

          {/* SERP */}
          <Section
            title={`SERP results · ${keyword.trim()}`}
            pending={serp.isPending}
            error={serpError}
            empty={!!serp.data && serp.data.results.length === 0}
            noPad
            meta={serp.data && <CacheBadge meta={serp.data.meta} />}
          >
            <DataTable columns={serpCols} rows={serp.data?.results ?? []} csvName={`serp-${keyword.trim()}`} />
            {serp.data && serp.data.paa.length > 0 && (
              <div className="border-t border-border p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">People Also Ask</p>
                <PAAList items={serp.data.paa} />
              </div>
            )}
          </Section>

          {/* Keyword metrics + trend */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Keyword metrics" pending={volume.isPending} error={volumeError} empty={!vol}>
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Volume" value={fmtInt(vol?.search_volume)} accent />
                <StatCard label="CPC" value={vol?.cpc == null ? "—" : `$${vol.cpc.toFixed(2)}`} />
                <StatCard label="Competition" value={vol?.competition == null ? "—" : `${vol.competition}/100`} />
              </div>
              {monthly.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">12-month search volume</p>
                  <TrendChart data={monthly} series={[{ key: "volume", label: "Search volume" }]} height={200} />
                </div>
              )}
            </Section>

            <Section title="Content sentiment" pending={content.isPending} error={contentError} empty={!content.data}>
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Positive" value={`${sPct(sent?.positive ?? 0)}%`} />
                <StatCard label="Neutral" value={`${sPct(sent?.neutral ?? 0)}%`} />
                <StatCard label="Negative" value={`${sPct(sent?.negative ?? 0)}%`} />
              </div>
              <p className="mt-3 text-xs text-text-muted">
                Based on {fmtInt(content.data?.total_count)} citations across the SERP for “{keyword.trim()}”.
              </p>
            </Section>
          </div>

          {/* Google Trends */}
          <Section
            title="Search interest over time"
            pending={trends.isPending}
            error={trendsError}
            empty={!!trends.data && trends.data.graph.length === 0}
          >
            {trends.data && trends.data.graph.length > 0 && (
              <TrendChart
                data={trends.data.graph.map((p) => {
                  const row: Record<string, number | string | null> = { date: p.date ?? "" };
                  trends.data!.keywords.forEach((_, i) => (row[`s${i}`] = p.values[i] ?? null));
                  return row;
                })}
                series={trends.data.keywords.map((k, i) => ({ key: `s${i}`, label: k }))}
                height={260}
              />
            )}
          </Section>

          {/* Top pages (on-page scores) */}
          <Section title="Top pages — On-Page scores" pending={report.isPending} error={reportError} empty={!!rep && rep.pages.length === 0} noPad>
            <DataTable columns={pageCols} rows={rep?.pages ?? []} csvName={`pages-${domain.trim()}`} />
          </Section>

          {/* Ranked keywords + competitors */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Top ranked keywords" pending={report.isPending} error={reportError} empty={!!rep && rep.top_keywords.length === 0} noPad>
              <DataTable columns={rkCols} rows={rep?.top_keywords ?? []} csvName={`keywords-${domain.trim()}`} />
            </Section>
            <Section title="Competitors" pending={report.isPending} error={reportError} empty={!!rep && rep.competitors.length === 0} noPad>
              <DataTable columns={compCols} rows={rep?.competitors ?? []} csvName={`competitors-${domain.trim()}`} />
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}
