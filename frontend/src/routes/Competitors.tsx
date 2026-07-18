import { CircleDollarSign, ExternalLink, KeyRound, Link2, Plus, ShieldCheck, Swords, X } from "lucide-react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { apiErrorMessage } from "@/api/client";
import { useBacklinksSummary, useLinkGap } from "@/api/hooks/useBacklinks";
import { useCompetitors, useDomainOverview, useIntersection } from "@/api/hooks/useDomains";
import { AuthorityBadge } from "@/components/shared/AuthorityBadge";
import { CacheBadge } from "@/components/shared/CacheBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { ExcelButton } from "@/components/shared/ExcelButton";
import { LocationLanguagePicker } from "@/components/shared/LocationLanguagePicker";
import { MetricCard } from "@/components/shared/MetricCard";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtInt } from "@/lib/format";
import type { CompetitorRow, IntersectionRow, LinkGapRow } from "@/types";

/** How many competitors can be compared at once (hooks are allocated per slot). */
const MAX_RIVALS = 3;
/** Chart-series palette for rival overlays (you = the section color).
 *  Theme-aware CSS vars, CVD-validated per mode against the section purple. */
const RIVAL_COLORS = ["var(--chart-rival-1)", "var(--chart-rival-2)", "var(--chart-rival-3)"];

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

interface RadarSeries {
  label: string;
  color: string;
}

interface RadarAxis {
  axis: string;
  raws: number[];   // one value per series, [you, ...rivals]
  disps: string[];  // formatted values, same order
}

function RadarTip({
  active,
  payload,
  series,
}: {
  active?: boolean;
  payload?: { payload: RadarAxis }[];
  series: RadarSeries[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="glass-card rounded-lg border border-border px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-text">{p.axis}</p>
      {series.map((s, i) => (
        <p key={s.label + i} style={{ color: s.color }}>
          {s.label} — {p.disps[i]}
        </p>
      ))}
    </div>
  );
}

/** Multi-domain radar: each axis normalized to the leader (100), so the shape
 *  shows relative strength; the tooltip shows the real values. */
function CompareRadar({ series, axes }: { series: RadarSeries[]; axes: RadarAxis[] }) {
  const data = axes.map((a) => {
    const max = Math.max(...a.raws, 1);
    const row: Record<string, unknown> = { axis: a.axis, disps: a.disps, raws: a.raws };
    a.raws.forEach((v, i) => {
      row[`s${i}`] = Math.round((v / max) * 100);
    });
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={340}>
      <RadarChart data={data} outerRadius="70%">
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="axis" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
        {series.map((s, i) => (
          <Radar
            key={s.label + i}
            name={s.label}
            dataKey={`s${i}`}
            stroke={s.color}
            fill={s.color}
            fillOpacity={i === 0 ? 0.3 : 0.12}
            strokeWidth={2}
          />
        ))}
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Tooltip content={<RadarTip series={series} />} />
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

/** One metric, one bar per domain — magnitudes the radar's normalized shape
 *  can't show. Direct labels double as the contrast relief for light hues. */
function CompareBars({
  title, series, values, fmt,
}: {
  title: string;
  series: RadarSeries[];
  values: (number | null | undefined)[];
  fmt: (v: number | null | undefined) => string;
}) {
  const data = series.map((s, i) => ({
    name: s.label,
    value: typeof values[i] === "number" ? (values[i] as number) : 0,
    disp: fmt(values[i]),
    fill: s.color,
  }));
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</p>
      <ResponsiveContainer width="100%" height={190}>
        <BarChart data={data} margin={{ top: 22, right: 8, left: 8, bottom: 0 }}>
          <XAxis
            dataKey="name"
            interval={0}
            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            tickFormatter={(v: string) => (v.length > 12 ? `${v.slice(0, 11)}…` : v)}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip
            cursor={{ fill: "var(--surface-2)", opacity: 0.5 }}
            contentStyle={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 8, fontSize: 12, color: "var(--text)",
            }}
            formatter={(_v, _n, item) => [(item?.payload as { disp: string }).disp, title]}
          />
          <Bar
            dataKey="value"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
            label={{
              position: "top", fontSize: 11, fill: "var(--text)",
              formatter: (v: unknown) => fmt(typeof v === "number" ? v : null),
            }}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface StatRow {
  label: string;
  values: (number | null | undefined)[]; // [you, ...rivals]
  fmt: (v: number | null | undefined) => string;
  pending: boolean[];
}

/** All the numbers side by side — one row per metric, one column per domain,
 *  the per-row leader highlighted. Complements the radar's shape view. */
function StatsTable({ series, rows }: { series: RadarSeries[]; rows: StatRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2/40">
            <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
              Metric
            </th>
            {series.map((s, i) => (
              <th key={s.label + i} scope="col" className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                  <span className="max-w-[160px] truncate">{s.label}</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const nums = row.values.filter((v): v is number => typeof v === "number");
            const best = nums.length ? Math.max(...nums) : null;
            return (
              <tr key={row.label} className="border-t border-border">
                <th scope="row" className="px-4 py-2.5 text-left font-medium text-text">
                  {row.label}
                </th>
                {row.values.map((v, i) => {
                  const leads = best != null && v === best && nums.length > 1;
                  return (
                    <td
                      key={i}
                      className={`px-4 py-2.5 text-right font-mono tabular-nums ${
                        leads ? "font-bold text-[color:var(--section)]" : "text-text"
                      }`}
                    >
                      {row.pending[i] ? "…" : row.fmt(v)}
                      {leads && <span className="ml-1" aria-label="leader">▲</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The mutations one rival slot owns. Hooks must be called a fixed number of
 *  times, so the page allocates MAX_RIVALS slots and maps rivals onto them. */
function useRivalSlot() {
  return { ov: useDomainOverview(), auth: useBacklinksSummary(), gap: useIntersection() };
}

export default function Competitors() {
  const [you, setYou] = useState("");
  const [rivals, setRivals] = useState<string[]>([""]);
  const [loc, setLoc] = useState({ location_code: 2840, language_code: "en" });
  // The rivals a comparison actually ran with — sections render from this, so
  // editing the inputs after a run doesn't desync the slots.
  const [ranRivals, setRanRivals] = useState<string[]>([]);
  // Which competitor's detail tables are open (index into ranRivals).
  const [activeRival, setActiveRival] = useState("0");

  const ovYou = useDomainOverview();
  const authYou = useBacklinksSummary();
  const slot0 = useRivalSlot();
  const slot1 = useRivalSlot();
  const slot2 = useRivalSlot();
  const slots = [slot0, slot1, slot2];
  const comps = useCompetitors();
  const linkGap = useLinkGap();

  const cleanRivals = rivals.map((r) => r.trim()).filter(Boolean).slice(0, MAX_RIVALS);

  const setRival = (i: number, v: string) =>
    setRivals((rs) => rs.map((r, j) => (j === i ? v : r)));
  const addRival = () => setRivals((rs) => (rs.length < MAX_RIVALS ? [...rs, ""] : rs));
  const removeRival = (i: number) =>
    setRivals((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs));

  const findLinkGap = () => {
    const a = you.trim();
    if (!a || !ranRivals.length) return;
    linkGap.mutate({ target: a, competitors: ranRivals, limit: 100 });
  };

  const run = () => {
    const a = you.trim();
    if (!a || !cleanRivals.length) return;
    setRanRivals(cleanRivals);
    setActiveRival("0");
    ovYou.mutate({ target: a, ...loc });
    authYou.mutate({ target: a });
    cleanRivals.forEach((r, i) => {
      slots[i].ov.mutate({ target: r, ...loc });
      slots[i].auth.mutate({ target: r });
      slots[i].gap.mutate({ target1: a, target2: r, limit: 100, ...loc });
    });
    comps.mutate({ target: a, limit: 10, ...loc });
  };

  const started = ovYou.isPending || !!ovYou.data || ovYou.isError;
  const activeSlots = slots.slice(0, ranRivals.length);
  const radarSeries: RadarSeries[] = [
    { label: you.trim() || "You", color: "var(--section)" },
    ...ranRivals.map((r, i) => ({ label: r, color: RIVAL_COLORS[i % RIVAL_COLORS.length] })),
  ];
  const ovAll = [ovYou, ...activeSlots.map((s) => s.ov)];
  const authAll = [authYou, ...activeSlots.map((s) => s.auth)];

  /** KPI card props: your value + how it stands against the best rival. */
  const kpi = (
    youV: number | null | undefined,
    rivalVs: (number | null | undefined)[],
    fmt: (v: number | null | undefined) => string,
    pending: boolean,
  ) => {
    const nums = rivalVs.filter((v): v is number => typeof v === "number");
    const best = nums.length ? Math.max(...nums) : null;
    const bestIdx = best == null ? -1 : rivalVs.indexOf(best);
    const leading = typeof youV === "number" && best != null && youV >= best;
    return {
      value: pending ? "…" : fmt(youV),
      delta:
        !pending && typeof youV === "number" && best != null && best > 0
          ? leading
            ? "Leading"
            : `${Math.round((1 - youV / best) * 100)}% behind`
          : undefined,
      deltaUp: leading,
      sub:
        best != null && bestIdx >= 0
          ? `Best rival: ${ranRivals[bestIdx]} — ${fmt(best)}`
          : undefined,
    };
  };

  // One source for the stats table AND the Excel export.
  const statRows: StatRow[] = [
    { label: "Authority", values: authAll.map((m) => m.data?.summary.authority), fmt: fmtInt, pending: authAll.map((m) => m.isPending) },
    { label: "Organic keywords", values: ovAll.map((m) => m.data?.organic.count), fmt: fmtInt, pending: ovAll.map((m) => m.isPending) },
    { label: "Est. organic traffic", values: ovAll.map((m) => m.data?.organic.etv), fmt: fmtInt, pending: ovAll.map((m) => m.isPending) },
    { label: "Traffic value / mo", values: ovAll.map((m) => m.data?.organic.traffic_cost), fmt: dollars, pending: ovAll.map((m) => m.isPending) },
    { label: "Paid keywords", values: ovAll.map((m) => m.data?.paid.count), fmt: fmtInt, pending: ovAll.map((m) => m.isPending) },
    { label: "Backlinks", values: authAll.map((m) => m.data?.summary.backlinks), fmt: fmtInt, pending: authAll.map((m) => m.isPending) },
    { label: "Referring domains", values: authAll.map((m) => m.data?.summary.referring_domains), fmt: fmtInt, pending: authAll.map((m) => m.isPending) },
    { label: "Dofollow links", values: authAll.map((m) => m.data?.summary.dofollow), fmt: fmtInt, pending: authAll.map((m) => m.isPending) },
  ];

  const buildExcel = () => ({
    summary: {
      Report: "Competitor Analysis",
      "Your domain": you.trim(),
      Competitors: ranRivals.join(", "),
      Generated: new Date().toLocaleString(),
    },
    sheets: [
      {
        name: "Stats",
        columns: [
          { header: "Metric", key: "metric", width: 22 },
          ...radarSeries.map((s, i) => ({ header: s.label, key: `d${i}`, width: 20 })),
        ],
        rows: statRows.map((r) => ({
          metric: r.label,
          ...Object.fromEntries(r.values.map((v, i) => [`d${i}`, v ?? null])),
        })),
      },
      ...ranRivals.map((r, i) => ({
        name: `Gap vs ${r}`,
        columns: [
          { header: "Keyword", key: "keyword", width: 40 },
          { header: "Volume", key: "search_volume", width: 12 },
          { header: "Your position", key: "target1_position", width: 14 },
          { header: `${r} position`, key: "target2_position", width: 16 },
        ],
        rows: (slots[i].gap.data?.rows ?? []) as unknown as Record<string, unknown>[],
      })),
      {
        name: "Link gap",
        columns: [
          { header: "Domain", key: "domain", width: 36 },
          { header: "Authority", key: "authority", width: 12 },
          { header: "Links to competitors", key: "links_to_competitors", width: 20 },
          { header: "Competitors linked", key: "competitors_linked", width: 18 },
        ],
        rows: (linkGap.data?.rows ?? []) as unknown as Record<string, unknown>[],
      },
      {
        name: "Other competitors",
        columns: [
          { header: "Domain", key: "domain", width: 32 },
          { header: "Shared keywords", key: "common_keywords", width: 16 },
          { header: "Total keywords", key: "keywords_count", width: 16 },
          { header: "Avg position", key: "avg_position", width: 14 },
          { header: "ETV", key: "etv", width: 12 },
        ],
        rows: (comps.data?.rows ?? []) as unknown as Record<string, unknown>[],
      },
    ],
  });

  return (
    <div>
      <PageHeader
        title="Competitor Analysis"
        subtitle={`Put your domain head-to-head with up to ${MAX_RIVALS} competitors — authority, keywords, traffic, and the keyword gap between you.`}
      />

      <Card className="mb-5">
        <CardBody>
          <form onSubmit={(e) => { e.preventDefault(); run(); }} className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row">
              <Input value={you} onChange={(e) => setYou(e.target.value)} placeholder="Your domain — e.g. yoursite.com" className="md:flex-1" />
              <LocationLanguagePicker value={loc} onChange={setLoc} />
              <Button type="submit" loading={ovYou.isPending} disabled={!you.trim() || !cleanRivals.length}>
                {!ovYou.isPending && <Swords size={16} />} Compare
              </Button>
            </div>
            <div className="space-y-2">
              {rivals.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={r}
                    onChange={(e) => setRival(i, e.target.value)}
                    placeholder={`Competitor ${i + 1} — e.g. rival.com`}
                    className="md:max-w-md"
                  />
                  {rivals.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeRival(i)} aria-label={`Remove competitor ${i + 1}`}>
                      <X size={14} />
                    </Button>
                  )}
                </div>
              ))}
              {rivals.length < MAX_RIVALS && (
                <Button type="button" variant="ghost" size="sm" onClick={addRival}>
                  <Plus size={14} /> Add competitor
                </Button>
              )}
            </div>
          </form>
        </CardBody>
      </Card>

      {!started && (
        <EmptyState
          title="Pick your battle"
          hint={`Enter your domain and up to ${MAX_RIVALS} competitors to compare authority, organic footprint, and find keywords they rank for that you don't.`}
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
              {/* Render as soon as the overviews land — the Authority axis
                  (slowest, needs a Backlinks subscription) drops in when ready. */}
              {ovAll.some((m) => m.isPending) ? (
                <Skeleton className="h-[320px] w-full" />
              ) : (
                <CompareRadar
                  series={radarSeries}
                  axes={[
                    {
                      axis: "Authority",
                      raws: authAll.map((m) => m.data?.summary.authority ?? 0),
                      disps: authAll.map((m) => fmtInt(m.data?.summary.authority)),
                    },
                    {
                      axis: "Keywords",
                      raws: ovAll.map((m) => m.data?.organic.count ?? 0),
                      disps: ovAll.map((m) => fmtInt(m.data?.organic.count)),
                    },
                    {
                      axis: "Traffic value",
                      raws: ovAll.map((m) => m.data?.organic.traffic_cost ?? 0),
                      disps: ovAll.map((m) => dollars(m.data?.organic.traffic_cost)),
                    },
                    {
                      axis: "Backlinks",
                      raws: authAll.map((m) => m.data?.summary.backlinks ?? 0),
                      disps: authAll.map((m) => fmtInt(m.data?.summary.backlinks)),
                    },
                    {
                      axis: "Ref. domains",
                      raws: authAll.map((m) => m.data?.summary.referring_domains ?? 0),
                      disps: authAll.map((m) => fmtInt(m.data?.summary.referring_domains)),
                    },
                  ]}
                />
              )}
            </CardBody>
          </Card>

          {/* Your standing per key metric, vs the strongest rival. */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={ShieldCheck}
              label="Authority"
              {...kpi(
                authYou.data?.summary.authority,
                activeSlots.map((s) => s.auth.data?.summary.authority),
                fmtInt,
                authYou.isPending,
              )}
            />
            <MetricCard
              icon={KeyRound}
              label="Organic keywords"
              {...kpi(
                ovYou.data?.organic.count,
                activeSlots.map((s) => s.ov.data?.organic.count),
                fmtInt,
                ovYou.isPending,
              )}
            />
            <MetricCard
              icon={CircleDollarSign}
              label="Traffic value / mo"
              {...kpi(
                ovYou.data?.organic.traffic_cost,
                activeSlots.map((s) => s.ov.data?.organic.traffic_cost),
                dollars,
                ovYou.isPending,
              )}
            />
            <MetricCard
              icon={Link2}
              label="Backlinks"
              {...kpi(
                authYou.data?.summary.backlinks,
                activeSlots.map((s) => s.auth.data?.summary.backlinks),
                fmtInt,
                authYou.isPending,
              )}
            />
          </div>

          {/* All stats side by side — exact numbers, leader per row. */}
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Stats comparison</CardTitle>
              <ExcelButton filename={`competitors-${you.trim()}`} build={buildExcel} />
            </CardHeader>
            <CardBody className="p-0">
              <StatsTable series={radarSeries} rows={statRows} />
            </CardBody>
          </Card>

          {/* Magnitude view — one small bar chart per metric (one axis each). */}
          <Card>
            <CardHeader>
              <CardTitle>Metric breakdown</CardTitle>
            </CardHeader>
            <CardBody>
              {ovAll.some((m) => m.isPending) ? (
                <Skeleton className="h-[400px] w-full" />
              ) : (
                <div className="grid gap-6 sm:grid-cols-2">
                  <CompareBars
                    title="Organic keywords"
                    series={radarSeries}
                    values={ovAll.map((m) => m.data?.organic.count)}
                    fmt={fmtInt}
                  />
                  <CompareBars
                    title="Est. organic traffic"
                    series={radarSeries}
                    values={ovAll.map((m) => m.data?.organic.etv)}
                    fmt={fmtInt}
                  />
                  <CompareBars
                    title="Backlinks"
                    series={radarSeries}
                    values={authAll.map((m) => m.data?.summary.backlinks)}
                    fmt={fmtInt}
                  />
                  <CompareBars
                    title="Referring domains"
                    series={radarSeries}
                    values={authAll.map((m) => m.data?.summary.referring_domains)}
                    fmt={fmtInt}
                  />
                </div>
              )}
            </CardBody>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DomainCard
              title={you.trim() || "You"} accent
              authority={authYou.data?.summary.authority}
              organic={ovYou.data?.organic.count}
              traffic={ovYou.data?.organic.traffic_cost}
              pendingAuth={authYou.isPending} pendingOv={ovYou.isPending}
              noData={!!ovYou.data && ovYou.data.organic.count == null}
            />
            {ranRivals.map((r, i) => (
              <DomainCard
                key={r + i}
                title={r}
                authority={slots[i].auth.data?.summary.authority}
                organic={slots[i].ov.data?.organic.count}
                traffic={slots[i].ov.data?.organic.traffic_cost}
                pendingAuth={slots[i].auth.isPending} pendingOv={slots[i].ov.isPending}
                noData={!!slots[i].ov.data && slots[i].ov.data?.organic.count == null}
              />
            ))}
          </div>

          {/* Per-competitor tables — one row of names, click to switch. */}
          <Card>
            <Tabs value={activeRival} onChange={setActiveRival}>
              <CardHeader className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Keyword gap — where they win</CardTitle>
                {ranRivals.length > 1 && (
                  <TabsList>
                    {ranRivals.map((r, i) => (
                      <TabsTrigger key={r + i} value={String(i)}>
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: RIVAL_COLORS[i % RIVAL_COLORS.length] }}
                            aria-hidden
                          />
                          <span className="max-w-[180px] truncate">{r}</span>
                        </span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                )}
              </CardHeader>
              {ranRivals.map((r, i) => {
                const gap = slots[i].gap;
                return (
                  <TabsContent key={r + i} value={String(i)}>
                    <CardBody className="p-0">
                      <p className="border-b border-border px-5 py-2 text-xs text-text-muted">
                        Keywords <span className="font-medium text-text">{r}</span> ranks for that{" "}
                        <span className="font-medium text-text">{you.trim()}</span> doesn't (or ranks worse).
                      </p>
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
                        <DataTable columns={gapCols} rows={gap.data?.rows ?? []} csvName={`gap-${you.trim()}-vs-${r}`} />
                      )}
                    </CardBody>
                  </TabsContent>
                );
              })}
            </Tabs>
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
                <Button size="sm" onClick={findLinkGap} loading={linkGap.isPending} disabled={!you.trim() || !ranRivals.length}>
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
                  <span className="font-medium text-text">{ranRivals.join(", ") || "your competitors"}</span> but not to{" "}
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
                <DataTable columns={linkGapCols} rows={linkGap.data.rows} csvName={`link-gap-${you.trim()}`} />
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
