import { ArrowRight, CalendarClock, DollarSign, FileText, Flag, ListTree, Printer, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { apiErrorMessage } from "@/api/client";
import { useSiteReport } from "@/api/hooks/useReport";
import { useCreateSchedule } from "@/api/hooks/useSchedules";
import { AiAdvisor } from "@/components/shared/AiAdvisor";
import { CacheBadge } from "@/components/shared/CacheBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { ExcelButton } from "@/components/shared/ExcelButton";
import { LocationLanguagePicker } from "@/components/shared/LocationLanguagePicker";
import { MetricCard } from "@/components/shared/MetricCard";
import { ScoreGauge } from "@/components/shared/ScoreGauge";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";
import { fmtInt } from "@/lib/format";
import type { CompetitorRow, PageReport, RankedKeywordRow, SiteReportResponse } from "@/types";

const pageCols: Column<PageReport>[] = [
  {
    key: "url",
    header: "Page",
    sortValue: (r) => r.url,
    render: (r) => (
      <a href={r.url} target="_blank" rel="noreferrer" className="text-[color:var(--section-ink)] hover:underline">
        {(() => {
          try {
            return new URL(r.url).pathname || r.url;
          } catch {
            return r.url;
          }
        })()}
      </a>
    ),
    csvValue: (r) => r.url,
  },
  {
    key: "content_score",
    header: "Score",
    align: "right",
    mono: true,
    sortValue: (r) => r.content_score ?? -1,
    render: (r) => (r.content_score == null ? "—" : `${r.content_score}`),
    csvValue: (r) => r.content_score,
  },
  {
    key: "word_count",
    header: "Words",
    align: "right",
    mono: true,
    sortValue: (r) => r.word_count ?? 0,
    render: (r) => fmtInt(r.word_count),
    csvValue: (r) => r.word_count,
  },
  {
    key: "recommendation",
    header: "Top fix",
    render: (r) => <span className="text-text-muted">{r.recommendation ?? "—"}</span>,
    csvValue: (r) => r.recommendation,
  },
];

const kwCols: Column<RankedKeywordRow>[] = [
  { key: "keyword", header: "Keyword", sortValue: (r) => r.keyword },
  { key: "position", header: "Pos", align: "right", mono: true, sortValue: (r) => r.position ?? 999, render: (r) => (r.position == null ? "—" : `#${r.position}`) },
  { key: "search_volume", header: "Volume", align: "right", mono: true, sortValue: (r) => r.search_volume ?? 0, render: (r) => fmtInt(r.search_volume), csvValue: (r) => r.search_volume },
  { key: "etv", header: "ETV", align: "right", mono: true, sortValue: (r) => r.etv ?? 0, render: (r) => (r.etv == null ? "—" : r.etv.toFixed(0)), csvValue: (r) => r.etv },
];

const compCols: Column<CompetitorRow>[] = [
  { key: "domain", header: "Competitor", sortValue: (r) => r.domain },
  { key: "common_keywords", header: "Shared kw", align: "right", mono: true, sortValue: (r) => r.common_keywords ?? 0, render: (r) => fmtInt(r.common_keywords), csvValue: (r) => r.common_keywords },
  { key: "keywords_count", header: "Total kw", align: "right", mono: true, sortValue: (r) => r.keywords_count ?? 0, render: (r) => fmtInt(r.keywords_count), csvValue: (r) => r.keywords_count },
  { key: "etv", header: "ETV", align: "right", mono: true, sortValue: (r) => r.etv ?? 0, render: (r) => (r.etv == null ? "—" : r.etv.toFixed(0)), csvValue: (r) => r.etv },
];

function SchedulePanel({
  domain,
  keyword,
  loc,
}: {
  domain: string;
  keyword: string;
  loc: { location_code: number; language_code: string };
}) {
  const [freq, setFreq] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [emailTo, setEmailTo] = useState("");
  const create = useCreateSchedule();

  const schedule = () => {
    const d = domain.trim();
    if (!d) return;
    create.mutate({
      frequency: freq,
      params: {
        domain: d,
        keyword: keyword.trim() || undefined,
        email: emailTo.trim() || undefined,
        ...loc,
      },
    });
  };

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <CalendarClock size={16} className="text-[color:var(--section)]" /> Automate this report
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={freq}
            onChange={(e) => setFreq(e.target.value as typeof freq)}
            className="sm:w-32"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </Select>
          <Input
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            placeholder="Email report to (optional)"
            className="sm:w-56"
          />
          <Button size="sm" onClick={schedule} loading={create.isPending} disabled={!domain.trim()}>
            {!create.isPending && <CalendarClock size={15} />} Schedule{" "}
            {domain.trim() ? `“${domain.trim()}”` : "report"}
          </Button>
        </div>
        <span className="text-xs text-text-muted">
          Runs automatically and saves each report to your “Scheduled Reports” project
          {emailTo.trim() ? ` and emails ${emailTo.trim()}` : ""}.
        </span>

        <Link to="/schedules" className="inline-flex items-center gap-1 text-xs text-[color:var(--section-ink)] hover:underline">
          Manage all schedules <ArrowRight size={12} />
        </Link>
      </CardBody>
    </Card>
  );
}

function Report({ data }: { data: SiteReportResponse }) {
  const org = data.overview.organic;
  // Compact context for the AI Advisor — the report's most decision-relevant slices.
  const aiContext = {
    domain: data.domain,
    keyword: data.keyword,
    health_score: data.health_score,
    overview: data.overview,
    ranking: data.ranking,
    findings: data.findings,
    recommendations: data.recommendations,
    pages: data.pages.slice(0, 5),
    top_keywords: data.top_keywords.slice(0, 10),
    competitors: data.competitors.slice(0, 5),
  };

  const buildExcel = () => {
    const kv = (metric: string, value: unknown) => ({ metric, value: value ?? null });
    const overviewRows = [
      kv("Site health score", data.health_score),
      kv("Organic keywords", org.count),
      kv("Est. organic traffic", org.etv),
      kv("Traffic value", org.traffic_cost),
      kv("Paid keywords", data.overview.paid.count),
      ...(data.ranking
        ? [kv(`Rank for "${data.ranking.keyword}"`, data.ranking.found ? data.ranking.position : "Not found")]
        : []),
      kv("Pages analyzed", data.pages.length),
    ];
    return {
      summary: {
        Report: "Site Report",
        Domain: data.domain,
        Keyword: data.keyword ?? undefined,
        Generated: new Date().toLocaleString(),
      },
      sheets: [
        {
          name: "Overview",
          columns: [
            { header: "Metric", key: "metric", width: 28 },
            { header: "Value", key: "value", width: 18 },
          ],
          rows: overviewRows as unknown as Record<string, unknown>[],
        },
        {
          name: "Top pages",
          columns: [
            { header: "URL", key: "url", width: 60 },
            { header: "Content score", key: "content_score", width: 14 },
            { header: "Words", key: "word_count", width: 10 },
            { header: "Title", key: "title", width: 50 },
            { header: "Issues", key: "issues", width: 60 },
            { header: "Top fix", key: "recommendation", width: 60 },
          ],
          rows: data.pages.map((p) => ({
            ...p,
            issues: p.issues.join("; "),
          })) as unknown as Record<string, unknown>[],
        },
        {
          name: "Top keywords",
          columns: [
            { header: "Keyword", key: "keyword", width: 40 },
            { header: "Position", key: "position", width: 10 },
            { header: "Volume", key: "search_volume", width: 12 },
            { header: "ETV", key: "etv", width: 12 },
            { header: "URL", key: "url", width: 60 },
          ],
          rows: data.top_keywords as unknown as Record<string, unknown>[],
        },
        {
          name: "Competitors",
          columns: [
            { header: "Domain", key: "domain", width: 32 },
            { header: "Shared keywords", key: "common_keywords", width: 16 },
            { header: "Total keywords", key: "keywords_count", width: 16 },
            { header: "Avg position", key: "avg_position", width: 14 },
            { header: "ETV", key: "etv", width: 12 },
          ],
          rows: data.competitors as unknown as Record<string, unknown>[],
        },
        {
          name: "Findings & recommendations",
          columns: [
            { header: "Type", key: "type", width: 16 },
            { header: "Item", key: "item", width: 90 },
          ],
          rows: [
            ...data.findings.map((f) => ({ type: "Finding", item: f })),
            ...data.recommendations.map((r) => ({ type: "Recommendation", item: r })),
          ] as unknown as Record<string, unknown>[],
        },
      ],
    };
  };

  return (
    <div className="animate-fade-rise space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">
          Report for <span className="text-[color:var(--section-ink)]">{data.domain}</span>
          {data.keyword && <span className="text-text-muted"> · “{data.keyword}”</span>}
        </h2>
        <div className="flex items-center gap-2">
          <CacheBadge meta={data.meta} />
          <ExcelButton filename={`report-${data.domain}`} build={buildExcel} />
          <Button variant="ghost" size="sm" onClick={() => window.print()}>
            <Printer size={15} /> Print / PDF
          </Button>
        </div>
      </div>

      {/* Bento hero — health gauge anchors a 6-col mosaic of metric tiles. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Card className="col-span-2 row-span-2 bg-gradient-to-br from-[color:var(--section-soft)] to-surface transition-shadow hover:shadow-md">
          <CardBody className="flex h-full items-center justify-center py-6">
            <ScoreGauge
              score={data.health_score}
              label="site health"
              size={190}
              emptyHint={data.pages.length === 0 ? "site blocked crawling" : undefined}
            />
          </CardBody>
        </Card>
        <MetricCard className="lg:col-span-2" icon={ListTree} label="Organic keywords" value={fmtInt(org.count)} />
        <MetricCard
          className="lg:col-span-2"
          icon={DollarSign}
          label="Est. traffic value"
          value={org.traffic_cost == null ? "—" : `$${(org.traffic_cost / 100).toFixed(0)}`}
        />
        {data.ranking ? (
          <MetricCard
            className="lg:col-span-2"
            icon={TrendingUp}
            label={`Rank · ${data.keyword}`}
            value={data.ranking.found ? `#${data.ranking.position}` : "Not found"}
          />
        ) : (
          <MetricCard className="lg:col-span-2" icon={Flag} label="Key findings" value={String(data.findings.length)} />
        )}
        <MetricCard className="lg:col-span-2" icon={FileText} label="Pages analyzed" value={String(data.pages.length)} />
      </div>

      {/* Advisor dominates; findings + recommendations stack beside it. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
        <div
          className={
            data.findings.length > 0 || data.recommendations.length > 0
              ? "lg:col-span-4"
              : "lg:col-span-6"
          }
        >
          <AiAdvisor context={aiContext} ready />
        </div>
        {(data.findings.length > 0 || data.recommendations.length > 0) && (
          <div className="flex flex-col gap-4 lg:col-span-2">
            {data.findings.length > 0 && (
              <Card className="flex-1 transition-shadow hover:shadow-md">
                <CardHeader>
                  <CardTitle>Key findings</CardTitle>
                </CardHeader>
                <CardBody>
                  <ul className="space-y-1.5 text-sm text-text">
                    {data.findings.map((f, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-[color:var(--section-ink)]">•</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            )}
            {data.recommendations.length > 0 && (
              <Card className="flex-1 transition-shadow hover:shadow-md">
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
      </div>

      <ReportTables data={data} />
    </div>
  );
}

function ReportTables({ data }: { data: SiteReportResponse }) {
  const [tab, setTab] = useState("pages");
  const tabs = [
    { key: "pages", label: `Top pages (${data.pages.length})` },
    { key: "keywords", label: `Keywords (${data.top_keywords.length})` },
    { key: "competitors", label: `Competitors (${data.competitors.length})` },
  ];
  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <Tabs value={tab} onChange={setTab}>
          <TabsList>
            {tabs.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Sections stay in the DOM (hidden) so the full report still prints. */}
      <Card className={cn(tab === "pages" ? "block" : "hidden", "print:block")}>
        <CardHeader>
          <CardTitle>Top pages — On-Page scores</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {data.pages.length ? (
            <DataTable columns={pageCols} rows={data.pages} csvName={`report-pages-${data.domain}`} />
          ) : (
            <p className="px-5 py-4 text-sm text-text-muted">No pages could be fetched for analysis.</p>
          )}
        </CardBody>
      </Card>

      <Card className={cn(tab === "keywords" ? "block" : "hidden", "print:block")}>
        <CardHeader>
          <CardTitle>Top ranked keywords</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {data.top_keywords.length ? (
            <DataTable columns={kwCols} rows={data.top_keywords} csvName={`report-keywords-${data.domain}`} />
          ) : (
            <p className="px-5 py-4 text-sm text-text-muted">No ranked keywords found.</p>
          )}
        </CardBody>
      </Card>

      <Card className={cn(tab === "competitors" ? "block" : "hidden", "print:block")}>
        <CardHeader>
          <CardTitle>Competitors</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {data.competitors.length ? (
            <DataTable columns={compCols} rows={data.competitors} csvName={`report-competitors-${data.domain}`} />
          ) : (
            <p className="px-5 py-4 text-sm text-text-muted">No competing domains found.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export default function SiteReport({ embedded }: { embedded?: boolean }) {
  const [domain, setDomain] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loc, setLoc] = useState({ location_code: 2840, language_code: "en" });
  const mutation = useSiteReport();
  const [live, setLive] = useState(false);
  const data = mutation.data;

  const run = () => {
    const d = domain.trim();
    if (d) mutation.mutate({ ...loc, domain: d, keyword: keyword.trim() || undefined, force_live: live });
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run();
  };

  return (
    <div>
      {!embedded && (
        <PageHeader
          title="Site Report"
          subtitle="One-click SEO audit: domain overview, top-page scores, keywords, competitors, and rankings."
        />
      )}

      <Card className="mb-5">
        <CardBody>
          <form onSubmit={submit} className="flex flex-col gap-3 md:flex-row">
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="Domain — e.g. nike.com" className="md:flex-1" />
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Target keyword (optional)" className="md:w-64" />
            <LocationLanguagePicker value={loc} onChange={setLoc} />
            <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-text-muted" title="Bypass the cache and fetch fresh (billed) data">
              <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
              Live
            </label>
            <Button type="submit" loading={mutation.isPending} disabled={!domain.trim()}>
              {!mutation.isPending && <FileText size={16} />}
              {mutation.isPending ? "Building…" : "Generate report"}
            </Button>
          </form>
        </CardBody>
      </Card>

      <SchedulePanel domain={domain} keyword={keyword} loc={loc} />

      {mutation.isPending && (
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
        </div>
      )}
      {mutation.isError && !mutation.isPending && (
        <ErrorState message={apiErrorMessage(mutation.error)} onRetry={run} />
      )}
      {!mutation.isPending && !mutation.isError && !data && (
        <EmptyState title="Generate a site report" hint="Enter a domain to produce a complete SEO audit across its top pages." />
      )}
      {data && !mutation.isPending && <Report data={data} />}
    </div>
  );
}
