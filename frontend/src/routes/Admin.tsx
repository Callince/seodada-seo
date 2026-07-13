import {
  CreditCard, Download, Eye, KeyRound, Pencil, Plus, ShieldCheck, Trash2, TrendingUp, Users, Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";

import { apiErrorMessage } from "@/api/client";
import {
  downloadAdminFile,
  useAdminBlogs,
  useAdminBlogCategories,
  useAdminPayments,
  useAdminPlans,
  useAdminStats,
  useAdminSubscriptions,
  useAdminUpdateUser,
  useAdminUsers,
  useAdminWebstories,
  useArchivePlan,
  useAssignSubscription,
  useCreateCategory,
  useCreatePlan,
  useCreateUser,
  useDeleteCategory,
  useDeleteContent,
  useDeleteUser,
  useExtendSubscription,
  useRefundPayment,
  useResetUserPassword,
  useSetContentStatus,
  useSetPaymentStatus,
  useSetSubscriptionStatus,
  useUpdateCategory,
  useUpdatePlan,
  useUpdateSettings,
  useUserDetail,
  useWebsiteSettings,
  type AdminPlan,
  type WebsiteSettings,
} from "@/api/hooks/useAdmin";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { DataTable, type Column } from "@/components/shared/DataTable";
import { MetricCard } from "@/components/shared/MetricCard";
import { StatCard } from "@/components/shared/StatCard";
import { TrendChart, SERIES_COLORS } from "@/components/shared/TrendChart";
import { ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtCents, fmtInt } from "@/lib/format";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { BlogEditor } from "@/routes/admin/tabs/BlogEditor";
import { WebStoryEditor } from "@/routes/admin/tabs/WebStoryEditor";
import { Field, Modal, ModalActions, fmtDate, fmtDateTime, inr } from "@/routes/admin/ui";
import type { AdminUser } from "@/types";

// ============================================================ Users tab

const buildColumns = (
  onEdit: (u: AdminUser) => void,
  onView: (u: AdminUser) => void,
  onReset: (u: AdminUser) => void,
  onDelete: (u: AdminUser) => void,
  meId: string | undefined,
): Column<AdminUser>[] => [
  {
    key: "email",
    header: "User",
    sortValue: (r) => r.email,
    render: (r) => (
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate font-medium text-text">
          {r.email}
          {r.is_admin && (
            <Badge tone="info">
              <ShieldCheck size={11} /> admin
            </Badge>
          )}
          {!r.is_active && <Badge tone="danger">disabled</Badge>}
        </p>
        <p className="truncate text-xs text-text-muted">{r.full_name || "—"}</p>
      </div>
    ),
    csvValue: (r) => r.email,
  },
  { key: "org_name", header: "Organization", sortValue: (r) => r.org_name },
  { key: "role", header: "Role", sortValue: (r) => r.role, render: (r) => <span className="capitalize">{r.role}</span> },
  {
    key: "total_cents", header: "Spend (total)", align: "right", mono: true,
    sortValue: (r) => r.total_cents,
    render: (r) => <span className="font-semibold">{fmtCents(r.total_cents)}</span>,
    csvValue: (r) => (r.total_cents / 100).toFixed(2),
  },
  { key: "calls", header: "API calls", align: "right", mono: true, sortValue: (r) => r.calls, render: (r) => fmtInt(r.calls) },
  {
    key: "last_active", header: "Last active", sortValue: (r) => r.last_active ?? "",
    render: (r) => <span className="text-text-muted">{fmtDate(r.last_active)}</span>, csvValue: (r) => r.last_active,
  },
  {
    key: "actions", header: "",
    render: (r) => (
      <div className="flex justify-end gap-0.5">
        <Button variant="ghost" size="icon" onClick={() => onView(r)} aria-label={`View ${r.email}`}><Eye size={14} /></Button>
        <Button variant="ghost" size="icon" onClick={() => onEdit(r)} aria-label={`Edit ${r.email}`}><Pencil size={14} /></Button>
        <Button variant="ghost" size="icon" onClick={() => onReset(r)} aria-label={`Reset password for ${r.email}`}><KeyRound size={14} /></Button>
        {r.id !== meId && (
          <Button variant="ghost" size="icon" onClick={() => onDelete(r)} aria-label={`Delete ${r.email}`}>
            <Trash2 size={14} className="text-danger" />
          </Button>
        )}
      </div>
    ),
    csvValue: () => null,
  },
];

function EditUserModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const update = useAdminUpdateUser();
  const me = useAuth((s) => s.user);
  const [form, setForm] = useState({
    full_name: user.full_name, role: user.role as "member" | "owner",
    password: "", is_active: user.is_active, org_name: user.org_name,
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal title={`Edit ${user.email}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate(
            {
              id: user.id, full_name: form.full_name.trim(), role: form.role, is_active: form.is_active,
              ...(form.password ? { password: form.password } : {}),
              ...(form.org_name.trim() && form.org_name.trim() !== user.org_name ? { org_name: form.org_name.trim() } : {}),
            },
            { onSuccess: () => { toast.success(`${user.email} updated`); onClose(); }, onError: (err) => toast.error(apiErrorMessage(err)) },
          );
        }}
        className="space-y-3"
      >
        <Field label="Full name"><Input value={form.full_name} onChange={set("full_name")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role">
            <Select value={form.role} onChange={set("role")} className="w-full">
              <option value="member">Member</option>
              <option value="owner">Owner</option>
            </Select>
          </Field>
          <Field label="Organization"><Input value={form.org_name} onChange={set("org_name")} /></Field>
        </div>
        <Field label="New password (blank = keep)">
          <Input type="password" value={form.password} onChange={set("password")} minLength={8} placeholder="••••••••" autoComplete="new-password" />
        </Field>
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={form.is_active} disabled={user.id === me?.id}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" />
          Account active
        </label>
        <ModalActions onClose={onClose} loading={update.isPending} label="Save changes" />
      </form>
    </Modal>
  );
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const create = useCreateUser();
  const [f, setF] = useState({ email: "", password: "", full_name: "", role: "owner", org_name: "" });
  return (
    <Modal title="Add user" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(
            { email: f.email.trim(), password: f.password, full_name: f.full_name.trim(), role: f.role, org_name: f.org_name.trim() },
            { onSuccess: () => { toast.success("User created"); onClose(); }, onError: (err) => toast.error(apiErrorMessage(err)) },
          );
        }}
      >
        <Field label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
        <Field label="Password"><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} minLength={8} required autoComplete="new-password" /></Field>
        <Field label="Full name"><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role">
            <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} className="w-full">
              <option value="owner">Owner</option>
              <option value="member">Member</option>
            </Select>
          </Field>
          <Field label="Organization (blank = yours)"><Input value={f.org_name} onChange={(e) => setF({ ...f, org_name: e.target.value })} /></Field>
        </div>
        <ModalActions onClose={onClose} loading={create.isPending} label="Create user" />
      </form>
    </Modal>
  );
}

function UserDetailModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const { data, isPending } = useUserDetail(user.id);
  return (
    <Modal title={user.email} onClose={onClose} wide>
      {isPending || !data ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Spend (total)" value={fmtCents(data.total_cents)} />
            <StatCard label="Spend (month)" value={fmtCents(data.month_cents)} accent />
            <StatCard label="API calls" value={fmtInt(data.calls)} />
            <StatCard label="Org" value={data.org_name} />
          </div>
          <Section title={`Subscriptions (${data.subscriptions.length})`}>
            {data.subscriptions.map((s) => (
              <Line key={s.id} left={s.plan_name} mid={<Badge tone={s.status === "active" ? "success" : "neutral"}>{s.status}</Badge>} right={`renews ${fmtDate(s.current_period_end)}`} />
            ))}
          </Section>
          <Section title={`Payments (${data.payments.length})`}>
            {data.payments.map((p) => (
              <Line key={p.id} left={p.invoice_number || p.id.slice(0, 8)} mid={inr(p.amount_cents)} right={`${p.status} · ${fmtDate(p.created_at)}`} />
            ))}
          </Section>
          <Section title="Recent activity">
            {data.recent_usage.map((u, i) => (
              <Line key={i} left={<span className="font-mono text-xs">{u.endpoint}</span>} mid={u.from_cache ? "cache" : fmtCents(u.cost_cents)} right={fmtDateTime(u.created_at)} />
            ))}
          </Section>
        </div>
      )}
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</p>
      {items.filter(Boolean).length ? <div className="rounded-lg border border-border">{children}</div> : <p className="text-text-muted">None.</p>}
    </div>
  );
}

function Line({ left, mid, right }: { left: React.ReactNode; mid: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2 last:border-0">
      <span className="min-w-0 flex-1 truncate text-text">{left}</span>
      <span className="text-text-muted">{mid}</span>
      <span className="shrink-0 text-xs text-text-muted">{right}</span>
    </div>
  );
}

export function UsersTab() {
  const { data, isPending, isError, error, refetch } = useAdminUsers();
  const me = useAuth((s) => s.user);
  const reset = useResetUserPassword();
  const del = useDeleteUser();
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [viewing, setViewing] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [resetPw, setResetPw] = useState<{ email: string; pw: string } | null>(null);

  if (isPending) return <Skeleton className="h-64 w-full" />;
  if (isError) return <ErrorState message={apiErrorMessage(error)} onRetry={() => refetch()} />;

  const onReset = (u: AdminUser) => {
    if (!confirm(`Reset ${u.email}'s password? Their current password stops working.`)) return;
    reset.mutate(u.id, {
      onSuccess: (r) => setResetPw({ email: u.email, pw: r.password }),
      onError: (e) => toast.error(apiErrorMessage(e)),
    });
  };
  const onDelete = (u: AdminUser) => {
    if (!confirm(`Delete ${u.email}? This removes the account and its usage log.`)) return;
    del.mutate(u.id, { onSuccess: () => toast.success("User deleted"), onError: (e) => toast.error(apiErrorMessage(e)) });
  };

  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard icon={Users} label="Users" value={fmtInt(data.users.length)} />
        <MetricCard icon={Wallet} label="Spend this month" value={fmtCents(data.total_month_cents)} />
        <MetricCard icon={TrendingUp} label="Spend all time" value={fmtCents(data.total_cents)} />
      </div>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setCreating(true)}><Plus size={15} /> Add user</Button>
      </div>
      <Card>
        <CardBody className="p-0">
          <DataTable columns={buildColumns(setEditing, setViewing, onReset, onDelete, me?.id)} rows={data.users} csvName="admin-users" />
        </CardBody>
      </Card>
      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} />}
      {viewing && <UserDetailModal user={viewing} onClose={() => setViewing(null)} />}
      {creating && <CreateUserModal onClose={() => setCreating(false)} />}
      {resetPw && (
        <Modal title="New password" onClose={() => setResetPw(null)}>
          <p className="text-sm text-text-muted">Share this once with <strong className="text-text">{resetPw.email}</strong> — it is not stored in readable form.</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-border bg-app-bg px-3 py-2 font-mono text-sm">{resetPw.pw}</code>
            <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(resetPw.pw); toast.success("Copied"); }}>Copy</Button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ============================================================ Overview tab

const STATUS_COLORS: Record<string, string> = {
  paid: "#059669", created: "#F59E0B", failed: "#F43F5E", refunded: "#6366F1",
};

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

// ============================================================ Plans tab

function PlanModal({ plan, onClose }: { plan: AdminPlan | null; onClose: () => void }) {
  const create = useCreatePlan();
  const update = useUpdatePlan();
  const [f, setF] = useState({
    name: plan?.name ?? "", price_cents: plan?.price_cents ?? 0, period_days: plan?.period_days ?? 30,
    usage_per_day: plan?.usage_per_day ?? 30, tier: plan?.tier ?? 1,
    features: (plan?.features ?? []).join("\n"), is_active: plan?.is_active ?? true,
  });
  const busy = create.isPending || update.isPending;
  return (
    <Modal title={plan ? `Edit ${plan.name}` : "New plan"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const body = {
            name: f.name.trim(), price_cents: Number(f.price_cents), period_days: Number(f.period_days),
            usage_per_day: Number(f.usage_per_day), tier: Number(f.tier), is_active: f.is_active,
            features: f.features.split("\n").map((s) => s.trim()).filter(Boolean),
          };
          const opts = { onSuccess: () => { toast.success("Plan saved"); onClose(); }, onError: (e2: unknown) => toast.error(apiErrorMessage(e2)) };
          if (plan) update.mutate({ id: plan.id, ...body }, opts);
          else create.mutate(body, opts);
        }}
        className="space-y-3"
      >
        <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (paise, ₹1 = 100)"><Input type="number" value={f.price_cents} onChange={(e) => setF({ ...f, price_cents: +e.target.value })} /></Field>
          <Field label="Period (days)"><Input type="number" value={f.period_days} onChange={(e) => setF({ ...f, period_days: +e.target.value })} /></Field>
          <Field label="Analyses / day"><Input type="number" value={f.usage_per_day} onChange={(e) => setF({ ...f, usage_per_day: +e.target.value })} /></Field>
          <Field label="Tier"><Input type="number" value={f.tier} onChange={(e) => setF({ ...f, tier: +e.target.value })} /></Field>
        </div>
        <Field label="Features (one per line)">
          <textarea value={f.features} onChange={(e) => setF({ ...f, features: e.target.value })} rows={4}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-[color:var(--section)] focus:outline-none" />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} className="h-4 w-4 accent-[var(--primary)]" />
          Active (available for purchase)
        </label>
        <ModalActions onClose={onClose} loading={busy} label="Save plan" />
      </form>
    </Modal>
  );
}

export function PlansTab() {
  const { data, isPending } = useAdminPlans();
  const archive = useArchivePlan();
  const [editing, setEditing] = useState<AdminPlan | null | "new">(null);
  if (isPending) return <Skeleton className="h-64 w-full" />;
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus size={15} /> Add plan
        </Button>
      </div>
      <Card>
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
                <th className="py-2 pr-4">Plan</th><th className="py-2 pr-4">Price</th>
                <th className="py-2 pr-4">Period</th><th className="py-2 pr-4">Usage/day</th>
                <th className="py-2 pr-4">Tier</th><th className="py-2 pr-4">Status</th><th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((p) => (
                <tr key={p.id} className="border-b border-border/60">
                  <td className="py-2.5 pr-4 font-medium">{p.name}</td>
                  <td className="py-2.5 pr-4">{inr(p.price_cents)}</td>
                  <td className="py-2.5 pr-4 text-text-muted">{p.period_days}d</td>
                  <td className="py-2.5 pr-4">{p.usage_per_day}</td>
                  <td className="py-2.5 pr-4">{p.tier}</td>
                  <td className="py-2.5 pr-4"><Badge tone={p.is_active ? "success" : "neutral"}>{p.is_active ? "active" : "archived"}</Badge></td>
                  <td className="py-2.5 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(p)}><Pencil size={14} /></Button>
                    {p.is_active && (
                      <Button variant="ghost" size="sm" onClick={() => archive.mutate(p.id)} aria-label="Archive">
                        <Trash2 size={14} className="text-danger" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
      {editing !== null && <PlanModal plan={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

// ============================================================ Billing tab

function AssignSubModal({ onClose }: { onClose: () => void }) {
  const assign = useAssignSubscription();
  const { data: plans } = useAdminPlans();
  const [f, setF] = useState({ org_name: "", plan_id: "", days: "" });
  return (
    <Modal title="Assign subscription" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          assign.mutate(
            { org_name: f.org_name.trim(), plan_id: f.plan_id, ...(f.days ? { days: Number(f.days) } : {}) },
            { onSuccess: () => { toast.success("Subscription assigned"); onClose(); }, onError: (err) => toast.error(apiErrorMessage(err)) },
          );
        }}
      >
        <Field label="Organization name"><Input value={f.org_name} onChange={(e) => setF({ ...f, org_name: e.target.value })} required /></Field>
        <Field label="Plan">
          <Select value={f.plan_id} onChange={(e) => setF({ ...f, plan_id: e.target.value })} className="w-full" required>
            <option value="">Select a plan…</option>
            {(plans ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} — {inr(p.price_cents)}</option>)}
          </Select>
        </Field>
        <Field label="Days (blank = plan period)"><Input type="number" value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} placeholder="30" /></Field>
        <ModalActions onClose={onClose} loading={assign.isPending} label="Assign" />
      </form>
    </Modal>
  );
}

function RefundModal({ paymentId, max, onClose }: { paymentId: string; max: number; onClose: () => void }) {
  const refund = useRefundPayment();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  return (
    <Modal title="Refund payment" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          refund.mutate(
            { id: paymentId, ...(amount ? { amount_cents: Number(amount) } : {}), reason },
            { onSuccess: () => { toast.success("Refund issued"); onClose(); }, onError: (err) => toast.error(apiErrorMessage(err)) },
          );
        }}
      >
        <p className="text-sm text-text-muted">Full amount: {inr(max)}. Leave blank for a full refund, or enter a partial amount in paise.</p>
        <Field label="Partial amount (paise)"><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(max)} max={max} /></Field>
        <Field label="Reason (optional)"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <ModalActions onClose={onClose} loading={refund.isPending} label="Issue refund" />
      </form>
    </Modal>
  );
}

export function BillingTab() {
  const { data: subs } = useAdminSubscriptions();
  const { data: pays } = useAdminPayments();
  const extend = useExtendSubscription();
  const setSubStatus = useSetSubscriptionStatus();
  const setPayStatus = useSetPaymentStatus();
  const [assign, setAssign] = useState(false);
  const [refunding, setRefunding] = useState<{ id: string; max: number } | null>(null);

  const onExtend = (id: string) => {
    const days = prompt("Extend by how many days?", "30");
    if (!days) return;
    extend.mutate({ id, days: Number(days) }, { onSuccess: () => toast.success("Extended"), onError: (e) => toast.error(apiErrorMessage(e)) });
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Subscriptions</CardTitle>
          <Button size="sm" onClick={() => setAssign(true)}><Plus size={14} /> Assign</Button>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          {subs?.length ? (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
                <th className="py-2 pr-4">Organization</th><th className="py-2 pr-4">Plan</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Renews</th><th className="py-2"></th>
              </tr></thead>
              <tbody>{subs.map((s) => (
                <tr key={s.id} className="border-b border-border/60">
                  <td className="py-2.5 pr-4">{s.org_name}</td><td className="py-2.5 pr-4">{s.plan_name}</td>
                  <td className="py-2.5 pr-4"><Badge tone={s.status === "active" ? "success" : "neutral"}>{s.status}</Badge></td>
                  <td className="py-2.5 pr-4 text-text-muted">{fmtDate(s.current_period_end)}</td>
                  <td className="py-2.5 text-right">
                    <Button variant="ghost" size="sm" onClick={() => onExtend(s.id)}>Extend</Button>
                    {s.status === "active" ? (
                      <Button variant="ghost" size="sm" onClick={() => setSubStatus.mutate({ id: s.id, status: "cancelled" })}>Cancel</Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setSubStatus.mutate({ id: s.id, status: "active" })}>Reactivate</Button>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          ) : <p className="text-sm text-text-muted">No subscriptions yet.</p>}
        </CardBody>
      </Card>
      <Card>
        <CardHeader><CardTitle>Payments</CardTitle></CardHeader>
        <CardBody className="overflow-x-auto">
          {pays?.length ? (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
                <th className="py-2 pr-4">Invoice</th><th className="py-2 pr-4">Organization</th><th className="py-2 pr-4">Amount</th><th className="py-2 pr-4">GST</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Date</th><th className="py-2"></th>
              </tr></thead>
              <tbody>{pays.map((p) => (
                <tr key={p.id} className="border-b border-border/60">
                  <td className="py-2.5 pr-4 font-mono text-xs">{p.invoice_number || "—"}</td>
                  <td className="py-2.5 pr-4">{p.org_name}</td>
                  <td className="py-2.5 pr-4 font-medium">{inr(p.amount_cents)}</td>
                  <td className="py-2.5 pr-4 text-text-muted">{inr(p.tax_cents)}</td>
                  <td className="py-2.5 pr-4">
                    <Select
                      value={p.status}
                      onChange={(e) => setPayStatus.mutate({ id: p.id, status: e.target.value }, { onError: (er) => toast.error(apiErrorMessage(er)) })}
                      className="h-7 py-0 text-xs"
                    >
                      <option value="created">created</option>
                      <option value="paid">paid</option>
                      <option value="failed">failed</option>
                      <option value="refunded">refunded</option>
                    </Select>
                  </td>
                  <td className="py-2.5 pr-4 text-text-muted">{fmtDate(p.created_at)}</td>
                  <td className="py-2.5 text-right">
                    <Button variant="ghost" size="icon" aria-label="Download invoice"
                      onClick={() => downloadAdminFile(`/admin/payments/${p.id}/invoice`, `${p.invoice_number || p.id.slice(0, 8)}.pdf`)}>
                      <Download size={14} />
                    </Button>
                    {p.status === "paid" && (
                      <Button variant="ghost" size="sm" onClick={() => setRefunding({ id: p.id, max: p.amount_cents })}>Refund</Button>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          ) : <p className="text-sm text-text-muted">No payments yet.</p>}
        </CardBody>
      </Card>
      {assign && <AssignSubModal onClose={() => setAssign(false)} />}
      {refunding && <RefundModal paymentId={refunding.id} max={refunding.max} onClose={() => setRefunding(null)} />}
    </div>
  );
}

// ============================================================ Settings tab

export function SettingsTab() {
  const { data } = useWebsiteSettings();
  const update = useUpdateSettings();
  const [form, setForm] = useState<WebsiteSettings | null>(null);
  useEffect(() => { if (data && !form) setForm(data); }, [data, form]);
  if (!form) return <Skeleton className="h-64 w-full" />;
  const set = (k: keyof WebsiteSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });
  return (
    <Card>
      <CardHeader><CardTitle>Website settings</CardTitle></CardHeader>
      <CardBody>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate(form, { onSuccess: () => toast.success("Settings saved"), onError: (er) => toast.error(apiErrorMessage(er)) });
          }}
        >
          <Field label="Company name"><Input value={form.company_name} onChange={set("company_name")} /></Field>
          <Field label="Support email"><Input value={form.support_email} onChange={set("support_email")} /></Field>
          <Field label="Tagline"><Input value={form.tagline} onChange={set("tagline")} /></Field>
          <Field label="Logo URL"><Input value={form.logo_url} onChange={set("logo_url")} /></Field>
          <Field label="Favicon URL"><Input value={form.favicon_url} onChange={set("favicon_url")} /></Field>
          <Field label="Facebook URL"><Input value={form.facebook_url} onChange={set("facebook_url")} /></Field>
          <Field label="LinkedIn URL"><Input value={form.linkedin_url} onChange={set("linkedin_url")} /></Field>
          <Field label="Instagram URL"><Input value={form.instagram_url} onChange={set("instagram_url")} /></Field>
          <Field label="YouTube URL"><Input value={form.youtube_url} onChange={set("youtube_url")} /></Field>
          <div className="sm:col-span-2">
            <Button type="submit" loading={update.isPending}>
              Save settings
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

// ============================================================ Content tab

function CategoriesCard() {
  const { data } = useAdminBlogCategories();
  const create = useCreateCategory();
  const upd = useUpdateCategory();
  const del = useDeleteCategory();
  const [name, setName] = useState("");
  return (
    <Card>
      <CardHeader><CardTitle>Blog categories</CardTitle></CardHeader>
      <CardBody>
        <form
          className="mb-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            create.mutate({ name: name.trim() }, { onSuccess: () => { setName(""); toast.success("Category added"); }, onError: (er) => toast.error(apiErrorMessage(er)) });
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category name" />
          <Button type="submit" loading={create.isPending}><Plus size={14} /> Add</Button>
        </form>
        <div className="divide-y divide-border/60">
          {(data ?? []).map((c) => (
            <div key={c.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-text">{c.name} <span className="text-text-muted">/{c.slug}</span></span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => {
                  const nn = prompt("Rename category", c.name);
                  if (nn && nn.trim()) upd.mutate({ id: c.id, name: nn.trim() }, { onError: (er) => toast.error(apiErrorMessage(er)) });
                }}><Pencil size={13} /></Button>
                <Button variant="ghost" size="sm" onClick={() => {
                  if (confirm(`Delete category "${c.name}"?`)) del.mutate(c.id, { onError: (er) => toast.error(apiErrorMessage(er)) });
                }}><Trash2 size={13} className="text-danger" /></Button>
              </div>
            </div>
          ))}
          {!data?.length && <p className="py-2 text-sm text-text-muted">No categories yet.</p>}
        </div>
      </CardBody>
    </Card>
  );
}

function BlogsCard() {
  const { data: blogs, isPending } = useAdminBlogs();
  const setStatus = useSetContentStatus("blogs");
  const del = useDeleteContent("blogs");
  const [editorId, setEditorId] = useState<string | null | "new">(null);
  if (isPending) return <Skeleton className="h-48 w-full" />;
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Blog posts ({blogs?.length ?? 0})</CardTitle>
        <Button size="sm" onClick={() => setEditorId("new")}><Plus size={14} /> New post</Button>
      </CardHeader>
      <CardBody className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
              <th className="py-2 pl-4 pr-4">Title</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Published</th><th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {(blogs ?? []).map((r) => (
              <tr key={r.id} className="border-b border-border/60">
                <td className="max-w-xs truncate py-2.5 pl-4 pr-4">
                  <button className="font-medium text-text hover:text-[color:var(--section)]" onClick={() => setEditorId(r.id)}>{r.title}</button>
                </td>
                <td className="py-2.5 pr-4"><Badge tone={r.status === "published" ? "success" : "neutral"}>{r.status}</Badge></td>
                <td className="py-2.5 pr-4 text-text-muted">{fmtDate(r.published_at)}</td>
                <td className="py-2.5 pr-4 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setEditorId(r.id)}><Pencil size={13} /></Button>
                  <Button variant="ghost" size="sm" disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ id: r.id, status: r.status === "published" ? "draft" : "published" })}>
                    {r.status === "published" ? "Unpublish" : "Publish"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete "${r.title}"?`)) del.mutate(r.id); }} aria-label="Delete">
                    <Trash2 size={13} className="text-danger" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
      {editorId !== null && <BlogEditor blogId={editorId === "new" ? null : editorId} onClose={() => setEditorId(null)} />}
    </Card>
  );
}

function WebStoriesCard() {
  const { data: stories, isPending } = useAdminWebstories();
  const setStatus = useSetContentStatus("webstories");
  const del = useDeleteContent("webstories");
  const [editorId, setEditorId] = useState<string | null | "new">(null);
  if (isPending) return <Skeleton className="h-48 w-full" />;
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Web stories ({stories?.length ?? 0})</CardTitle>
        <Button size="sm" onClick={() => setEditorId("new")}><Plus size={14} /> New story</Button>
      </CardHeader>
      <CardBody className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
              <th className="py-2 pl-4 pr-4">Title</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Published</th><th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {(stories ?? []).map((r) => (
              <tr key={r.id} className="border-b border-border/60">
                <td className="max-w-xs truncate py-2.5 pl-4 pr-4">
                  <button className="font-medium text-text hover:text-[color:var(--section)]" onClick={() => setEditorId(r.id)}>{r.title}</button>
                </td>
                <td className="py-2.5 pr-4"><Badge tone={r.status === "published" ? "success" : "neutral"}>{r.status}</Badge></td>
                <td className="py-2.5 pr-4 text-text-muted">{fmtDate(r.published_at)}</td>
                <td className="py-2.5 pr-4 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setEditorId(r.id)}><Pencil size={13} /></Button>
                  <Button variant="ghost" size="sm" disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ id: r.id, status: r.status === "published" ? "draft" : "published" })}>
                    {r.status === "published" ? "Unpublish" : "Publish"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete "${r.title}"?`)) del.mutate(r.id); }} aria-label="Delete">
                    <Trash2 size={13} className="text-danger" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
      {editorId !== null && <WebStoryEditor storyId={editorId === "new" ? null : editorId} onClose={() => setEditorId(null)} />}
    </Card>
  );
}

export function ContentTab() {
  return (
    <div className="space-y-5">
      <CategoriesCard />
      <BlogsCard />
      <WebStoriesCard />
    </div>
  );
}

