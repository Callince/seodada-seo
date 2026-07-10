import { Download, RefreshCw } from "lucide-react";
import { useState } from "react";

import { apiErrorMessage } from "@/api/client";
import { downloadAdminFile, useEmailLogs, useRetryEmail, type EmailLog } from "@/api/hooks/useAdmin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/store/toast";
import { fmtDateTime, Modal, MiniStats } from "@/routes/admin/ui";

export function EmailsTab() {
  const [type, setType] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");
  const [days, setDays] = useState(90);
  const filters = { type_filter: type || undefined, status_filter: statusFilter || undefined, q: q || undefined, days };
  const { data, isPending } = useEmailLogs(filters);
  const retry = useRetryEmail();
  const [open, setOpen] = useState<EmailLog | null>(null);

  return (
    <div className="space-y-4">
      <MiniStats
        items={[
          { label: "Total", value: data?.total ?? "—" },
          { label: "Sent", value: data?.sent_count ?? "—", accent: true },
          { label: "Failed", value: data?.failed_count ?? "—" },
          { label: "Today", value: data?.today_count ?? "—" },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {(data?.types ?? []).map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </Select>
        <Select value={String(days)} onChange={(e) => setDays(Number(e.target.value))}>
          <option value="7">7 days</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
          <option value="365">1 year</option>
        </Select>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search recipient or subject…" className="max-w-xs" />
        <div className="ml-auto">
          <Button variant="secondary" onClick={() => downloadAdminFile("/admin/email-logs/export", "email-logs.csv", filters)}>
            <Download size={14} /> Export CSV
          </Button>
        </div>
      </div>

      {isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
                  <th className="py-2 pl-4 pr-4">Recipient</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Subject</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Sent</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-2.5 pl-4 pr-4">
                      <button className="text-left hover:text-primary" onClick={() => setOpen(r)}>{r.to_email}</button>
                    </td>
                    <td className="py-2.5 pr-4 text-text-muted">{r.email_type}</td>
                    <td className="max-w-xs truncate py-2.5 pr-4">{r.subject}</td>
                    <td className="py-2.5 pr-4"><Badge tone={r.status === "sent" ? "success" : "danger"}>{r.status}</Badge></td>
                    <td className="py-2.5 pr-4 text-text-muted">{fmtDateTime(r.created_at)}</td>
                    <td className="py-2.5 pr-4 text-right">
                      {r.status === "failed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={retry.isPending}
                          onClick={() =>
                            retry.mutate(r.id, {
                              onSuccess: () => toast.success("Retry sent"),
                              onError: (e) => toast.error(apiErrorMessage(e)),
                            })
                          }
                        >
                          <RefreshCw size={13} /> Retry
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {!data?.items.length && (
                  <tr><td colSpan={6} className="py-8 text-center text-text-muted">No emails logged in this window.</td></tr>
                )}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {open && (
        <Modal title="Email log" onClose={() => setOpen(null)}>
          <dl className="space-y-2 text-sm">
            <Row k="To" v={`${open.to_name ? open.to_name + " · " : ""}${open.to_email}`} />
            <Row k="Type" v={open.email_type} />
            <Row k="Subject" v={open.subject} />
            <Row k="Status" v={open.status} />
            <Row k="Sent" v={fmtDateTime(open.created_at)} />
            {open.error && <Row k="Error" v={open.error} />}
          </dl>
        </Modal>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3 border-b border-border/60 py-1.5 last:border-0">
      <dt className="w-24 shrink-0 text-text-muted">{k}</dt>
      <dd className="break-words text-text">{v}</dd>
    </div>
  );
}
