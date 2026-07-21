import { describe, expect, it } from "vitest";

import { BASE_CURRENCY, formatBase, formatMoney } from "@/lib/currency";

const OPTIONS = [
  { code: "INR", symbol: "₹", label: "Indian Rupee" },
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "JPY", symbol: "¥", label: "Japanese Yen" },
];
// Live values on the day this was written; USD agreed to 4dp across two
// independent providers (open.er-api 0.01036, frankfurter 0.01037).
const RATES = { INR: 1, USD: 0.01036, JPY: 1.72 };

const PRO_PLAN = 499900; // ₹4,999 in paise

describe("formatMoney", () => {
  it("returns the base amount untouched for INR", () => {
    const r = formatMoney(PRO_PLAN, "INR", RATES, OPTIONS);
    expect(r.text).toBe("₹4,999");
    // Not a conversion, so callers must not label it an estimate.
    expect(r.converted).toBe(false);
  });

  it("converts from INR minor units, not major", () => {
    // The bug this guards: forgetting /100 would show $51,789 instead of
    // $51.79 — off by 100x and entirely plausible-looking.
    const r = formatMoney(PRO_PLAN, "USD", RATES, OPTIONS);
    expect(r.converted).toBe(true);
    expect(r.text).toBe("$51.79");
  });

  it("falls back to the true INR amount when a rate is missing", () => {
    // Never render a foreign symbol over an unconverted number: it is
    // indistinguishable from a real conversion and silently wrong by ~80x.
    const r = formatMoney(PRO_PLAN, "USD", { INR: 1 }, OPTIONS);
    expect(r.text).toBe("₹4,999");
    expect(r.converted).toBe(false);
  });

  it("falls back when rates are unavailable entirely", () => {
    const r = formatMoney(PRO_PLAN, "USD", undefined, OPTIONS);
    expect(r.text).toBe("₹4,999");
    expect(r.converted).toBe(false);
  });

  it("falls back for a currency with no display option", () => {
    const r = formatMoney(PRO_PLAN, "EUR", { ...RATES, EUR: 0.009 }, OPTIONS);
    expect(r.converted).toBe(false);
    expect(r.text).toBe("₹4,999");
  });

  it("omits decimals for zero-decimal currencies", () => {
    // JPY has no minor unit — "¥8,598.28" is not a real amount.
    const r = formatMoney(PRO_PLAN, "JPY", RATES, OPTIONS);
    expect(r.converted).toBe(true);
    expect(r.text).not.toMatch(/\./);
    expect(r.text.startsWith("¥")).toBe(true);
  });

  it("treats an empty preference as the base currency", () => {
    expect(formatMoney(PRO_PLAN, "", RATES, OPTIONS).text).toBe("₹4,999");
  });

  it("is case-insensitive about the code", () => {
    expect(formatMoney(PRO_PLAN, "usd", RATES, OPTIONS).text).toBe("$51.79");
  });
});

describe("formatBase", () => {
  it("always renders INR regardless of preference — this is the charged figure", () => {
    expect(formatBase(PRO_PLAN)).toBe("₹4,999");
    expect(formatBase(79900)).toBe("₹799");
  });

  it("BASE_CURRENCY is the currency Razorpay actually charges", () => {
    expect(BASE_CURRENCY).toBe("INR");
  });
});
