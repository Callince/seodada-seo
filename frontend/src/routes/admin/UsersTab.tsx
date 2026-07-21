import {
  Eye, KeyRound, Pencil, Plus, ShieldCheck, Trash2, TrendingUp, Users, Wallet,
} from "lucide-react";
import { useState } from "react";

import { apiErrorMessage } from "@/api/client";
import {
  useAdminUpdateUser,
  useAdminUsers,
  useCreateUser,
  useDeleteUser,
  useResetUserPassword,
  useUserDetail,
} from "@/api/hooks/useAdmin";

import { DataTable, type Column } from "@/components/shared/DataTable";
import { MetricCard } from "@/components/shared/MetricCard";
import { StatCard } from "@/components/shared/StatCard";
import { ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtInt } from "@/lib/format";
import { useUsdToInr } from "@/lib/currency";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { Line, Section } from "@/routes/admin/shared";
import { Field, Modal, ModalActions, fmtDate, fmtDateTime, inr } from "@/routes/admin/ui";
import type { AdminUser } from "@/types";

const buildColumns = (
  /** USD cents -> INR. Passed in rather than imported: buildColumns is a plain
   *  function, so it cannot call the hook that reads the live rate. */
  inrFromUsd: (usdCents: number | null | undefined) => string,
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
          {r.unlimited_usage && !r.is_admin && <Badge tone="success">∞ unlimited</Badge>}
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
    render: (r) => <span className="font-semibold">{inrFromUsd(r.total_cents)}</span>,
    // Same currency as the rendered cell: a CSV that exported USD under a
    // column showing rupees would be silently ~96x off in any spreadsheet.
    csvValue: (r) => inrFromUsd(r.total_cents).replace(/[^\d.]/g, ""),
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
    unlimited_usage: user.unlimited_usage,
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
              unlimited_usage: form.unlimited_usage,
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
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={form.unlimited_usage}
            onChange={(e) => setForm((f) => ({ ...f, unlimited_usage: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" />
          Unlimited usage — exempt from the daily analysis quota
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
  const { fmt: inrFromUsd } = useUsdToInr();
  const { data, isPending } = useUserDetail(user.id);
  return (
    <Modal title={user.email} onClose={onClose} wide>
      {isPending || !data ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Spend (total)" value={inrFromUsd(data.total_cents)} />
            <StatCard label="Spend (month)" value={inrFromUsd(data.month_cents)} accent />
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
              <Line key={i} left={<span className="font-mono text-xs">{u.endpoint}</span>} mid={u.from_cache ? "cache" : inrFromUsd(u.cost_cents)} right={fmtDateTime(u.created_at)} />
            ))}
          </Section>
        </div>
      )}
    </Modal>
  );
}

export function UsersTab() {
  // DataForSEO bills in USD, so every spend figure here is USD cents.
  const { fmt: inrFromUsd } = useUsdToInr();
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
        <MetricCard icon={Wallet} label="Spend this month" value={inrFromUsd(data.total_month_cents)} />
        <MetricCard icon={TrendingUp} label="Spend all time" value={inrFromUsd(data.total_cents)} />
      </div>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setCreating(true)}><Plus size={15} /> Add user</Button>
      </div>
      <Card>
        <CardBody className="p-0">
          <DataTable columns={buildColumns(inrFromUsd, setEditing, setViewing, onReset, onDelete, me?.id)} rows={data.users} csvName="admin-users" />
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
