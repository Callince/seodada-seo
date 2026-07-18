import { AlertTriangle, CreditCard, Database, RefreshCw, TrendingUp, Users, Wallet } from "lucide-react";

import { useAdminStats, useDfsAccount } from "@/api/hooks/useAdmin";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { MetricCard } from "@/components/shared/MetricCard";
import { TrendChart, SERIES_COLORS } from "@/components/shared/TrendChart";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtInt } from "@/lib/format";
import { fmtDate, inr } from "@/routes/admin/ui";

const STATUS_COLORS: Record<string, string> = {
  paid: "#059669", created: "#F59E0B", failed: "#F43F5E", refunded: "#6366F1",
};

/** DataForSEO bills in USD — distinct from the INR revenue figures elsewhere. */
const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// Runs dry ⇒ every billed feature fails. Warn with plenty of runway left.
const LOW_BALANCE_CENTS = 2000; // $20
const CRITICAL_BALANCE_CENTS = 500; // $5

/** Live DataForSEO credit — the upstream account every billed lookup draws on. */
function DfsAccountCard() {
  const { data, isPending, refetch, isFetching } = useDfsAccount();

  const tone =
    !data || data.error
      ? "text-text"
      : data.balance_cents < CRITICAL_BALANCE_CENTS
        ? "text-danger"
        : data.balance_cents < LOW_BALANCE_CENTS
          ? "text-warning"
          : "text-text";

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <Database size={16} className="text-primary" /> DataForSEO credit
          </span>
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          loading={isFetching}
          aria-label="Refresh balance"
        >
          {!isFetching && <RefreshCw size={14} />} Refresh
        </Button>
      </CardHeader>
      <CardBody>
        {isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : data?.error ? (
          <div className="flex items-start gap-2 text-sm text-danger">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>Couldn't reach DataForSEO — {data.error}</span>
          </div>
        ) : data ? (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-text-muted">Balance</p>
              <p className={`font-mono text-3xl font-extrabold ${tone}`}>{usd(data.balance_cents)}</p>
              {data.balance_cents < LOW_BALANCE_CENTS && (
                <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-warning">
                  <AlertTriangle size={12} /> Low — top up to keep billed lookups working
                </p>
              )}
            </div>
            <div className="flex gap-8 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">Spent all-time</p>
                <p className="font-mono text-text">{usd(data.spent_total_cents)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">Account</p>
                <p className="truncate text-text" title={data.login ?? ""}>{data.login ?? "—"}</p>
              </div>
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

export function OverviewTab() {
  const { data, isPending } = useAdminStats();
  if (isPending || !data) return <Skeleton className="h-48 w-full" />;

  const revenueData = data.revenue_series.map((d) => ({ date: d.date.slice(5), Revenue: Math.round(d.cents / 100) }));
  const signupData = data.signups_series.map((d) => ({ date: d.date.slice(5), Signups: d.count }));
  const statusData = data.payment_status.filter((s) => s.count > 0).map((s) => ({ name: s.status, value: s.count }));
  const maxPlan = Math.max(1, ...data.plan_distribution.map((p) => p.count));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard icon={Users} label="Total users" value={fmtInt(data.total_users)} />
        <MetricCard icon={CreditCard} label="Active subscriptions" value={fmtInt(data.active_subscriptions)} />
        <MetricCard icon={Wallet} label="MRR" value={inr(data.mrr_cents)} />
        <MetricCard icon={TrendingUp} label="Revenue (all-time)" value={inr(data.revenue_cents)} />
      </div>

      <DfsAccountCard />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Revenue — last 30 days (₹)</CardTitle></CardHeader>
          <CardBody>
            {revenueData.length ? (
              <TrendChart data={revenueData} series={[{ key: "Revenue", label: "Revenue (₹)" }]} height={240} />
            ) : <p className="py-16 text-center text-sm text-text-muted">No payments in the last 30 days.</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Payments by status</CardTitle></CardHeader>
          <CardBody>
            {statusData.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2}>
                    {statusData.map((s) => <Cell key={s.name} fill={STATUS_COLORS[s.name] ?? "#94a3b8"} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="py-16 text-center text-sm text-text-muted">No payments yet.</p>}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>New signups — last 30 days</CardTitle></CardHeader>
          <CardBody>
            {signupData.length ? (
              <TrendChart data={signupData} series={[{ key: "Signups", label: "Signups" }]} height={200} />
            ) : <p className="py-12 text-center text-sm text-text-muted">No signups in the last 30 days.</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Plan distribution</CardTitle></CardHeader>
          <CardBody>
            {data.plan_distribution.length ? (
              <div className="space-y-2.5">
                {data.plan_distribution.map((p, i) => (
                  <div key={p.plan}>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-muted">{p.plan}</span>
                      <span className="font-medium">{p.count}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-app-bg">
                      <div className="h-full rounded-full" style={{ width: `${(p.count / maxPlan) * 100}%`, background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-text-muted">No active subscriptions yet.</p>}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent signups</CardTitle></CardHeader>
        <CardBody>
          {data.recent_signups.map((u) => (
            <div key={u.email} className="flex justify-between border-b border-border/60 py-2 text-sm last:border-0">
              <span className="truncate text-text">{u.email}</span>
              <span className="text-text-muted">{fmtDate(u.created_at)}</span>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
