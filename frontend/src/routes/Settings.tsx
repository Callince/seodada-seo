import { Check, Coins, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { apiErrorMessage } from "@/api/client";
import { useUpdateUserSettings, useUserSettings } from "@/api/hooks/useSettings";
import { PageHeader } from "@/components/shared/states";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { BASE_CURRENCY, currencySymbol, formatBase, formatMoney, useCurrencies } from "@/lib/currency";

/** A recognisable amount to preview a conversion against — the Pro plan. */
const SAMPLE_INR_MINOR = 499900;

export default function Settings() {
  const settings = useUserSettings();
  const currencies = useCurrencies();
  const update = useUpdateUserSettings();

  const [name, setName] = useState("");
  useEffect(() => {
    if (settings.data) setName(settings.data.full_name);
  }, [settings.data]);

  const selected = settings.data?.display_currency || BASE_CURRENCY;
  const options = currencies.data?.currencies ?? [];
  const rates = currencies.data?.rates;
  const ratesAvailable = currencies.data?.available !== false;

  const choose = (code: string) => {
    update.mutate(
      { display_currency: code === BASE_CURRENCY ? "" : code },
      {
        onSuccess: () => toast.success(`Prices now shown in ${code}.`),
        onError: (e) => toast.error(apiErrorMessage(e)),
      },
    );
  };

  const saveName = () => {
    update.mutate(
      { full_name: name },
      {
        onSuccess: () => toast.success("Name updated."),
        onError: (e) => toast.error(apiErrorMessage(e)),
      },
    );
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your profile and how figures are displayed." />

      <div className="space-y-5">
        {/* ---------- Profile ---------- */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {settings.isLoading ? (
              <Skeleton className="h-10 w-full max-w-sm" />
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="block max-w-sm flex-1">
                  <span className="mb-1.5 block text-sm font-medium text-text">Full name</span>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                </label>
                <Button
                  onClick={saveName}
                  loading={update.isPending}
                  disabled={!settings.data || name === settings.data.full_name}
                >
                  Save
                </Button>
              </div>
            )}
          </CardBody>
        </Card>

        {/* ---------- Display currency ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins size={17} className="text-[color:var(--section)]" /> Display currency
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            {/* The honest framing, stated before the control rather than in a
                footnote: billing is INR and this setting cannot change that.
                Showing "$51.79" without this reads as the price you'd be
                charged, and it isn't. */}
            <div className="rounded-md border border-[color:var(--warning)]/35 bg-[color:var(--warning)]/10 px-3.5 py-3 text-sm">
              <p className="font-medium text-text">This changes how prices are shown, not how you are billed.</p>
              <p className="mt-1 text-text-muted">
                Payments are processed in Indian Rupees (₹). Converted amounts are
                estimates at today's rate — your bank or card network applies its own
                rate on the day, so the final amount may differ. Checkout and invoices
                always show the ₹ amount actually charged.
              </p>
            </div>

            {currencies.isLoading || settings.isLoading ? (
              <div className="grid gap-2 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : !ratesAvailable ? (
              <div className="rounded-md border border-border bg-surface-2 px-3.5 py-3 text-sm text-text-muted">
                Exchange rates are unavailable right now, so prices are shown in ₹.
                Nothing is broken — try again shortly.
              </div>
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
                        onClick={() => choose(c.code)}
                        disabled={update.isPending || !usable}
                        aria-pressed={active}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors",
                          active
                            ? "border-[color:var(--section)] bg-[color:var(--section-soft)]"
                            : "border-border hover:border-text-muted/50",
                          !usable && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          {/* The symbol, at a glance — it is what someone
                              actually recognises in a price, more than the ISO
                              code. Derived from Intl so it always matches the
                              amount rendered beside it. */}
                          <span className="grid h-8 w-9 shrink-0 place-items-center rounded-md bg-surface-2 text-sm font-semibold text-text">
                            {currencySymbol(c.code)}
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5 text-sm font-semibold text-text">
                              {c.code}
                              {active && <Check size={14} className="text-[color:var(--section-ink)]" />}
                            </span>
                            <span className="block truncate text-xs text-text-muted">{c.label}</span>
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block font-mono text-sm font-semibold text-text">{preview.text}</span>
                          {/* Only the converted ones are estimates; INR is exact. */}
                          <span className="block text-[11px] text-text-muted">
                            {preview.converted ? "approx." : "billed"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-text-muted">
                  <span>
                    Preview is the Pro plan ({formatBase(SAMPLE_INR_MINOR)}/month).
                    {currencies.data?.stale && " Rates are from an earlier fetch — the provider is unreachable."}
                    {currencies.data?.date && !currencies.data.stale && ` Rates updated ${currencies.data.date}.`}
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => currencies.refetch()} loading={currencies.isFetching}>
                    {!currencies.isFetching && <RefreshCw size={13} />} Refresh rates
                  </Button>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
