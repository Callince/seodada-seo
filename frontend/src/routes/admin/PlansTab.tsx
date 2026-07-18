import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { apiErrorMessage } from "@/api/client";
import {
  useAdminPlans,
  useArchivePlan,
  useCreatePlan,
  useUpdatePlan,
  type AdminPlan,
} from "@/api/hooks/useAdmin";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/store/toast";
import { Field, Modal, ModalActions, inr } from "@/routes/admin/ui";

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
