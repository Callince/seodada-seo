import { AlertTriangle, Bug, Info as InfoIcon, Radar } from "lucide-react";
import { useState } from "react";

import { apiErrorMessage } from "@/api/client";
import { useAuditStatus, useStartAudit } from "@/api/hooks/useAudit";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { MetricBar } from "@/components/shared/MetricBar";
import { ScoreGauge } from "@/components/shared/ScoreGauge";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
              <CardBody className="flex h-full items-center justify-center py-6">
                <ScoreGauge score={s.onpage_score == null ? null : Math.round(s.onpage_score)} label="site health" size={190} />
              </CardBody>
            </Card>
            <Card className="lg:col-span-2">
              <CardBody className="flex h-full items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-danger/10 text-danger"><Bug size={19} /></span>
                <div>
                  <p className="text-xs uppercase tracking-wide text-text-muted">Errors</p>
                  <p className="font-mono text-2xl text-danger">{fmtInt(s.errors)}</p>
                </div>
              </CardBody>
            </Card>
            <Card className="lg:col-span-2">
              <CardBody className="flex h-full items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-warning/10 text-warning"><AlertTriangle size={19} /></span>
                <div>
                  <p className="text-xs uppercase tracking-wide text-text-muted">Warnings</p>
                  <p className="font-mono text-2xl text-warning">{fmtInt(s.warnings)}</p>
                </div>
              </CardBody>
            </Card>
            <Card className="lg:col-span-2">
              <CardBody className="flex h-full items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-info/10 text-info"><InfoIcon size={19} /></span>
                <div>
                  <p className="text-xs uppercase tracking-wide text-text-muted">Notices</p>
                  <p className="font-mono text-2xl text-info">{fmtInt(s.notices)}</p>
                </div>
              </CardBody>
            </Card>
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
            <CardHeader>
              <CardTitle>Issues ({s.issues.length})</CardTitle>
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
