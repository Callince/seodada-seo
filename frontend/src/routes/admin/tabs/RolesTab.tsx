import { KeyRound, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";

import { apiErrorMessage } from "@/api/client";
import {
  useAdminRoles,
  useCreateRole,
  useRevokeRole,
  useUpdateRole,
  type AdminRole,
} from "@/api/hooks/useAdmin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { Field, Modal, ModalActions, fmtDate } from "@/routes/admin/ui";

/** Permission catalogue, grouped for the checkbox UI (mirrors seodada's roles page). */
const GROUPS: { title: string; perms: { key: string; label: string }[] }[] = [
  {
    title: "Core",
    perms: [
      { key: "dashboard", label: "Dashboard" },
      { key: "subscription_management", label: "Plans & subscriptions" },
      { key: "search_history", label: "Usage history" },
    ],
  },
  {
    title: "Administrative",
    perms: [
      { key: "user_management", label: "User management" },
      { key: "payments", label: "Payments & billing" },
      { key: "contact_submissions", label: "Contact inbox" },
      { key: "email_logs", label: "Email logs" },
      { key: "website_settings", label: "Website settings" },
      { key: "manage_roles", label: "Role management" },
    ],
  },
  { title: "Content", perms: [{ key: "content_management", label: "Blogs & web stories" }] },
];
const ALL_PERMS = GROUPS.flatMap((g) => g.perms.map((p) => p.key));

function PermissionPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (k: string) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm"
          onClick={() => onChange(value.length === ALL_PERMS.length ? [] : ALL_PERMS)}>
          {value.length === ALL_PERMS.length ? "Clear all" : "Select all"}
        </Button>
      </div>
      {GROUPS.map((g) => (
        <div key={g.title} className="rounded-lg border border-border p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{g.title}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {g.perms.map((p) => (
              <label key={p.key} className="flex items-center gap-2 text-sm text-text">
                <input type="checkbox" checked={value.includes(p.key)} onChange={() => toggle(p.key)}
                  className="h-4 w-4 accent-[var(--primary)]" />
                {p.label}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RoleModal({ role, onClose }: { role: AdminRole | null; onClose: () => void }) {
  const create = useCreateRole();
  const update = useUpdateRole();
  const editing = !!role;
  const [f, setF] = useState({
    email: role?.email ?? "",
    full_name: role?.full_name ?? "",
    password: "",
    permissions: role?.permissions ?? ["dashboard"],
  });
  const busy = create.isPending || update.isPending;

  return (
    <Modal title={editing ? `Edit ${role.email}` : "Add admin"} onClose={onClose} wide>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const opts = {
            onSuccess: () => { toast.success(editing ? "Permissions updated" : "Admin added"); onClose(); },
            onError: (err: unknown) => toast.error(apiErrorMessage(err)),
          };
          if (editing) update.mutate({ id: role.id, permissions: f.permissions }, opts);
          else create.mutate({ email: f.email.trim(), password: f.password || undefined, full_name: f.full_name.trim(), permissions: f.permissions }, opts);
        }}
      >
        {!editing && (
          <>
            <Field label="Email (existing user is promoted, or a new admin is created)">
              <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full name (new account)"><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
              <Field label="Password (only for a new account)"><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} minLength={8} autoComplete="new-password" /></Field>
            </div>
          </>
        )}
        <PermissionPicker value={f.permissions} onChange={(permissions) => setF({ ...f, permissions })} />
        <ModalActions onClose={onClose} loading={busy} label={editing ? "Save permissions" : "Add admin"} />
      </form>
    </Modal>
  );
}

export function RolesTab() {
  const { data, isPending } = useAdminRoles();
  const revoke = useRevokeRole();
  const meEmail = useAuth((s) => s.user?.email);
  const [editing, setEditing] = useState<AdminRole | null | "new">(null);

  if (isPending) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">
          Admins with access to this console. Super-admins (set via <code className="rounded bg-app-bg px-1">ADMIN_EMAILS</code>) hold every permission.
        </p>
        <Button onClick={() => setEditing("new")} className="gradient-fill text-white shadow-glow"><Plus size={15} /> Add admin</Button>
      </div>
      <Card>
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
                <th className="py-2 pl-4 pr-4">Admin</th>
                <th className="py-2 pr-4">Access</th>
                <th className="py-2 pr-4">Added</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="py-2.5 pl-4 pr-4">
                    <p className="flex items-center gap-1.5 font-medium text-text">
                      {r.email}
                      {r.is_super && <Badge tone="info"><ShieldCheck size={11} /> super</Badge>}
                      {!r.is_active && <Badge tone="danger">disabled</Badge>}
                    </p>
                    <p className="text-xs text-text-muted">{r.full_name || "—"}</p>
                  </td>
                  <td className="py-2.5 pr-4">
                    {r.is_super ? (
                      <span className="text-text-muted">All permissions</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {r.permissions.length ? r.permissions.map((p) => (
                          <span key={p} className="rounded bg-app-bg px-1.5 py-0.5 text-xs text-text-muted">{p}</span>
                        )) : <span className="text-text-muted">—</span>}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-text-muted">{fmtDate(r.created_at)}</td>
                  <td className="py-2.5 pr-4 text-right">
                    {!r.is_super && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => setEditing(r)} aria-label="Edit permissions"><Pencil size={14} /></Button>
                        {r.email !== meEmail && (
                          <Button variant="ghost" size="icon" aria-label="Revoke admin"
                            onClick={() => { if (confirm(`Revoke admin access for ${r.email}? Their user account stays.`)) revoke.mutate(r.id, { onError: (e) => toast.error(apiErrorMessage(e)) }); }}>
                            <Trash2 size={14} className="text-danger" />
                          </Button>
                        )}
                      </>
                    )}
                    {r.is_super && <KeyRound size={14} className="ml-auto text-text-muted" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
      {editing !== null && <RoleModal role={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
