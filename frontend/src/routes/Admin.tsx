import { Pencil, ShieldCheck, X } from "lucide-react";
import { useState } from "react";

import { apiErrorMessage } from "@/api/client";
import { useAdminUpdateUser, useAdminUsers } from "@/api/hooks/useAdmin";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtCents, fmtInt } from "@/lib/format";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import type { AdminUser } from "@/types";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const buildColumns = (onEdit: (u: AdminUser) => void): Column<AdminUser>[] => [
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
  {
    key: "role",
    header: "Role",
    sortValue: (r) => r.role,
    render: (r) => <span className="capitalize">{r.role}</span>,
  },
  {
    key: "month_cents",
    header: "Spend (month)",
    align: "right",
    mono: true,
    sortValue: (r) => r.month_cents,
    render: (r) => fmtCents(r.month_cents),
    csvValue: (r) => (r.month_cents / 100).toFixed(2),
  },
  {
    key: "total_cents",
    header: "Spend (total)",
    align: "right",
    mono: true,
    sortValue: (r) => r.total_cents,
    render: (r) => <span className="font-semibold">{fmtCents(r.total_cents)}</span>,
    csvValue: (r) => (r.total_cents / 100).toFixed(2),
  },
  {
    key: "calls",
    header: "API calls",
    align: "right",
    mono: true,
    sortValue: (r) => r.calls,
    render: (r) => fmtInt(r.calls),
  },
  {
    key: "last_active",
    header: "Last active",
    sortValue: (r) => r.last_active ?? "",
    render: (r) => <span className="text-text-muted">{fmtDate(r.last_active)}</span>,
    csvValue: (r) => r.last_active,
  },
  {
    key: "created_at",
    header: "Joined",
    sortValue: (r) => r.created_at,
    render: (r) => <span className="text-text-muted">{fmtDate(r.created_at)}</span>,
    csvValue: (r) => r.created_at,
  },
  {
    key: "actions",
    header: "",
    render: (r) => (
      <Button variant="ghost" size="sm" onClick={() => onEdit(r)} aria-label={`Edit ${r.email}`}>
        <Pencil size={14} /> Edit
      </Button>
    ),
    csvValue: () => null,
  },
];

function EditUserModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const update = useAdminUpdateUser();
  const me = useAuth((s) => s.user);
  const [form, setForm] = useState({
    full_name: user.full_name,
    role: user.role as "member" | "owner",
    password: "",
    is_active: user.is_active,
    org_name: user.org_name,
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate(
      {
        id: user.id,
        full_name: form.full_name.trim(),
        role: form.role,
        is_active: form.is_active,
        // Only send what actually changes credentials/org.
        ...(form.password ? { password: form.password } : {}),
        ...(form.org_name.trim() && form.org_name.trim() !== user.org_name
          ? { org_name: form.org_name.trim() }
          : {}),
      },
      {
        onSuccess: () => {
          toast.success(`${user.email} updated`);
          onClose();
        },
        onError: (err) => toast.error(apiErrorMessage(err)),
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${user.email}`}
    >
      <Card className="w-full max-w-md animate-fade-rise" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Edit {user.email}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X size={16} />
          </Button>
        </CardHeader>
        <CardBody>
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-text-muted">Full name</span>
              <Input value={form.full_name} onChange={set("full_name")} placeholder="Full name" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-text-muted">Role</span>
                <Select value={form.role} onChange={set("role")} className="w-full">
                  <option value="member">Member</option>
                  <option value="owner">Owner</option>
                </Select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-text-muted">Organization</span>
                <Input value={form.org_name} onChange={set("org_name")} placeholder="Organization" />
              </label>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-text-muted">
                New password (leave blank to keep current)
              </span>
              <Input
                type="password"
                value={form.password}
                onChange={set("password")}
                minLength={8}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={form.is_active}
                disabled={user.id === me?.id}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              Account active
              {user.id === me?.id && (
                <span className="text-xs text-text-muted">(you can’t deactivate yourself)</span>
              )}
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" loading={update.isPending}>
                Save changes
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

export default function Admin() {
  const isAdmin = useAuth((s) => s.user?.is_admin);
  const { data, isPending, isError, error, refetch } = useAdminUsers();
  const [editing, setEditing] = useState<AdminUser | null>(null);

  if (!isAdmin) {
    return (
      <EmptyState
        title="Admin access required"
        hint="Your account is not a platform admin. Ask an admin to add your email to ADMIN_EMAILS."
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Admin"
        subtitle="Every user across all organizations — spend, activity, roles. New users join by signing in with Google."
      />

      {isPending && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {isError && !isPending && <ErrorState message={apiErrorMessage(error)} onRetry={() => refetch()} />}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Users" value={fmtInt(data.users.length)} />
            <StatCard label="Spend this month" value={fmtCents(data.total_month_cents)} accent />
            <StatCard label="Spend all time" value={fmtCents(data.total_cents)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Users by spend</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              {data.users.length ? (
                <DataTable columns={buildColumns(setEditing)} rows={data.users} csvName="admin-users" />
              ) : (
                <div className="p-4">
                  <EmptyState title="No users yet" hint="Create the first user above." />
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}

      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
