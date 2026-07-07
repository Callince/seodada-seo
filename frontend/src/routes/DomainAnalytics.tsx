import { Globe, Search, Swords } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { apiErrorMessage } from "@/api/client";
import { useDomainOverview, useRankedKeywords } from "@/api/hooks/useDomains";
import { useBacklinksSummary } from "@/api/hooks/useBacklinks";
import { AuthorityBadge } from "@/components/shared/AuthorityBadge";
import { CacheBadge } from "@/components/shared/CacheBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { LocationLanguagePicker } from "@/components/shared/LocationLanguagePicker";
import { SaveToProject } from "@/components/shared/SaveToProject";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtInt } from "@/lib/format";
import type {
  Meta,
  OverviewResponse,
  RankedKeywordRow,
  RankedKeywordsResponse,
} from "@/types";

// Competitors and keyword-gap analysis live on the dedicated /competitors page.
type TabKey = "overview" | "ranked";
const TAB_LABELS: Record<TabKey, string> = {
  overview: "Overview",
  ranked: "Ranked Keywords",
};
type Loc = { location_code: number; language_code: string };

const TAB_MODULES: Record<TabKey, string> = {
  overview: "domains.overview",
  ranked: "domains.ranked",
};

const dollars = (v: number | null | undefined) =>
  v == null ? "—" : `$${fmtInt(Math.round(v))}`;

const rankedCols: Column<RankedKeywordRow>[] = [
  { key: "keyword", header: "Keyword", sortValue: (r) => r.keyword },
  { key: "position", header: "Pos", align: "right", mono: true, sortValue: (r) => r.position },
  {
    key: "search_volume", header: "Volume", align: "right", mono: true,
    sortValue: (r) => r.search_volume, render: (r) => fmtInt(r.search_volume), csvValue: (r) => r.search_volume,
  },
  {
    key: "etv", header: "Traffic", align: "right", mono: true,
    sortValue: (r) => r.etv, render: (r) => (r.etv == null ? "—" : fmtInt(Math.round(r.etv))), csvValue: (r) => r.etv,
  },
  {
    key: "url", header: "URL", sortValue: (r) => r.url,
    render: (r) => (r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="text-text-muted hover:text-primary hover:underline">{r.url}</a> : "—"),
    csvValue: (r) => r.url,
  },
];

function OverviewPane({ data }: { data: OverviewResponse }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium text-text">Organic</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Organic keywords" value={fmtInt(data.organic.count)} accent />
          <StatCard label="Est. traffic" value={fmtInt(data.organic.etv == null ? null : Math.round(data.organic.etv))} />
          <StatCard label="Traffic value" value={dollars(data.organic.traffic_cost)} />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-text">Paid</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Paid keywords" value={fmtInt(data.paid.count)} />
          <StatCard label="Est. paid traffic" value={fmtInt(data.paid.etv == null ? null : Math.round(data.paid.etv))} />
          <StatCard label="Paid traffic cost" value={dollars(data.paid.traffic_cost)} />
        </div>
      </div>
    </div>
  );
}

export default function DomainAnalytics({ embedded }: { embedded?: boolean }) {
  const [target, setTarget] = useState("");
  const [loc, setLoc] = useState<Loc>({ location_code: 2840, language_code: "en" });
  const [tab, setTab] = useState<TabKey>("overview");
  const [submitted, setSubmitted] = useState("");
  const [results, setResults] = useState<Partial<Record<TabKey, unknown>>>({});
  const [pendingTab, setPendingTab] = useState<TabKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const auth = useBacklinksSummary();

  const muts = {
    overview: useDomainOverview(),
    ranked: useRankedKeywords(),
  };

  const load = async (t: TabKey, dom: string, l: Loc, force = false) => {
    if (!force && results[t]) return;
    setPendingTab(t);
    setError(null);
    try {
      const data = await muts[t].mutateAsync({ target: dom, ...l });
      setResults((r) => ({ ...r, [t]: data }));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setPendingTab(null);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const d = target.trim();
    if (!d) return;
    setSubmitted(d);
    setResults({});
    auth.mutate({ target: d });
    void load(tab, d, loc, true);
  };

  const changeTab = (t: TabKey) => {
    setTab(t);
    if (submitted) void load(t, submitted, loc);
  };

  const current = results[tab];
  const isPending = pendingTab === tab;
  const meta = (current as { meta?: Meta } | undefined)?.meta;

  return (
    <div>
      {!embedded && (
        <PageHeader title="Domain Analytics" subtitle="Organic footprint, domain authority, and every keyword the domain ranks for." />
      )}

      <Card className="mb-5">
        <CardBody>
          <form onSubmit={submit} className="flex flex-col gap-3 md:flex-row">
            <div className="relative lg:flex-1">
              <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="example.com" className="pl-9" />
            </div>
            <LocationLanguagePicker value={loc} onChange={setLoc} />
            <Button type="submit" disabled={isPending || !target.trim()}>
              <Search size={16} /> Analyze
            </Button>
          </form>
          <p className="mt-2.5 text-xs text-text-muted">
            Looking for competitor comparison or the keyword gap?{" "}
            <Link to="/competitors" className="inline-flex items-center gap-1 text-primary hover:underline">
              <Swords size={12} /> Competitor Analysis
            </Link>
          </p>
        </CardBody>
      </Card>

      {!submitted ? (
        <EmptyState title="Analyze a domain" hint="Enter a domain to see its authority, organic footprint, and ranked keywords." />
      ) : (
        <div className="animate-fade-rise space-y-4">
          {/* Domain Authority strip (Backlinks API) */}
          <Card className="bg-gradient-to-br from-primary-soft/40 to-surface">
            <CardBody className="flex flex-wrap items-center gap-6 py-4">
              {auth.isPending ? (
                <Skeleton className="h-20 w-20 rounded-full" />
              ) : (
                <div className="flex flex-col items-center">
                  <AuthorityBadge score={auth.data?.summary.authority ?? null} size={80} />
                  {auth.isError && (
                    <p className="mt-1 max-w-28 text-center text-[10px] leading-tight text-text-muted">
                      needs Backlinks subscription
                    </p>
                  )}
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">Backlinks</p>
                <p className="font-mono text-xl text-text">{auth.isPending ? "…" : fmtInt(auth.data?.summary.backlinks)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">Referring domains</p>
                <p className="font-mono text-xl text-text">{auth.isPending ? "…" : fmtInt(auth.data?.summary.referring_domains)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">Dofollow links</p>
                <p className="font-mono text-xl text-text">{auth.isPending ? "…" : fmtInt(auth.data?.summary.dofollow)}</p>
              </div>
            </CardBody>
          </Card>
          <div className="flex items-center justify-between">
            <Tabs value={tab} onChange={(v) => changeTab(v as TabKey)}>
              <TabsList>
                {(Object.keys(TAB_LABELS) as TabKey[]).map((t) => (
                  <TabsTrigger key={t} value={t}>{TAB_LABELS[t]}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-2">
              <CacheBadge meta={meta} />
              {!!current && (
                <SaveToProject
                  module={TAB_MODULES[tab]}
                  params={{ target: submitted, ...loc }}
                  result={current as Record<string, unknown>}
                />
              )}
            </div>
          </div>

          {isPending && <Skeleton className="h-72 w-full" />}
          {!isPending && error && <ErrorState message={error} onRetry={() => load(tab, submitted, loc, true)} />}
          {!isPending && !error && !!current && (
            <>
              {tab === "overview" && <OverviewPane data={current as OverviewResponse} />}
              {tab === "ranked" && (
                <DataTable columns={rankedCols} rows={(current as RankedKeywordsResponse).rows} csvName={`ranked-${submitted}`} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
