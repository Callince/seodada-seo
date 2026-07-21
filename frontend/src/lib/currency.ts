/**
 * Display-currency conversion.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE: amounts are stored and charged in INR
 * minor units (paise) because that is what Razorpay bills. Anything produced
 * here is a *reading* convenience. Wherever money is actually committed —
 * checkout, invoices, receipts — the INR figure has to appear, or someone gets
 * charged an amount they were never shown.
 */
import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";

export interface CurrencyOption {
  code: string;
  symbol: string;
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
const BASE_OPTION: CurrencyOption = { code: "INR", symbol: "₹", label: "Indian Rupee" };

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

/** Zero-decimal currencies: JPY has no minor unit, so "¥1,234.00" is wrong. */
const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "ISK"]);

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
  options: CurrencyOption[] = [],
): { text: string; converted: boolean } {
  const major = amountInrMinor / 100;
  const target = (code || BASE_CURRENCY).toUpperCase();
  const opt = options.find((c) => c.code === target);

  if (target === BASE_CURRENCY) {
    return { text: `${BASE_OPTION.symbol}${major.toLocaleString("en-IN")}`, converted: false };
  }
  const rate = rates?.[target];
  if (!rate || !opt) {
    // Fall back to the true amount rather than guessing.
    return { text: `${BASE_OPTION.symbol}${major.toLocaleString("en-IN")}`, converted: false };
  }
  const value = major * rate;
  const digits = ZERO_DECIMAL.has(target) ? 0 : 2;
  return {
    text: `${opt.symbol}${value.toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })}`,
    converted: true,
  };
}

/** The INR figure, always — for the places that must state what is charged. */
export function formatBase(amountInrMinor: number): string {
  return `${BASE_OPTION.symbol}${(amountInrMinor / 100).toLocaleString("en-IN")}`;
}
