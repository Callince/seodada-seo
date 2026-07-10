import { ExternalLink, Link2, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { apiErrorMessage } from "@/api/client";
import {
  useBacklinkAnchors,
  useBacklinkCompetitors,
  useBacklinksHistory,
  useBacklinksList,
  useBacklinksNewLost,
  useBacklinksSummary,
  useReferringDomains,
  useSpamScore,
} from "@/api/hooks/useBacklinks";
import { AreaChart, type Tone } from "@/components/public/landingKit";
import { AuthorityBadge } from "@/components/shared/AuthorityBadge";
import { CacheBadge } from "@/components/shared/CacheBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { SaveToProject } from "@/components/shared/SaveToProject";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtInt } from "@/lib/format";
import { usePersistedState } from "@/lib/persist";
import type {
  AnchorRow,
  AnchorsResponse,
  BacklinkHistoryPoint,
  BacklinkHistoryResponse,
  BacklinkRow,
  BacklinksListResponse,
  BLCompetitorRow,
  BLCompetitorsResponse,
  Meta,
  NewLostPoint,
  NewLostResponse,
  ReferringDomainRow,
  ReferringDomainsResponse,
} from "@/types";

type TabKey = "backlinks" | "referring" | "anchors" | "history" | "newlost" | "blcompetitors";
const TAB_LABELS: Record<TabKey, string> = {
  backlinks: "Backlinks",
  referring: "Referring domains",
  anchors: "Anchors",
  history: "History",
  newlost: "New / Lost",
  blcompetitors: "Similar profiles",
};

const shortDate = (s: string | null | undefined) => (s ? s.slice(0, 10) : "—");
/** DataForSEO domain/page rank is 0-1000 — show the familiar 0-100 DR scale. */
const dr = (rank: number | null | undefined) => (rank == null ? "—" : String(Math.round(rank / 10)));

function FollowBadge({ dofollow }: { dofollow: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        dofollow ? "bg-success/15 text-success" : "bg-surface-2 text-text-muted"
      }`}
    >
      {dofollow ? "dofollow" : "nofollow"}
    </span>
  );
}

const backlinkCols: Column<BacklinkRow>[] = [
  {
    key: "domain_from",
    header: "Referring page",
    sortValue: (r) => r.domain_from,
    render: (r) =>
      r.url_from ? (
        <a
          href={r.url_from}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-text hover:text-primary hover:underline"
        >
          {r.domain_from || r.url_from} <ExternalLink size={12} className="shrink-0 opacity-60" />
        </a>
      ) : (
        (r.domain_from ?? "—")
      ),
    csvValue: (r) => r.url_from,
  },
  { key: "anchor", header: "Anchor", sortValue: (r) => r.anchor, render: (r) => r.anchor || "—" },
  {
    key: "dofollow",
    header: "Type",
    render: (r) => <FollowBadge dofollow={r.dofollow} />,
    sortValue: (r) => (r.dofollow ? 1 : 0),
    csvValue: (r) => (r.dofollow ? "dofollow" : "nofollow"),
  },
  {
    key: "domain_from_rank",
    header: "DR",
    align: "right",
    mono: true,
    sortValue: (r) => r.domain_from_rank,
    render: (r) => dr(r.domain_from_rank),
    csvValue: (r) => r.domain_from_rank,
  },
  {
    key: "url_to",
    header: "Links to",
    sortValue: (r) => r.url_to,
    render: (r) =>
      r.url_to ? (
        <a href={r.url_to} target="_blank" rel="noreferrer" className="text-text-muted hover:text-primary hover:underline">
          {r.url_to}
        </a>
      ) : (
        "—"
      ),
    csvValue: (r) => r.url_to,
  },
  { key: "first_seen", header: "First seen", align: "right", mono: true, sortValue: (r) => r.first_seen, render: (r) => shortDate(r.first_seen), csvValue: (r) => r.first_seen },
];

const referringCols: Column<ReferringDomainRow>[] = [
  {
    key: "domain",
    header: "Domain",
    sortValue: (r) => r.domain,
    render: (r) =>
      r.domain ? (
        <a
          href={`https://${r.domain}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-text hover:text-primary hover:underline"
        >
          {r.domain} <ExternalLink size={12} className="shrink-0 opacity-60" />
        </a>
      ) : (
        "—"
      ),
    csvValue: (r) => r.domain,
  },
  { key: "authority", header: "Authority", align: "right", mono: true, sortValue: (r) => r.authority, render: (r) => (r.authority == null ? "—" : String(r.authority)), csvValue: (r) => r.authority },
  { key: "backlinks", header: "Backlinks", align: "right", mono: true, sortValue: (r) => r.backlinks, render: (r) => fmtInt(r.backlinks), csvValue: (r) => r.backlinks },
  { key: "referring_pages", header: "Ref. pages", align: "right", mono: true, sortValue: (r) => r.referring_pages, render: (r) => fmtInt(r.referring_pages), csvValue: (r) => r.referring_pages },
  { key: "first_seen", header: "First seen", align: "right", mono: true, sortValue: (r) => r.first_seen, render: (r) => shortDate(r.first_seen), csvValue: (r) => r.first_seen },
];

const anchorCols: Column<AnchorRow>[] = [
  { key: "anchor", header: "Anchor text", sortValue: (r) => r.anchor, render: (r) => r.anchor || "—" },
  { key: "backlinks", header: "Backlinks", align: "right", mono: true, sortValue: (r) => r.backlinks, render: (r) => fmtInt(r.backlinks), csvValue: (r) => r.backlinks },
  { key: "referring_domains", header: "Ref. domains", align: "right", mono: true, sortValue: (r) => r.referring_domains, render: (r) => fmtInt(r.referring_domains), csvValue: (r) => r.referring_domains },
  { key: "dofollow", header: "Type", render: (r) => <FollowBadge dofollow={r.dofollow} />, sortValue: (r) => (r.dofollow ? 1 : 0), csvValue: (r) => (r.dofollow ? "dofollow" : "nofollow") },
];

const historyCols: Column<BacklinkHistoryPoint>[] = [
  { key: "date", header: "Date", mono: true, sortValue: (r) => r.date, render: (r) => shortDate(r.date), csvValue: (r) => r.date },
  { key: "authority", header: "Authority", align: "right", mono: true, sortValue: (r) => r.authority, render: (r) => (r.authority == null ? "—" : String(r.authority)), csvValue: (r) => r.authority },
  { key: "backlinks", header: "Backlinks", align: "right", mono: true, sortValue: (r) => r.backlinks, render: (r) => fmtInt(r.backlinks), csvValue: (r) => r.backlinks },
  { key: "referring_domains", header: "Ref. domains", align: "right", mono: true, sortValue: (r) => r.referring_domains, render: (r) => fmtInt(r.referring_domains), csvValue: (r) => r.referring_domains },
];

const newLostCols: Column<NewLostPoint>[] = [
  { key: "date", header: "Date", mono: true, sortValue: (r) => r.date, render: (r) => shortDate(r.date), csvValue: (r) => r.date },
  { key: "new_backlinks", header: "New links", align: "right", mono: true, sortValue: (r) => r.new_backlinks, render: (r) => fmtInt(r.new_backlinks), csvValue: (r) => r.new_backlinks },
  { key: "lost_backlinks", header: "Lost links", align: "right", mono: true, sortValue: (r) => r.lost_backlinks, render: (r) => fmtInt(r.lost_backlinks), csvValue: (r) => r.lost_backlinks },
  { key: "new_referring_domains", header: "New domains", align: "right", mono: true, sortValue: (r) => r.new_referring_domains, render: (r) => fmtInt(r.new_referring_domains), csvValue: (r) => r.new_referring_domains },
  { key: "lost_referring_domains", header: "Lost domains", align: "right", mono: true, sortValue: (r) => r.lost_referring_domains, render: (r) => fmtInt(r.lost_referring_domains), csvValue: (r) => r.lost_referring_domains },
];

const blCompetitorCols: Column<BLCompetitorRow>[] = [
  {
    key: "domain",
    header: "Domain",
    sortValue: (r) => r.domain,
    render: (r) =>
      r.domain ? (
        <a
          href={`https://${r.domain}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-text hover:text-primary hover:underline"
        >
          {r.domain} <ExternalLink size={12} className="shrink-0 opacity-60" />
        </a>
      ) : (
        "—"
      ),
    csvValue: (r) => r.domain,
  },
  { key: "rank", header: "Rank", align: "right", mono: true, sortValue: (r) => r.rank, render: (r) => (r.rank == null ? "—" : String(r.rank)), csvValue: (r) => r.rank },
  { key: "intersections", header: "Shared referring domains", align: "right", mono: true, sortValue: (r) => r.intersections, render: (r) => fmtInt(r.intersections), csvValue: (r) => r.intersections },
];

/** Labelled mini area chart in a bordered card, with first/last date underneath. */
function TrendCard({ label, values, dates, id, tone }: { label: string; values: number[]; dates: string[]; id: string; tone: Tone }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <div className="mt-2 h-24">
        <AreaChart values={values} id={id} height={96} tone={tone} />
      </div>
      <div className="mt-1.5 flex items-center justify-between font-mono text-[11px] text-text-muted">
        <span>{shortDate(dates[0])}</span>
        <span>{shortDate(dates[dates.length - 1])}</span>
      </div>
    </div>
  );
}

function HistoryPanel({ data, target }: { data: BacklinkHistoryResponse; target: string }) {
  const rows = data.rows ?? [];
  const dates = rows.map((r) => r.date);
  return (
    <div className="space-y-4">
      {rows.length > 1 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TrendCard label="Referring domains" values={rows.map((r) => r.referring_domains ?? 0)} dates={dates} id="bl-hist-ref" tone="blue" />
          <TrendCard label="Backlinks" values={rows.map((r) => r.backlinks ?? 0)} dates={dates} id="bl-hist-links" tone="cyan" />
        </div>
      )}
      <DataTable columns={historyCols} rows={rows} csvName={`backlink-history-${target}`} />
    </div>
  );
}

function NewLostPanel({ data, target }: { data: NewLostResponse; target: string }) {
  const rows = data.rows ?? [];
  const dates = rows.map((r) => r.date);
  return (
    <div className="space-y-4">
      {rows.length > 1 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TrendCard label="New links" values={rows.map((r) => r.new_backlinks ?? 0)} dates={dates} id="bl-nl-new" tone="emerald" />
          <TrendCard label="Lost links" values={rows.map((r) => r.lost_backlinks ?? 0)} dates={dates} id="bl-nl-lost" tone="amber" />
        </div>
      )}
      <DataTable columns={newLostCols} rows={rows} csvName={`new-lost-${target}`} />
    </div>
  );
}

/** StatCard-style tile for the 0-100 spam score with a colored risk note. */
function SpamScoreCard({ score }: { score: number | null | undefined }) {
  const note =
    score == null
      ? null
      : score <= 30
        ? { label: "low risk", cls: "text-success" }
        : score <= 60
          ? { label: "moderate", cls: "text-warning" }
          : { label: "toxic risk", cls: "text-danger" };
  return (
    <Card className="h-full transition-shadow hover:shadow-md">
      <CardBody className="flex h-full flex-col justify-center">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Spam score</p>
        <p className="mt-1 font-mono text-2xl text-text">{score == null ? "—" : `${score}/100`}</p>
        {note && <p className={`mt-0.5 text-xs font-medium ${note.cls}`}>{note.label}</p>}
      </CardBody>
    </Card>
  );
}

export default function Backlinks() {
  const [target, setTarget] = usePersistedState("backlinks.target", "");
  const [submitted, setSubmitted] = usePersistedState("backlinks.submitted", "");
  const [tab, setTab] = usePersistedState<TabKey>("backlinks.tab", "backlinks");
  const [results, setResults] = usePersistedState<Partial<Record<TabKey, unknown>>>("backlinks.results", {});
  const [pendingTab, setPendingTab] = useState<TabKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const summary = useBacklinksSummary();
  const spam = useSpamScore();
  const muts = {
    backlinks: useBacklinksList(),
    referring: useReferringDomains(),
    anchors: useBacklinkAnchors(),
    history: useBacklinksHistory(),
    newlost: useBacklinksNewLost(),
    blcompetitors: useBacklinkCompetitors(),
  };

  const load = async (t: TabKey, dom: string, force = false) => {
    if (!force && results[t]) return;
    setPendingTab(t);
    setError(null);
    try {
      const data = await muts[t].mutateAsync({ target: dom, limit: 100, force_live: force });
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
    setError(null);
    summary.mutate({ target: d });
    spam.mutate({ target: d });
    void load(tab, d, true);
  };

  const changeTab = (t: TabKey) => {
    setTab(t);
    if (submitted) void load(t, submitted);
  };

  const refresh = () => {
    if (!submitted) return;
    summary.mutate({ target: submitted, force_live: true });
    spam.mutate({ target: submitted, force_live: true });
    void load(tab, submitted, true);
  };

  const current = results[tab];
  const isPending = pendingTab === tab;
  const meta = (current as { meta?: Meta } | undefined)?.meta;
  const s = summary.data?.summary;
  const freeOnly = summary.data?.source === "openpagerank";

  return (
    <div>
      <PageHeader
        title="Backlink Intelligence"
        subtitle="Authority, referring domains, strongest backlinks, and anchor-text profile — from the DataForSEO Backlinks index."
      />

      <Card className="mb-5">
        <CardBody>
          <form onSubmit={submit} className="flex flex-col gap-3 md:flex-row">
            <div className="relative lg:flex-1">
              <Link2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="example.com or full URL"
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={isPending || !target.trim()}>
              <Search size={16} /> Analyze
            </Button>
            {submitted && (
              <Button type="button" variant="secondary" title="Bypass the cache and fetch live" disabled={isPending} onClick={refresh}>
                <RefreshCw size={15} className={isPending ? "animate-spin" : ""} /> Refresh
              </Button>
            )}
          </form>
          <p className="mt-2.5 text-xs text-text-muted">
            Want the full organic footprint too?{" "}
            <Link to="/domains" className="text-primary hover:underline">
              Domain Analytics
            </Link>
          </p>
        </CardBody>
      </Card>

      {!submitted ? (
        <EmptyState
          title="Analyze a backlink profile"
          hint="Enter a domain or URL to see its authority, referring domains, strongest links, and anchor text."
        />
      ) : (
        <div className="animate-fade-rise space-y-4">
          {/* Authority + totals strip */}
          <Card className="bg-gradient-to-br from-primary-soft/40 to-surface">
            <CardBody className="flex flex-wrap items-center gap-6 py-4">
              {summary.isPending ? (
                <Skeleton className="h-20 w-20 rounded-full" />
              ) : (
                <AuthorityBadge score={s?.authority ?? null} size={80} />
              )}
              <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <StatCard label="Backlinks" value={fmtInt(s?.backlinks)} accent />
                <StatCard label="Referring domains" value={fmtInt(s?.referring_domains)} />
                <StatCard label="Dofollow" value={fmtInt(s?.dofollow)} />
                <StatCard label="Broken" value={fmtInt(s?.broken_backlinks)} />
                <SpamScoreCard score={spam.data?.spam_score} />
              </div>
            </CardBody>
          </Card>

          {freeOnly && (
            <p className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm text-text">
              Showing authority from the free OpenPageRank index. Full link, referring-domain and
              anchor data needs an active DataForSEO Backlinks subscription.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
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
              {!!current && (
                <SaveToProject
                  module={`backlinks.${tab}`}
                  params={{ target: submitted }}
                  result={current as Record<string, unknown>}
                />
              )}
            </div>
          </div>

          <Card>
            <CardBody>
              {isPending ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : error ? (
                <ErrorState message={error} onRetry={() => submitted && load(tab, submitted, true)} />
              ) : !current ? (
                <EmptyState title="No data yet" hint="Run an analysis to populate this tab." />
              ) : tab === "backlinks" ? (
                <DataTable columns={backlinkCols} rows={(current as BacklinksListResponse).rows} csvName={`backlinks-${submitted}`} />
              ) : tab === "referring" ? (
                <DataTable columns={referringCols} rows={(current as ReferringDomainsResponse).rows} csvName={`referring-domains-${submitted}`} />
              ) : tab === "history" ? (
                <HistoryPanel data={current as BacklinkHistoryResponse} target={submitted} />
              ) : tab === "newlost" ? (
                <NewLostPanel data={current as NewLostResponse} target={submitted} />
              ) : tab === "blcompetitors" ? (
                <DataTable columns={blCompetitorCols} rows={(current as BLCompetitorsResponse).rows} csvName={`similar-profiles-${submitted}`} />
              ) : (
                <DataTable columns={anchorCols} rows={(current as AnchorsResponse).rows} csvName={`anchors-${submitted}`} />
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
