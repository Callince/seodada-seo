import { ArrowRight, Check, CreditCard, Download, Sparkles } from "lucide-react";

import { apiErrorMessage } from "@/api/client";
import {
  downloadInvoice,
  usePayments,
  usePlans,
  useSubscribe,
  useSubscription,
  type Plan,
} from "@/api/hooks/useBilling";
import { toast } from "@/store/toast";
import { PageHeader } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { BASE_CURRENCY, formatBase, formatMoney, useSiteCurrency } from "@/lib/currency";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

function PlanCard({
  plan,
  current,
  onSubscribe,
  busy,
  currency,
  rates,
}: {
  plan: Plan;
  current: boolean;
  onSubscribe: () => void;
  busy: boolean;
  currency: string;
  rates: Record<string, number | null> | undefined;
}) {
  const popular = plan.tier === 2;
  const price = formatMoney(plan.price_cents, currency, rates);
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-3xl border bg-surface p-7 shadow-sm",
        popular ? "border-primary/40 shadow-glow md:-translate-y-2" : "border-border",
      )}
    >
      {popular && (
        <span className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full gradient-fill px-3 py-1 text-xs font-semibold text-white shadow-glow">
          <Sparkles size={12} /> Most popular
        </span>
      )}
      <h3 className="text-lg font-semibold text-text">{plan.name}</h3>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-3xl font-extrabold text-text">{price.text}</span>
        <span className="text-sm text-text-muted">/{plan.period_days}d</span>
      </div>
      <p className="mt-1 text-xs text-text-muted">Incl. 18% GST</p>
      <div className="mt-4 rounded-xl bg-primary-soft px-3 py-2 text-sm font-medium text-primary">
        {plan.usage_per_day} analyses / day
      </div>
      <ul className="mt-4 flex-1 space-y-2">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-text-muted">
            <Check size={15} className="mt-0.5 shrink-0 text-success" /> {f}
          </li>
        ))}
      </ul>
      <Button
        onClick={onSubscribe}
        disabled={current || busy}
        variant={popular ? "primary" : "secondary"}
        className="mt-6 w-full"
      >
        {current ? "Current plan" : busy ? "Starting…" : "Subscribe"}
        {!current && !busy && <ArrowRight size={15} />}
      </Button>
    </div>
  );
}

export default function Billing() {
  const { data: plans } = usePlans();
  const { data: sub } = useSubscription();
  const { data: payments } = usePayments();
  const subscribe = useSubscribe();
  // Site-wide, set by an admin — not a per-user preference any more.
  const { data: fx } = useSiteCurrency();
  const currency = fx?.code || BASE_CURRENCY;
  const rates = fx?.rates;

  const onSubscribe = (slug: string) =>
    subscribe.mutate(slug, {
      onSuccess: (s) => toast.success(`You're on the ${s.plan_name} plan`),
      onError: (e) => toast.error(apiErrorMessage(e)),
    });

  return (
    <div>
      <PageHeader title="Billing" subtitle="Manage your subscription, plan, and invoices." />

      {/* Current subscription */}
      <Card className="mb-6">
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
              <CreditCard size={20} />
            </span>
            <div>
              <p className="font-semibold text-text">
                {sub ? `${sub.plan_name} plan` : "No active subscription"}
              </p>
              <p className="text-sm text-text-muted">
                {sub
                  ? `Renews ${fmtDate(sub.current_period_end)}`
                  : "Choose a plan below to unlock higher daily limits."}
              </p>
            </div>
          </div>
          {sub && <Badge tone="success">{sub.status}</Badge>}
        </CardBody>
      </Card>

      {/* Plans */}
      <div className="grid gap-6 md:grid-cols-3">
        {(plans ?? []).map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            current={sub?.plan_slug === p.slug && sub?.status === "active"}
            onSubscribe={() => onSubscribe(p.slug)}
            busy={subscribe.isPending}
            currency={currency}
            rates={rates}
          />
        ))}
      </div>

      {/* Payment history — ALWAYS in ₹, never converted.
          These are completed charges. Converting a payment from six months ago
          at today's rate would state an amount that was never paid, and it
          would change every time the rate moved. A receipt has one correct
          value: the one on the invoice. */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Payment history</CardTitle>
        </CardHeader>
        <CardBody>
          {!payments?.length ? (
            <p className="text-sm text-text-muted">No payments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
                    <th className="py-2 pr-4">Invoice</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2 pr-4">GST</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-border/60">
                      <td className="py-2.5 pr-4 font-mono text-xs">{p.invoice_number || "—"}</td>
                      <td className="py-2.5 pr-4 text-text-muted">{fmtDate(p.created_at)}</td>
                      <td className="py-2.5 pr-4 font-medium">{formatBase(p.amount_cents)}</td>
                      <td className="py-2.5 pr-4 text-text-muted">{formatBase(p.tax_cents)}</td>
                      <td className="py-2.5 pr-4">
                        <Badge tone={p.status === "paid" ? "success" : p.status === "failed" ? "danger" : "neutral"}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="py-2.5">
                        {p.status === "paid" && (
                          <button
                            onClick={() => downloadInvoice(p.id, p.invoice_number)}
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            <Download size={14} /> PDF
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
