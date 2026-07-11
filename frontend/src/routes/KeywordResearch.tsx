import { BarChart3, DollarSign, Gauge, Layers, RefreshCw, Search } from "lucide-react";
import { useState, type ReactNode } from "react";

import { apiErrorMessage } from "@/api/client";
import {
  useIdeas,
  useKeywordOverview,
  useRelated,
  useSuggestions,
  useTrends,
  useVolume,
} from "@/api/hooks/useKeywords";
import { AreaChart, ScoreRing } from "@/components/public/landingKit";
import { CacheBadge } from "@/components/shared/CacheBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { KeywordTable } from "@/components/shared/KeywordTable";
import { LocationLanguagePicker } from "@/components/shared/LocationLanguagePicker";
import { MetricCard } from "@/components/shared/MetricCard";
import { usePersistedState } from "@/lib/persist";
import { SaveToProject } from "@/components/shared/SaveToProject";
import { TrendChart } from "@/components/shared/TrendChart";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";
import { fmtInt } from "@/lib/format";
import { PERIOD_PRESETS, periodRange, type PeriodKey } from "@/lib/period";
import type {
  KeywordListResponse,
  KeywordOverviewResponse,
  Meta,
  TrendsResponse,
  VolumeResponse,
  VolumeRow,
} from "@/types";

type TabKey = "overview" | "trends" | "longtail" | "related" | "ideas";
const TAB_LABELS: Record<TabKey, string> = {
  overview: "Overview",
  trends: "Trends",
  longtail: "Long-tail",
  related: "Related",
  ideas: "Ideas",
};
const TAB_MODULES: Record<TabKey, string> = {
  overview: "keywords.volume",
  trends: "keywords.trends",
  longtail: "keywords.suggestions",
  related: "keywords.related",
  ideas: "keywords.ideas",
};
type Loc = { location_code: number; language_code: string; force_live?: boolean };
type TrendsBundle = { trends: TrendsResponse; volume: VolumeResponse };

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardBody>
        <p className="mb-3 text-sm font-medium text-text">{title}</p>
        {children}
      </CardBody>
    </Card>
  );
}

function OverviewPane({ data }: { data: VolumeResponse }) {
  const row = data.rows[0];
  if (!row)
    return <EmptyState title="No volume data" hint="Google Ads returned no metrics for this keyword." />;
  return (
    <div className="space-y-5">
      <p className="text-sm text-text-muted">
        Primary keyword — <span className="font-medium text-text">{row.keyword}</span>
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard icon={BarChart3} label="Search volume" value={fmtInt(row.search_volume)} />
        <MetricCard icon={DollarSign} label="CPC" value={row.cpc == null ? "—" : `$${row.cpc.toFixed(2)}`} />
        <MetricCard
          icon={Gauge}
          label="Competition"
          value={row.competition == null ? "—" : `${row.competition}/100`}
        />
      </div>
      <p className="text-xs text-text-muted">
        Secondary &amp; long-tail keywords are in the <strong>Related</strong> and{" "}
        <strong>Long-tail</strong> tabs; competitor keyword ideas in <strong>Ideas</strong>.
      </p>
    </div>
  );
}

function monthlySorted(v: VolumeResponse) {
  const row = v.rows[0];
  if (!row) return [];
  return [...row.monthly_searches]
    .filter((m) => m.year && m.month)
    .sort((a, b) => a.year! - b.year! || a.month! - b.month!);
}

function TrendsPane({ data }: { data: TrendsBundle }) {
  const { trends, volume } = data;

  // 1) Google Trends — relative interest over time.
  const googleData = trends.graph.map((p) => {
    const r: Record<string, number | string | null> = { date: p.date ?? "" };
    trends.keywords.forEach((_, i) => (r[`s${i}`] = p.values[i] ?? null));
    return r;
  });
  const googleSeries = trends.keywords.map((k, i) => ({ key: `s${i}`, label: k }));

  // 2) Provider trend — absolute 12-month search volume.
  const monthly = monthlySorted(volume);
  const dfsData = monthly.map((m) => ({
    date: `${MONTHS[m.month!]} ${String(m.year).slice(2)}`,
    volume: m.volume,
  }));

  // 3) Seasonal trend — average volume per calendar month (peaks = seasonality).
  const acc: Record<number, { sum: number; n: number }> = {};
  monthly.forEach((m) => {
    if (m.month && m.volume != null) {
      const a = acc[m.month] ?? { sum: 0, n: 0 };
      a.sum += m.volume;
      a.n += 1;
      acc[m.month] = a;
    }
  });
  const seasonal = Array.from({ length: 12 }, (_, i) => {
    const mm = i + 1;
    const a = acc[mm];
    return { date: MONTHS[mm], volume: a ? Math.round(a.sum / a.n) : null };
  });
  const hasSeasonal = seasonal.some((s) => s.volume != null);

  return (
    <div className="space-y-5">
      {googleData.length > 0 ? (
        <ChartCard title="Google Trends — relative interest over time">
          <TrendChart data={googleData} series={googleSeries} height={300} />
        </ChartCard>
      ) : (
        <EmptyState title="No Google Trends series" hint="Google Trends returned no data for this query." />
      )}

      {dfsData.length > 0 && (
        <ChartCard title="Monthly search volume trend (last 12 months)">
          <TrendChart data={dfsData} series={[{ key: "volume", label: "Search volume" }]} />
        </ChartCard>
      )}

      {hasSeasonal && (
        <ChartCard title="Seasonal trend — average volume by month">
          <TrendChart
            data={seasonal}
            series={[{ key: "volume", label: "Avg monthly volume" }]}
            height={240}
          />
        </ChartCard>
      )}
    </div>
  );
}

function PeriodBar({
  period,
  onChange,
  customFrom,
  customTo,
  setCustomFrom,
  setCustomTo,
  onApplyCustom,
}: {
  period: PeriodKey;
  onChange: (p: PeriodKey) => void;
  customFrom: string;
  customTo: string;
  setCustomFrom: (v: string) => void;
  setCustomTo: (v: string) => void;
  onApplyCustom: () => void;
}) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {PERIOD_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => onChange(p.key)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                period === p.key
                  ? "section-gradient text-white"
                  : "bg-surface-2 text-text-muted hover:text-text",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="w-[9.5rem]"
            aria-label="From date"
          />
          <span className="text-text-muted">→</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="w-[9.5rem]"
            aria-label="To date"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={onApplyCustom}
            disabled={!customFrom || !customTo}
          >
            Apply
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

const bulkCols: Column<VolumeRow>[] = [
  { key: "keyword", header: "Keyword", sortValue: (r) => r.keyword, render: (r) => <span className="font-medium text-text">{r.keyword}</span> },
  { key: "search_volume", header: "Volume", align: "right", mono: true, sortValue: (r) => r.search_volume ?? -1, render: (r) => (r.search_volume == null ? "—" : r.search_volume.toLocaleString()) },
  { key: "cpc", header: "CPC", align: "right", mono: true, sortValue: (r) => r.cpc ?? -1, render: (r) => (r.cpc == null ? "—" : `$${r.cpc.toFixed(2)}`) },
  { key: "competition", header: "Competition", align: "right", mono: true, sortValue: (r) => r.competition ?? -1, render: (r) => (r.competition == null ? "—" : `${r.competition}/100`) },
];

/** Paste up to 100 keywords; one call returns volume/CPC/competition for all. */
function BulkPane({ loc }: { loc: { location_code: number; language_code: string } }) {
  const [raw, setRaw] = useState("");
  const volume = useVolume();
  const keywords = [...new Set(raw.split(/[\n,]+/).map((k) => k.trim().toLowerCase()).filter(Boolean))].slice(0, 100);

  const run = () => {
    if (keywords.length) volume.mutate({ keywords, ...loc });
  };

  return (
    <Card className="mt-6">
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-text">
            <Layers size={16} className="text-[color:var(--section)]" /> Bulk keyword analysis
          </h3>
          {volume.data && <CacheBadge meta={volume.data.meta} />}
        </div>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={4}
          placeholder={"One keyword per line (or comma-separated) — up to 100.\nrunning shoes\nbest trail runners\nmarathon training plan"}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--section)]"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-text-muted">{keywords.length} unique keyword{keywords.length === 1 ? "" : "s"} ready (max 100)</p>
          <Button size="sm" onClick={run} loading={volume.isPending} disabled={keywords.length === 0}>
            {!volume.isPending && <Search size={14} />} Get volumes
          </Button>
        </div>
        {volume.isError && <p className="text-sm text-danger">{apiErrorMessage(volume.error)}</p>}
        {volume.data && !volume.isPending && (
          <DataTable columns={bulkCols} rows={volume.data.rows} csvName="bulk-keywords" />
        )}
      </CardBody>
    </Card>
  );
}

/** Non-blocking enrichment strip: difficulty ring, intent, core stats and a 12-month trend. */
function OverviewStrip({
  data,
  loading,
}: {
  data: KeywordOverviewResponse | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardBody className="flex items-center gap-5">
          <Skeleton className="h-20 w-20 shrink-0 rounded-full" />
          <Skeleton className="h-14 flex-1" />
        </CardBody>
      </Card>
    );
  }
  if (!data) return null;

  const o = data.overview;
  const trend = [...o.monthly_searches]
    .filter((m) => m.year != null && m.month != null && m.volume != null)
    .sort((a, b) => a.year! - b.year! || a.month! - b.month!)
    .map((m) => m.volume!);
  const d = o.difficulty;
  const ringTone = d == null || d > 60 ? "blue" : d <= 30 ? "emerald" : "amber";

  // The Labs "keyword overview" source can return an empty record (no
  // difficulty/intent/volume) even on a 200 — don't render a bare "— — —"
  // card; the Overview tab already covers volume/CPC/competition.
  const hasData =
    d != null ||
    !!o.intent ||
    o.search_volume != null ||
    o.cpc != null ||
    o.competition != null ||
    trend.length > 1;
  if (!hasData) return null;

  return (
    <Card>
      <CardBody>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-text">Keyword overview</p>
          <CacheBadge meta={data.meta} />
        </div>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          {d != null && <ScoreRing value={d} size={84} label="difficulty" tone={ringTone} />}
          {o.intent && (
            <span className="rounded-full bg-[color:var(--section-soft)] px-3 py-1 text-xs font-medium capitalize text-[color:var(--section)]">
              {o.intent}
            </span>
          )}
          <div>
            <p className="text-xs text-text-muted">Volume</p>
            <p className="font-mono text-lg font-semibold text-text">{fmtInt(o.search_volume)}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">CPC</p>
            <p className="font-mono text-lg font-semibold text-text">
              {o.cpc == null ? "—" : `$${o.cpc.toFixed(2)}`}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Competition</p>
            <p className="font-mono text-lg font-semibold text-text">
              {o.competition == null ? "—" : `${Math.round(o.competition * 100)}%`}
            </p>
          </div>
          {trend.length > 1 && (
            <div className="min-w-[10rem] max-w-xs flex-1">
              <p className="mb-1 text-xs text-text-muted">12-month trend</p>
              <div className="h-12">
                <AreaChart values={trend} height={48} id="kw-overview" tone="blue" />
              </div>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

export default function KeywordResearch({ embedded }: { embedded?: boolean }) {
  // Persisted so the seed, tab and loaded results survive navigating away and back.
  const [seed, setSeed] = usePersistedState("keywords.seed", "");
  const [loc, setLoc] = usePersistedState<Loc>("keywords.loc", { location_code: 2840, language_code: "en" });
  const [tab, setTab] = usePersistedState<TabKey>("keywords.tab", "overview");
  const [submitted, setSubmitted] = usePersistedState("keywords.submitted", "");
  const [results, setResults] = usePersistedState<Partial<Record<TabKey, unknown>>>("keywords.results", {});
  const [pendingTab, setPendingTab] = useState<TabKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = usePersistedState<PeriodKey>("keywords.period", "this_year");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Overview enrichment persists alongside the tab results.
  const [overviewData, setOverviewData] = usePersistedState<KeywordOverviewResponse | null>(
    "keywords.overview",
    null,
  );

  const volume = useVolume();
  const trends = useTrends();
  const volForTrends = useVolume();
  const suggestions = useSuggestions();
  const related = useRelated();
  const ideas = useIdeas();
  const kwOverview = useKeywordOverview();

  // Non-blocking enrichment: failures render nothing rather than breaking the flow.
  const loadOverview = (s: string, l: Loc) => {
    kwOverview.mutate(
      { keyword: s, ...l },
      {
        onSuccess: (d) => setOverviewData(d),
        onError: () => setOverviewData(null),
      },
    );
  };

  const load = async (
    t: TabKey,
    s: string,
    l: Loc,
    force = false,
    pk: PeriodKey = period,
    cf = customFrom,
    ct = customTo,
  ) => {
    if (!force && results[t]) return;
    setPendingTab(t);
    setError(null);
    try {
      let data: unknown;
      if (t === "trends") {
        const { date_from, date_to } = periodRange(pk, cf, ct);
        const [tr, vol] = await Promise.all([
          trends.mutateAsync({
            keywords: [s],
            date_from: date_from || undefined,
            date_to: date_to || undefined,
            ...l,
          }),
          volForTrends.mutateAsync({ keywords: [s], ...l }),
        ]);
        data = { trends: tr, volume: vol } as TrendsBundle;
      } else if (t === "overview") {
        data = await volume.mutateAsync({ keywords: [s], ...l });
      } else if (t === "ideas") {
        data = await ideas.mutateAsync({ keywords: [s], ...l });
      } else if (t === "longtail") {
        data = await suggestions.mutateAsync({ seed: s, ...l });
      } else {
        data = await related.mutateAsync({ seed: s, ...l });
      }
      setResults((r) => ({ ...r, [t]: data }));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setPendingTab(null);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = seed.trim();
    if (!s) return;
    setSubmitted(s);
    setResults({});
    loadOverview(s, loc);
    void load(tab, s, loc, true);
  };

  const changeTab = (t: TabKey) => {
    setTab(t);
    if (submitted) void load(t, submitted, loc);
  };

  const changePeriod = (pk: PeriodKey) => {
    setPeriod(pk);
    if (pk !== "custom" && submitted) void load("trends", submitted, loc, true, pk);
  };

  const applyCustom = () => {
    setPeriod("custom");
    if (submitted && customFrom && customTo)
      void load("trends", submitted, loc, true, "custom", customFrom, customTo);
  };

  const current = results[tab];
  const isPending = pendingTab === tab;
  const meta =
    tab === "trends"
      ? (current as TrendsBundle | undefined)?.trends?.meta
      : (current as { meta?: Meta } | undefined)?.meta;

  const saveParams =
    tab === "longtail" || tab === "related"
      ? { seed: submitted, ...loc }
      : { keywords: [submitted], ...loc };
  const saveResult =
    tab === "trends" ? (current as TrendsBundle | undefined)?.trends : current;

  return (
    <div>
      {!embedded && (
        <PageHeader
          title="Keyword Research"
          subtitle="Primary & secondary keywords, Google & seasonal trends, long-tail and competitor ideas. (People Also Ask lives on the SERP page.)"
        />
      )}

      <Card className="mb-5">
        <CardBody>
          <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="Seed keyword, e.g. running shoes"
              className="sm:flex-1"
            />
            <LocationLanguagePicker value={loc} onChange={setLoc} />
            <Button type="submit" disabled={isPending || !seed.trim()}>
              <Search size={16} /> Research
            </Button>
            {submitted && (
              <Button type="button" variant="secondary" title="Bypass the cache and fetch live"
                disabled={isPending}
                onClick={() => {
                  loadOverview(submitted, { ...loc, force_live: true });
                  void load(tab, submitted, { ...loc, force_live: true }, true);
                }}>
                <RefreshCw size={15} className={isPending ? "animate-spin" : ""} /> Refresh
              </Button>
            )}
          </form>
        </CardBody>
      </Card>

      {!submitted ? (
        <EmptyState
          title="Research a keyword"
          hint="Enter a seed keyword to explore volume, trends, and expansion ideas."
        />
      ) : (
        <div className="animate-fade-rise space-y-4">
          <OverviewStrip data={overviewData} loading={kwOverview.isPending} />
          <div className="flex items-center justify-between">
            <Tabs value={tab} onChange={(v) => changeTab(v as TabKey)}>
              <TabsList>
                {(Object.keys(TAB_LABELS) as TabKey[]).map((t) => (
                  <TabsTrigger key={t} value={t}>
                    {TAB_LABELS[t]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-2">
              <CacheBadge meta={meta} />
              {!!saveResult && (
                <SaveToProject
                  module={TAB_MODULES[tab]}
                  params={saveParams}
                  result={saveResult as Record<string, unknown>}
                />
              )}
            </div>
          </div>

          {tab === "trends" && (
            <PeriodBar
              period={period}
              onChange={changePeriod}
              customFrom={customFrom}
              customTo={customTo}
              setCustomFrom={setCustomFrom}
              setCustomTo={setCustomTo}
              onApplyCustom={applyCustom}
            />
          )}

          {isPending && <Skeleton className="h-72 w-full" />}
          {!isPending && error && (
            <ErrorState message={error} onRetry={() => load(tab, submitted, loc, true)} />
          )}
          {!isPending && !error && !!current && (
            <>
              {tab === "overview" && <OverviewPane data={current as VolumeResponse} />}
              {tab === "trends" && <TrendsPane data={current as TrendsBundle} />}
              {(tab === "longtail" || tab === "related" || tab === "ideas") && (
                <KeywordTable
                  rows={(current as KeywordListResponse).rows}
                  csvName={`${tab}-${submitted}`}
                />
              )}
            </>
          )}
        </div>
      )}
      <BulkPane loc={loc} />
    </div>
  );
}
