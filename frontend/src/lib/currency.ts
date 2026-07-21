/**
 * Display-currency conversion and formatting.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE: amounts are stored and charged in INR
 * minor units (paise) because that is what Razorpay bills. Anything produced
 * here is a *reading* convenience. Wherever money is actually committed —
 * checkout, invoices, receipts — the INR figure has to appear, or someone gets
 * charged an amount they were never shown.
 *
 * Formatting goes through Intl.NumberFormat rather than a hand-kept symbol
 * table and string concatenation. That table was wrong in three ways at once:
 *
 *   - it hardcoded which currencies have no minor unit, and the list was
 *     incomplete (JPY was there, KRW and VND were not) — Intl knows all of them
 *   - it always put the symbol in front, but real placement is locale- and
 *     currency-dependent ("R 1,234.50", "kr 1,234.50", "1.234,50 €")
 *   - it used the Arabic glyph for AED, which is RTL: concatenating it with
 *     digits invites the bidi algorithm to reorder the result. Intl renders
 *     "AED 51.79" in an English locale, which is what the platform considers
 *     correct and cannot be mangled.
 */
import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";

export interface CurrencyOption {
  code: string;
  label: string;
}

export interface CurrenciesResponse {
  currencies: CurrencyOption[];
  base: string;
  rates: Record<string, number | null>;
  date?: string;
  stale?: boolean;
  available: boolean;
}

/** The site's active currency, resolved server-side from the admin setting. */
export interface SiteCurrency {
  code: string;
  base: string;
  rates: Record<string, number | null>;
  /** false when `code` IS the billing currency, or when conversion failed and
   *  the server fell back — either way the UI must not call it an estimate. */
  converted: boolean;
  available: boolean;
  date?: string;
  stale?: boolean;
}

export const BASE_CURRENCY = "INR";

/**
 * The currency every price on the site renders in.
 *
 * PUBLIC endpoint, deliberately: /pricing and the landing page are the
 * surfaces most visitors see, and an authed-only source would have left them
 * on the base currency while the rest of the app followed the admin's choice —
 * the same product priced two ways depending on whether you were logged in.
 *
 * Rates change daily and the server caches for 6h, so a long staleTime here
 * costs nothing and keeps a third party out of the path of every render.
 */
export function useSiteCurrency() {
  return useQuery<SiteCurrency>({
    queryKey: ["site-currency"],
    queryFn: async () => (await api.get("/public/currency")).data,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}

/** Every currency an admin may pick, with live rates — for the admin picker. */
export function useCurrencies() {
  return useQuery<CurrenciesResponse>({
    queryKey: ["currencies"],
    queryFn: async () => (await api.get("/public/currencies")).data,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}

/**
 * `currencyDisplay: "symbol"`, deliberately NOT "narrowSymbol".
 *
 * narrowSymbol renders AUD, CAD, SGD, NZD, HKD and MXN all as a bare "$", so a
 * Singapore price would be indistinguishable from a US one on a page that also
 * shows USD. "symbol" disambiguates them (A$, CA$, NZ$, HK$, MX$, CN¥), which
 * is the whole point of showing a currency at all.
 */
function formatter(code: string): Intl.NumberFormat | null {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      currencyDisplay: "symbol",
    });
  } catch {
    // Unknown/invalid ISO code — Intl throws rather than guessing, and so do we.
    return null;
  }
}

/** The symbol alone, for labelling a picker option. Derived from Intl so it can
 *  never drift from what the formatted amounts actually show. */
export function currencySymbol(code: string): string {
  const f = formatter(code);
  if (!f) return code;
  return f.formatToParts(1).find((p) => p.type === "currency")?.value ?? code;
}

/**
 * Format an INR minor-unit amount in `code`.
 *
 * Returns the INR figure unchanged when conversion is impossible (no rate, or
 * rates unavailable) — never a converted-looking number under a foreign
 * symbol, which is indistinguishable from a real conversion and therefore
 * worse than showing the original. `converted` tells the caller which happened
 * so the UI can label an estimate as one.
 */
export function formatMoney(
  amountInrMinor: number,
  code: string,
  rates: Record<string, number | null> | undefined,
): { text: string; converted: boolean } {
  const major = amountInrMinor / 100;
  const target = (code || BASE_CURRENCY).toUpperCase();

  if (target === BASE_CURRENCY) return { text: formatBase(amountInrMinor), converted: false };

  const rate = rates?.[target];
  const f = rate ? formatter(target) : null;
  // Fall back to the true amount rather than guessing.
  if (!rate || !f) return { text: formatBase(amountInrMinor), converted: false };

  return { text: f.format(major * rate), converted: true };
}

/**
 * USD -> INR, for the admin panel's API-spend figures.
 *
 * The admin screens genuinely mix two currencies and always have:
 *   - DataForSEO bills in USD, so every cost_cents / balance_cents / spend
 *     figure is USD cents (see integrations/dataforseo/client._to_cents)
 *   - Razorpay revenue (MRR, all-time revenue, plan prices) is INR paise
 * Converting the wrong set would double-convert the rupee ones, so this is
 * deliberately a separate function from formatMoney rather than a flag on it —
 * the two take different inputs and can't be mixed up at the call site.
 *
 * The rates endpoint is based on INR, so the USD->INR rate is the inverse of
 * the INR->USD one it publishes (0.01036 -> 96.53).
 */
export function useUsdToInr() {
  // useCurrencies (ALL rates), not useSiteCurrency (only the active one).
  // The first version used the latter and silently did nothing: with the site
  // on its default INR, /public/currency returns {"rates":{"INR":1}} — no USD
  // key — so the rate lookup failed and every figure fell back to dollars.
  // This conversion is about where DataForSEO bills from, which has nothing to
  // do with which currency the site displays prices in.
  const { data } = useCurrencies();
  const inrToUsd = data?.rates?.USD;
  const rate = inrToUsd ? 1 / inrToUsd : null;

  /** USD cents -> "₹1,234.56". Falls back to the USD figure when no rate is
   *  available, so a spend number is never silently mislabelled. */
  const fmt = (usdCents: number | null | undefined): string => {
    const cents = usdCents ?? 0;
    if (!rate) return `$${(cents / 100).toFixed(2)}`;
    // Sub-cent API calls are normal (an AI Overview call is $0.002), so keep
    // 2dp rather than rounding a real cost to ₹0.
    return formatBase(Math.round((cents / 100) * rate * 100));
  };
  return { rate, fmt, available: rate != null };
}

/** The INR figure, always — for the places that must state what is charged. */
export function formatBase(amountInrMinor: number): string {
  const f = formatter(BASE_CURRENCY);
  const major = amountInrMinor / 100;
  return f ? f.format(major) : `₹${major.toLocaleString("en-IN")}`;
}
