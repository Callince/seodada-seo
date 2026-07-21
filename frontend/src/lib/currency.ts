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

export const BASE_CURRENCY = "INR";

/** Rates change daily; the server caches for 6h, so refetching per mount would
 *  only add latency. */
export function useCurrencies() {
  return useQuery<CurrenciesResponse>({
    queryKey: ["currencies"],
    queryFn: async () => (await api.get("/settings/currencies")).data,
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

/** The INR figure, always — for the places that must state what is charged. */
export function formatBase(amountInrMinor: number): string {
  const f = formatter(BASE_CURRENCY);
  const major = amountInrMinor / 100;
  return f ? f.format(major) : `₹${major.toLocaleString("en-IN")}`;
}
