import { Download } from "lucide-react";
import { useState } from "react";

import { downloadAdminFile, useUsageHistory } from "@/api/hooks/useAdmin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtCents } from "@/lib/format";
import { fmtDateTime, MiniStats } from "@/routes/admin/ui";

export function UsageTab() {
  const [user, setUser] = useState("");
  const [tool, setTool] = useState("");
  const [days, setDays] = useState(30);
  const filters = { user: user || undefined, tool: tool || undefined, days };
  const { data, isPending } = useUsageHistory(filters);

  return (
    <div className="space-y-4">
      <MiniStats
        items={[
          { label: "Events", value: data?.total ?? "—" },
          { label: "Billed", value: data?.billed_count ?? "—", accent: true },
          { label: "From cache", value: data?.cached_count ?? "—" },
          { label: "Spend", value: data ? fmtCents(data.total_cost_cents) : "—" },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Select value={tool} onChange={(e) => setTool(e.target.value)}>
          <option value="">All tools</option>
          {(data?.tools ?? []).map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Select value={String(days)} onChange={(e) => setDays(Number(e.target.value))}>
          <option value="7">7 days</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
          <option value="365">1 year</option>
        </Select>
        <Input value={user} onChange={(e) => setUser(e.target.value)} placeholder="Filter by user email…" className="max-w-xs" />
        <div className="ml-auto">
          <Button variant="secondary" onClick={() => downloadAdminFile("/admin/usage-history/export", "usage-history.csv", filters)}>
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
                  <th className="py-2 pl-4 pr-4">User</th>
                  <th className="py-2 pr-4">Organization</th>
                  <th className="py-2 pr-4">Tool</th>
                  <th className="py-2 pr-4 text-right">Cost</th>
                  <th className="py-2 pr-4">Source</th>
                  <th className="py-2 pr-4">When</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-2.5 pl-4 pr-4 text-text">{r.user_email}</td>
                    <td className="py-2.5 pr-4 text-text-muted">{r.org_name}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs">{r.endpoint}</td>
                    <td className="py-2.5 pr-4 text-right font-mono">{fmtCents(r.cost_cents)}</td>
                    <td className="py-2.5 pr-4">
                      <Badge tone={r.from_cache ? "neutral" : "info"}>{r.from_cache ? "cache" : "billed"}</Badge>
                    </td>
                    <td className="py-2.5 pr-4 text-text-muted">{fmtDateTime(r.created_at)}</td>
                  </tr>
                ))}
                {!data?.items.length && (
                  <tr><td colSpan={6} className="py-8 text-center text-text-muted">No usage in this window.</td></tr>
                )}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
