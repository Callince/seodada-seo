import { useEffect, useState } from "react";

import { apiErrorMessage } from "@/api/client";
import { useUpdateSettings, useWebsiteSettings, type WebsiteSettings } from "@/api/hooks/useAdmin";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/store/toast";
import { Field } from "@/routes/admin/ui";
import { cn } from "@/lib/cn";
import { BASE_CURRENCY, currencySymbol, formatBase, formatMoney, useCurrencies } from "@/lib/currency";

/** A recognisable amount to preview a conversion against — the Pro plan. */
const SAMPLE_INR_MINOR = 499900;

/**
 * Site-wide display currency.
 *
 * Saved on click rather than with the form below, because this one setting
 * changes every price on the public site the moment it lands — batching it
 * behind "Save settings" alongside a logo URL would understate that.
 */
function CurrencyCard({ current, onPick, saving }: {
  current: string;
  onPick: (code: string) => void;
  saving: boolean;
}) {
  const { data, isLoading, isFetching, refetch } = useCurrencies();
  const options = data?.currencies ?? [];
  const rates = data?.rates;
  const selected = current || BASE_CURRENCY;

  return (
    <Card className="mb-5">
      <CardHeader><CardTitle>Display currency</CardTitle></CardHeader>
      <CardBody className="space-y-4">
        {/* Louder than the old per-user version on purpose. That one was opted
            into by the person reading it; this applies to every visitor, so
            the site can show "$51.79" to someone who never chose USD and will
            still be charged in rupees. Saying so is not optional. */}
        <div className="rounded-md border border-[color:var(--warning)]/35 bg-[color:var(--warning)]/10 px-3.5 py-3 text-sm">
          <p className="font-medium text-text">Display only — billing stays in Indian Rupees.</p>
          <p className="mt-1 text-text-muted">
            This converts every price shown on the site, including the public pricing
            page, at today's rate. Razorpay still charges ₹, and the ₹ figure stays
            visible at checkout and on invoices. It does not change what customers pay.
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-2 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : data?.available === false ? (
          <p className="rounded-md border border-border bg-surface-2 px-3.5 py-3 text-sm text-text-muted">
            Exchange rates are unavailable right now, so prices stay in ₹. Try again shortly.
          </p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {options.map((c) => {
                const active = c.code === selected;
                const preview = formatMoney(SAMPLE_INR_MINOR, c.code, rates);
                const usable = c.code === BASE_CURRENCY || preview.converted;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => onPick(c.code)}
                    disabled={saving || !usable}
                    aria-pressed={active}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors",
                      active ? "border-[color:var(--section)] bg-[color:var(--section-soft)]" : "border-border hover:border-text-muted/50",
                      !usable && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="grid h-8 w-9 shrink-0 place-items-center rounded-md bg-surface-2 text-sm font-semibold text-text">
                        {currencySymbol(c.code)}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-text">{c.code}</span>
                        <span className="block truncate text-xs text-text-muted">{c.label}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-mono text-sm font-semibold text-text">{preview.text}</span>
                      <span className="block text-[11px] text-text-muted">{preview.converted ? "approx." : "billed"}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-text-muted">
              <span>
                Preview is the Pro plan ({formatBase(SAMPLE_INR_MINOR)}/month).
                {data?.stale && " Rates are from an earlier fetch — the provider is unreachable."}
                {data?.date && !data.stale && ` Rates updated ${data.date}.`}
              </span>
              <Button size="sm" variant="secondary" onClick={() => refetch()} loading={isFetching}>
                Refresh rates
              </Button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

export function SettingsTab() {
  const { data } = useWebsiteSettings();
  const update = useUpdateSettings();
  const [form, setForm] = useState<WebsiteSettings | null>(null);
  useEffect(() => { if (data && !form) setForm(data); }, [data, form]);
  if (!form) return <Skeleton className="h-64 w-full" />;
  const set = (k: keyof WebsiteSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const pickCurrency = (code: string) => {
    const next = { ...form, display_currency: code === BASE_CURRENCY ? "" : code };
    setForm(next);
    update.mutate(next, {
      onSuccess: () => toast.success(`Prices now shown in ${code} across the site.`),
      onError: (er) => toast.error(apiErrorMessage(er)),
    });
  };

  return (
    <>
    <CurrencyCard current={form.display_currency} onPick={pickCurrency} saving={update.isPending} />
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
    </>
  );
}
