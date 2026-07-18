import { Download, Plus } from "lucide-react";
import { useState } from "react";

import { apiErrorMessage } from "@/api/client";
import {
  downloadAdminFile,
  useAdminPayments,
  useAdminPlans,
  useAdminSubscriptions,
  useAssignSubscription,
  useExtendSubscription,
  useRefundPayment,
  useSetPaymentStatus,
  useSetSubscriptionStatus,
} from "@/api/hooks/useAdmin";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/store/toast";
import { Field, Modal, ModalActions, fmtDate, inr } from "@/routes/admin/ui";

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
