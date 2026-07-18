import { AlertTriangle, Bug, Info as InfoIcon, Radar, type LucideIcon } from "lucide-react";
import { useState } from "react";

import { apiErrorMessage } from "@/api/client";
import { useAuditStatus, useStartAudit } from "@/api/hooks/useAudit";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { ExcelButton } from "@/components/shared/ExcelButton";
import { MetricBar } from "@/components/shared/MetricBar";
import { ScoreGauge } from "@/components/shared/ScoreGauge";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { fmtInt } from "@/lib/format";
import type { AuditIssue, AuditPageRow } from "@/types";

const SEV_TONE = { error: "danger", warning: "warning", notice: "info" } as const;

const issueCols: Column<AuditIssue>[] = [
  {
    key: "severity", header: "Severity", sortValue: (r) => ({ error: 0, warning: 1, notice: 2 })[r.severity],
    render: (r) => <Badge tone={SEV_TONE[r.severity]}>{r.severity}</Badge>,
  },
  { key: "label", header: "Issue", sortValue: (r) => r.label, render: (r) => <span className="font-medium text-text">{r.label}</span> },
  { key: "count", header: "Pages affected", align: "right", mono: true, sortValue: (r) => r.count, render: (r) => fmtInt(r.count) },
];

const pageCols: Column<AuditPageRow>[] = [
  {
    key: "url", header: "Page", sortValue: (r) => r.url,
    render: (r) => (
      <div className="min-w-0">
        <a href={r.url ?? "#"} target="_blank" rel="noreferrer" className="block truncate font-medium text-text hover:text-[color:var(--section)] hover:underline">
          {r.url}
        </a>
        {r.failed_checks.length > 0 && (
          <p className="mt-0.5 flex flex-wrap gap-1">
            {r.failed_checks.map((c) => (
              <span key={c} className="rounded-full bg-danger/10 px-1.5 py-0.5 text-[10px] text-danger">{c}</span>
            ))}
          </p>
        )}
      </div>
    ),
    csvValue: (r) => r.url,
  },
  {
    key: "status_code", header: "Status", align: "right", mono: true, sortValue: (r) => r.status_code ?? 0,
    render: (r) => (
      <span className={r.status_code && r.status_code >= 400 ? "text-danger" : "text-text"}>{r.status_code ?? "—"}</span>
    ),
  },
  {
    key: "onpage_score", header: "Score", align: "right", mono: true, sortValue: (r) => r.onpage_score ?? -1,
    render: (r) => (r.onpage_score == null ? "—" : r.onpage_score.toFixed(1)),
  },
  { key: "word_count", header: "Words", align: "right", mono: true, sortValue: (r) => r.word_count ?? -1, render: (r) => fmtInt(r.word_count) },
  {
    key: "load_time_ms", header: "Load", align: "right", mono: true, sortValue: (r) => r.load_time_ms ?? -1,
    render: (r) => (r.load_time_ms == null ? "—" : `${Math.round(r.load_time_ms)}ms`),
  },
];

const SEV_STYLE = {
  danger: { chip: "bg-danger/10 text-danger", text: "text-danger" },
  warning: { chip: "bg-warning/10 text-warning", text: "text-warning" },
  info: { chip: "bg-info/10 text-info", text: "text-info" },
} as const;

/** Premium severity card — rounded filled icon + count. */
function SeverityCard({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: LucideIcon;
  tone: keyof typeof SEV_STYLE;
  label: string;
  value: number;
}) {
  const st = SEV_STYLE[tone];
  return (
    <Card className="lp-card lg:col-span-2">
      <CardBody className="flex h-full items-center gap-3.5">
        <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl", st.chip)}>
          <Icon size={22} />
        </span>
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted">{label}</p>
          <p className={cn("font-mono text-2xl font-extrabold", st.text)}>{fmtInt(value)}</p>
        </div>
      </CardBody>
    </Card>
  );
}

export default function SiteAudit() {
  const [domain, setDomain] = useState("");
  const [pages, setPages] = useState(50);
  const [taskId, setTaskId] = useState<string | null>(null);

  const start = useStartAudit();
  const status = useAuditStatus(taskId);

  const run = () => {
    const d = domain.trim();
    if (!d) return;
    setTaskId(null);
    start.mutate(
      { domain: d, max_crawl_pages: pages },
      { onSuccess: (r) => setTaskId(r.task_id) },
    );
  };

  const s = status.data;
  const failed = s?.progress === "error" || s?.progress === "unknown";
  const crawling = !!taskId && !failed && (!s || s.progress !== "finished");

  const score = s?.onpage_score == null ? null : Math.round(s.onpage_score);
  const verdict =
    score == null
      ? null
      : score >= 90
        ? { t: "Excellent", c: "success" as const }
        : score >= 70
          ? { t: "Good", c: "success" as const }
          : score >= 50
            ? { t: "Fair", c: "warning" as const }
            : { t: "Needs work", c: "danger" as const };
  const totalIssues = s ? s.errors + s.warnings + s.notices : 0;

  const buildExcel = () => {
    if (!s) return null;
    return {
      summary: {
        Report: "Site Audit",
        Domain: domain.trim(),
        "Health score": score,
        "Pages crawled": s.pages_crawled,
        Errors: s.errors,
        Warnings: s.warnings,
        Notices: s.notices,
        Generated: new Date().toLocaleString(),
      },
      sheets: [
        {
          name: "Issues",
          columns: [
            { header: "Issue", key: "label", width: 44 },
            { header: "Severity", key: "severity", width: 12 },
            { header: "Pages affected", key: "count", width: 14 },
          ],
          rows: s.issues as unknown as Record<string, unknown>[],
        },
        {
          name: "Crawled pages",
          columns: [
            { header: "URL", key: "url", width: 60 },
            { header: "Status", key: "status_code", width: 10 },
            { header: "Score", key: "onpage_score", width: 10 },
            { header: "Title", key: "title", width: 50 },
            { header: "Words", key: "word_count", width: 10 },
            { header: "Load (ms)", key: "load_time_ms", width: 10 },
            { header: "Failed checks", key: "failed_checks", width: 60 },
          ],
          rows: s.pages.map((p) => ({
            ...p,
            failed_checks: p.failed_checks.join("; "),
          })) as unknown as Record<string, unknown>[],
        },
      ],
    };
  };

  return (
    <div>
      <PageHeader
        title="Site Audit"
        subtitle="Crawl a whole site live and get its technical health: errors, warnings, and notices for every page — Ahrefs style, free and unlimited."
      />

      <Card className="mb-5">
        <CardBody>
          <form onSubmit={(e) => { e.preventDefault(); run(); }} className="flex flex-col gap-3 md:flex-row">
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="Domain to crawl — e.g. yoursite.com"
              className="md:flex-1"
            />
            <Select value={pages} onChange={(e) => setPages(Number(e.target.value))} aria-label="Pages to crawl">
              <option value={25}>Crawl 25 pages</option>
              <option value={50}>Crawl 50 pages</option>
              <option value={100}>Crawl 100 pages</option>
              <option value={200}>Crawl 200 pages</option>
            </Select>
            <Button type="submit" loading={start.isPending} disabled={!domain.trim() || crawling}>
              {!start.isPending && <Radar size={16} />} Start audit
            </Button>
          </form>
        </CardBody>
      </Card>

      {!taskId && !start.isPending && !start.isError && (
        <EmptyState
          title="Run your first site audit"
          hint="The crawler visits your pages like a search engine would and reports every technical and content issue, ranked by severity."
        />
      )}

      {start.isError && <ErrorState message={apiErrorMessage(start.error)} onRetry={run} />}

      {failed && taskId && (
        <ErrorState
          message={s?.error || "The crawl could not be completed. Please try again."}
          onRetry={run}
        />
      )}

      {crawling && taskId && (
        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
            <Radar size={32} className="animate-pulse text-[color:var(--section)]" />
            <p className="text-sm font-medium text-text">Crawling {domain.trim()}…</p>
            <p className="text-sm text-text-muted">
              {s?.pages_crawled != null
                ? `${s.pages_crawled} pages crawled · ${s.pages_in_queue ?? 0} in queue`
                : "Starting the live crawl — fetching your pages now."}
            </p>
            <div className="h-2 w-64 overflow-hidden rounded-full bg-surface-2">
              <div
                className="section-gradient h-full rounded-full transition-all duration-700"
                style={{
                  width: s?.pages_crawled && s.max_crawl_pages
                    ? `${Math.min(100, (s.pages_crawled / s.max_crawl_pages) * 100)}%`
                    : "8%",
                }}
              />
            </div>
          </CardBody>
        </Card>
      )}

      {s && s.progress === "finished" && (
        <div className="animate-fade-rise space-y-5">
          {/* Bento header: health gauge + severity tiles */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
            <Card className="col-span-2 row-span-2 bg-gradient-to-br from-[color:var(--section-soft)] to-surface">
              <CardBody className="flex h-full flex-col items-center justify-center gap-3 py-6">
                <ScoreGauge score={score} label="site health" size={176} />
                {verdict && <Badge tone={verdict.c}>{verdict.t}</Badge>}
                {totalIssues > 0 && (
                  <div className="w-full max-w-[220px]">
                    <div className="flex h-2 overflow-hidden rounded-full bg-surface-2">
                      {s.errors > 0 && <div className="bg-danger" style={{ width: `${(s.errors / totalIssues) * 100}%` }} />}
                      {s.warnings > 0 && <div className="bg-warning" style={{ width: `${(s.warnings / totalIssues) * 100}%` }} />}
                      {s.notices > 0 && <div className="bg-info" style={{ width: `${(s.notices / totalIssues) * 100}%` }} />}
                    </div>
                    <p className="mt-1.5 text-center text-[11px] text-text-muted">{fmtInt(totalIssues)} issues found</p>
                  </div>
                )}
              </CardBody>
            </Card>
            <SeverityCard icon={Bug} tone="danger" label="Errors" value={s.errors} />
            <SeverityCard icon={AlertTriangle} tone="warning" label="Warnings" value={s.warnings} />
            <SeverityCard icon={InfoIcon} tone="info" label="Notices" value={s.notices} />
            <div className="col-span-2 lg:col-span-2">
              <MetricBar
                className="h-full"
                metrics={[
                  { label: "Pages crawled", value: fmtInt(s.pages_crawled) },
                  { label: "HTTPS", value: s.ssl == null ? "—" : s.ssl ? "Yes" : "No", tone: s.ssl ? "success" : "danger" },
                ]}
              />
            </div>
          </div>

          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Issues ({s.issues.length})</CardTitle>
              <ExcelButton filename={`audit-${domain.trim()}`} build={buildExcel} />
            </CardHeader>
            <CardBody className="p-0">
              <DataTable columns={issueCols} rows={s.issues} csvName={`audit-issues-${domain.trim()}`} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Crawled pages — worst first ({s.pages.length})</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              <DataTable columns={pageCols} rows={s.pages} csvName={`audit-pages-${domain.trim()}`} />
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
