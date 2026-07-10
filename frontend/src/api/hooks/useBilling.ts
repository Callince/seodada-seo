import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";

export interface Plan {
  id: string;
  name: string;
  slug: string;
  price_cents: number;
  currency: string;
  period_days: number;
  usage_per_day: number;
  tier: number;
  features: string[];
}

export interface Subscription {
  id: string;
  plan_slug: string;
  plan_name: string;
  status: string;
  current_period_end: string | null;
}

export interface Payment {
  id: string;
  razorpay_order_id: string;
  amount_cents: number;
  tax_cents: number;
  currency: string;
  status: string;
  invoice_number: string;
  created_at: string;
}

interface CheckoutResponse {
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  plan_name: string;
  plan_slug: string;
}

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: async () => (await api.get<Plan[]>("/billing/plans")).data,
  });
}

export function useSubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: async () => (await api.get<Subscription | null>("/billing/subscription")).data,
  });
}

export function usePayments() {
  return useQuery({
    queryKey: ["payments"],
    queryFn: async () => (await api.get<Payment[]>("/billing/payments")).data,
  });
}

/** Download a payment's GST invoice PDF (authed — uses the JWT axios client). */
export async function downloadInvoice(paymentId: string, invoiceNumber: string) {
  const resp = await api.get(`/billing/payments/${paymentId}/invoice`, { responseType: "blob" });
  const url = URL.createObjectURL(resp.data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${invoiceNumber || paymentId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Load the Razorpay checkout script once. */
function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

/** Full subscribe flow: create order → open Razorpay → verify → refetch. */
export function useSubscribe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (planSlug: string) => {
      const { data: order } = await api.post<CheckoutResponse>("/billing/checkout", {
        plan_slug: planSlug,
      });
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Could not load the payment window. Check your connection.");

      const Razorpay = (window as unknown as { Razorpay: new (o: object) => { open: () => void } })
        .Razorpay;

      return new Promise<Subscription>((resolve, reject) => {
        const rzp = new Razorpay({
          key: order.key_id,
          order_id: order.order_id,
          amount: order.amount,
          currency: order.currency,
          name: "seodada",
          description: `${order.plan_name} plan`,
          theme: { color: "#273879" },
          handler: async (resp: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              const { data } = await api.post<Subscription>("/billing/verify", resp);
              resolve(data);
            } catch (e) {
              reject(e);
            }
          },
          modal: { ondismiss: () => reject(new Error("Payment cancelled.")) },
        });
        rzp.open();
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscription"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
  });
}
