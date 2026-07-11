import { ExternalLink, Link2, Swords } from "lucide-react";
import { useState } from "react";
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { apiErrorMessage } from "@/api/client";
import { useBacklinksSummary, useLinkGap } from "@/api/hooks/useBacklinks";
import { useCompetitors, useDomainOverview, useIntersection } from "@/api/hooks/useDomains";
import { AuthorityBadge } from "@/components/shared/AuthorityBadge";
import { CacheBadge } from "@/components/shared/CacheBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { LocationLanguagePicker } from "@/components/shared/LocationLanguagePicker";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtInt } from "@/lib/format";
import type { CompetitorRow, IntersectionRow, LinkGapRow } from "@/types";

const gapCols: Column<IntersectionRow>[] = [
  { key: "keyword", header: "Keyword", sortValue: (r) => r.keyword, render: (r) => <span className="font-medium text-text">{r.keyword}</span> },
  { key: "search_volume", header: "Volume", align: "right", mono: true, sortValue: (r) => r.search_volume ?? -1, render: (r) => fmtInt(r.search_volume) },
  {
    key: "target1_position", header: "You", align: "right", mono: true,
    sortValue: (r) => r.target1_position ?? 999,
    render: (r) => (r.target1_position == null ? <span className="text-danger">—</span> : `#${r.target1_position}`),
  },
  {
    key: "target2_position", header: "Competitor", align: "right", mono: true,
    sortValue: (r) => r.target2_position ?? 999,
    render: (r) => (r.target2_position == null ? "—" : `#${r.target2_position}`),
  },
];

const compCols: Column<CompetitorRow>[] = [
  { key: "domain", header: "Domain", sortValue: (r) => r.domain, render: (r) => <span className="font-medium text-text">{r.domain}</span> },
  { key: "common_keywords", header: "Shared kw", align: "right", mono: true, sortValue: (r) => r.common_keywords ?? -1, render: (r) => fmtInt(r.common_keywords) },
  { key: "keywords_count", header: "Total kw", align: "right", mono: true, sortValue: (r) => r.keywords_count ?? -1, render: (r) => fmtInt(r.keywords_count) },
  { key: "avg_position", header: "Avg pos", align: "right", mono: true, sortValue: (r) => r.avg_position ?? 999, render: (r) => (r.avg_position == null ? "—" : r.avg_position.toFixed(1)) },
  { key: "etv", header: "ETV", align: "right", mono: true, sortValue: (r) => r.etv ?? -1, render: (r) => (r.etv == null ? "—" : `$${(r.etv / 100).toFixed(0)}`) },
];

const linkGapCols: Column<LinkGapRow>[] = [
  {
    key: "domain", header: "Domain",
    sortValue: (r) => r.domain ?? "",
    render: (r) =>
      r.domain ? (
        <a
          href={`https://${r.domain}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-text hover:text-[color:var(--section)] hover:underline"
        >
          {r.domain} <ExternalLink size={12} className="shrink-0 opacity-60" />
        </a>
      ) : (
        "—"
      ),
  },
  {
    key: "authority", header: "Authority", align: "right", mono: true,
    sortValue: (r) => r.authority ?? -1,
    render: (r) => (r.authority == null ? "—" : fmtInt(r.authority)),
  },
  {
    key: "links_to_competitors", header: "Links to competitors", align: "right", mono: true,
    sortValue: (r) => r.links_to_competitors ?? -1,
    render: (r) => fmtInt(r.links_to_competitors),
  },
  {
    key: "competitors_linked", header: "Competitors linked", align: "right", mono: true,
    sortValue: (r) => r.competitors_linked ?? -1,
    render: (r) => fmtInt(r.competitors_linked),
  },
];

const dollars = (cents: number | null | undefined) =>
  cents == null ? "—" : `$${fmtInt(Math.round(cents / 100))}`;

interface RadarMetric {
  axis: string;
  youRaw: number;
  rivalRaw: number;
  youDisp: string;
  rivalDisp: string;
}

function RadarTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: RadarMetric }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="glass-card rounded-lg border border-border px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-text">{p.axis}</p>
      <p style={{ color: "var(--section)" }}>You — {p.youDisp}</p>
      <p className="text-text-muted">Competitor — {p.rivalDisp}</p>
    </div>
  );
}

/** Head-to-head radar: each axis normalized to the leader (100), so the shape
 *  shows relative strength; the tooltip shows the real values. */
function CompareRadar({
  youLabel,
  rivalLabel,
  metrics,
}: {
  youLabel: string;
  rivalLabel: string;
  metrics: RadarMetric[];
}) {
  const data = metrics.map((m) => {
    const max = Math.max(m.youRaw, m.rivalRaw, 1);
    return { ...m, you: Math.round((m.youRaw / max) * 100), rival: Math.round((m.rivalRaw / max) * 100) };
  });
  return (
    <ResponsiveContainer width="100%" height={340}>
      <RadarChart data={data} outerRadius="70%">
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="axis" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
        <Radar
          name={youLabel}
          dataKey="you"
          stroke="var(--section)"
          fill="var(--section)"
          fillOpacity={0.35}
          strokeWidth={2}
        />
        <Radar
          name={rivalLabel}
          dataKey="rival"
          stroke="#94a3b8"
          fill="#94a3b8"
          fillOpacity={0.18}
          strokeWidth={2}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Tooltip content={<RadarTip />} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function DomainCard({
  title, accent, authority, organic, traffic, pendingAuth, pendingOv, noData,
}: {
  title: string; accent?: boolean; authority: number | null | undefined;
  organic: number | null | undefined; traffic: number | null | undefined;
  pendingAuth: boolean; pendingOv: boolean;
  /** Overview resolved but the domain ranks for nothing in this market. */
  noData?: boolean;
}) {
  return (
    <Card className={accent ? "bg-gradient-to-br from-[color:var(--section-soft)] to-surface" : undefined}>
      <CardHeader>
        <CardTitle className="truncate">{title}</CardTitle>
      </CardHeader>
      <CardBody>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center">
            {pendingAuth ? <Skeleton className="h-24 w-24 rounded-full" /> : <AuthorityBadge score={authority ?? null} size={88} />}
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-text-muted">Organic keywords</p>
              <p className="font-mono text-xl text-text">{pendingOv ? "…" : fmtInt(organic)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-text-muted">Traffic value</p>
              <p className="font-mono text-xl text-text">
                {pendingOv ? "…" : traffic == null ? "—" : `$${(traffic / 100).toFixed(0)}`}
              </p>
            </div>
          </div>
        </div>
        {noData && !pendingOv && (
          <p className="mt-3 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
            No ranking data found for this domain in the selected market — check the spelling
            (e.g. <span className="font-mono">ahrefs.com</span>, not <span className="font-mono">ahref.com</span>)
            or try another market.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

export default function Competitors() {
  const [you, setYou] = useState("");
  const [rival, setRival] = useState("");
  const [loc, setLoc] = useState({ location_code: 2840, language_code: "en" });

  const ovYou = useDomainOverview();
  const ovRival = useDomainOverview();
  const authYou = useBacklinksSummary();
  const authRival = useBacklinksSummary();
  const gap = useIntersection();
  const comps = useCompetitors();
  const linkGap = useLinkGap();

  const findLinkGap = () => {
    const a = you.trim(), b = rival.trim();
    if (!a || !b) return;
    linkGap.mutate({ target: a, competitors: [b], limit: 100 });
  };

  const run = () => {
    const a = you.trim(), b = rival.trim();
    if (!a || !b) return;
    ovYou.mutate({ target: a, ...loc });
    ovRival.mutate({ target: b, ...loc });
    authYou.mutate({ target: a });
    authRival.mutate({ target: b });
    gap.mutate({ target1: a, target2: b, limit: 100, ...loc });
    comps.mutate({ target: a, limit: 10, ...loc });
  };

  const started = ovYou.isPending || !!ovYou.data || ovYou.isError;

  return (
    <div>
      <PageHeader
        title="Competitor Analysis"
        subtitle="Put your domain head-to-head with a competitor — authority, keywords, traffic, and the keyword gap between you."
      />

      <Card className="mb-5">
        <CardBody>
          <form onSubmit={(e) => { e.preventDefault(); run(); }} className="flex flex-col gap-3 md:flex-row">
            <Input value={you} onChange={(e) => setYou(e.target.value)} placeholder="Your domain — e.g. yoursite.com" className="md:flex-1" />
            <Input value={rival} onChange={(e) => setRival(e.target.value)} placeholder="Competitor — e.g. rival.com" className="md:flex-1" />
            <LocationLanguagePicker value={loc} onChange={setLoc} />
            <Button type="submit" loading={ovYou.isPending} disabled={!you.trim() || !rival.trim()}>
              {!ovYou.isPending && <Swords size={16} />} Compare
            </Button>
          </form>
        </CardBody>
      </Card>

      {!started && (
        <EmptyState
          title="Pick your battle"
          hint="Enter two domains to compare authority, organic footprint, and find keywords your competitor ranks for that you don't."
        />
      )}

      {ovYou.isError && <ErrorState message={apiErrorMessage(ovYou.error)} onRetry={run} />}

      {started && !ovYou.isError && (
        <div className="animate-fade-rise space-y-5">
          {/* Head-to-head radar */}
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="inline-flex items-center gap-2">
                  <Swords size={16} style={{ color: "var(--section)" }} /> Head-to-head
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody>
              {ovYou.isPending || ovRival.isPending || authYou.isPending || authRival.isPending ? (
                <Skeleton className="h-[320px] w-full" />
              ) : (
                <CompareRadar
                  youLabel={you.trim() || "You"}
                  rivalLabel={rival.trim() || "Competitor"}
                  metrics={[
                    {
                      axis: "Authority",
                      youRaw: authYou.data?.summary.authority ?? 0,
                      rivalRaw: authRival.data?.summary.authority ?? 0,
                      youDisp: fmtInt(authYou.data?.summary.authority),
                      rivalDisp: fmtInt(authRival.data?.summary.authority),
                    },
                    {
                      axis: "Keywords",
                      youRaw: ovYou.data?.organic.count ?? 0,
                      rivalRaw: ovRival.data?.organic.count ?? 0,
                      youDisp: fmtInt(ovYou.data?.organic.count),
                      rivalDisp: fmtInt(ovRival.data?.organic.count),
                    },
                    {
                      axis: "Traffic value",
                      youRaw: ovYou.data?.organic.traffic_cost ?? 0,
                      rivalRaw: ovRival.data?.organic.traffic_cost ?? 0,
                      youDisp: dollars(ovYou.data?.organic.traffic_cost),
                      rivalDisp: dollars(ovRival.data?.organic.traffic_cost),
                    },
                    {
                      axis: "Backlinks",
                      youRaw: authYou.data?.summary.backlinks ?? 0,
                      rivalRaw: authRival.data?.summary.backlinks ?? 0,
                      youDisp: fmtInt(authYou.data?.summary.backlinks),
                      rivalDisp: fmtInt(authRival.data?.summary.backlinks),
                    },
                    {
                      axis: "Ref. domains",
                      youRaw: authYou.data?.summary.referring_domains ?? 0,
                      rivalRaw: authRival.data?.summary.referring_domains ?? 0,
                      youDisp: fmtInt(authYou.data?.summary.referring_domains),
                      rivalDisp: fmtInt(authRival.data?.summary.referring_domains),
                    },
                  ]}
                />
              )}
            </CardBody>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <DomainCard
              title={you.trim() || "You"} accent
              authority={authYou.data?.summary.authority}
              organic={ovYou.data?.organic.count}
              traffic={ovYou.data?.organic.traffic_cost}
              pendingAuth={authYou.isPending} pendingOv={ovYou.isPending}
              noData={!!ovYou.data && ovYou.data.organic.count == null}
            />
            <DomainCard
              title={rival.trim() || "Competitor"}
              authority={authRival.data?.summary.authority}
              organic={ovRival.data?.organic.count}
              traffic={ovRival.data?.organic.traffic_cost}
              pendingAuth={authRival.isPending} pendingOv={ovRival.isPending}
              noData={!!ovRival.data && ovRival.data.organic.count == null}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Keyword gap — where the competitor wins</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              {gap.isPending ? (
                <div className="p-5"><Skeleton className="h-48 w-full" /></div>
              ) : gap.isError ? (
                <div className="p-5"><p className="text-sm text-danger">{apiErrorMessage(gap.error)}</p></div>
              ) : (gap.data?.rows.length ?? 0) === 0 && gap.data ? (
                <div className="p-5">
                  <EmptyState
                    title="No gap keywords found"
                    hint="This usually means one domain has no rankings in this market — often a misspelled domain (ahrefs.com, not ahref.com) — or the sites are too small to overlap. Fix the domain or switch market and compare again."
                  />
                </div>
              ) : (
                <DataTable columns={gapCols} rows={gap.data?.rows ?? []} csvName={`gap-${you.trim()}-vs-${rival.trim()}`} />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Link gap — who links to them but not you</CardTitle>
                <p className="mt-1 text-xs text-text-muted">
                  Referring domains that link to the competitor(s) but not to you — your outreach shortlist.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <CacheBadge meta={linkGap.data?.meta} />
                <Button size="sm" onClick={findLinkGap} loading={linkGap.isPending} disabled={!you.trim() || !rival.trim()}>
                  {!linkGap.isPending && <Link2 size={16} />} Find link gap
                </Button>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {linkGap.isPending ? (
                <div className="space-y-2 p-5">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : linkGap.isError ? (
                <div className="p-5"><ErrorState message={apiErrorMessage(linkGap.error)} onRetry={findLinkGap} /></div>
              ) : !linkGap.data ? (
                <p className="p-5 text-sm text-text-muted">
                  Hit “Find link gap” to pull referring domains from the backlinks index that point to{" "}
                  <span className="font-medium text-text">{rival.trim()}</span> but not to{" "}
                  <span className="font-medium text-text">{you.trim()}</span>.
                </p>
              ) : linkGap.data.rows.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    title="No link gap found"
                    hint="Every domain linking to the competitor already links to you — or neither domain has enough backlink data in the index."
                  />
                </div>
              ) : (
                <DataTable columns={linkGapCols} rows={linkGap.data.rows} csvName={`link-gap-${you.trim()}-vs-${rival.trim()}`} />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Other competitors of {you.trim()}</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              {comps.isPending ? (
                <div className="p-5"><Skeleton className="h-40 w-full" /></div>
              ) : (
                <DataTable columns={compCols} rows={comps.data?.rows ?? []} csvName={`competitors-${you.trim()}`} />
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
