import { describe, expect, it } from "vitest";

import { BASE_CURRENCY, currencySymbol, formatBase, formatMoney } from "@/lib/currency";

// Live values on the day this was written; USD agreed to 4dp across two
// independent providers (open.er-api 0.01036, frankfurter 0.01037).
const RATES = { INR: 1, USD: 0.01036, JPY: 1.72, AUD: 0.0159, AED: 0.038 };

const PRO_PLAN = 499900; // ₹4,999 in paise

/** Digits only, so assertions do not depend on which glyph the runtime's ICU
 *  build ships for a given currency. */
const digits = (s: string) => s.replace(/[^\d.,]/g, "");

describe("formatMoney", () => {
  it("returns the base amount for INR and does not call it a conversion", () => {
    const r = formatMoney(PRO_PLAN, "INR", RATES);
    expect(digits(r.text)).toBe("4,999.00");
    expect(r.text).toContain("₹");
    // Not a conversion, so callers must not label it an estimate.
    expect(r.converted).toBe(false);
  });

  it("converts from INR MINOR units, not major", () => {
    // The bug this guards: forgetting /100 would show $51,789 instead of
    // $51.79 — off by 100x and entirely plausible-looking.
    const r = formatMoney(PRO_PLAN, "USD", RATES);
    expect(r.converted).toBe(true);
    expect(digits(r.text)).toBe("51.79");
  });

  it("falls back to the true INR amount when a rate is missing", () => {
    // Never render a foreign symbol over an unconverted number: it is
    // indistinguishable from a real conversion and silently wrong by ~80x.
    const r = formatMoney(PRO_PLAN, "USD", { INR: 1 });
    expect(digits(r.text)).toBe("4,999.00");
    expect(r.text).toContain("₹");
    expect(r.converted).toBe(false);
  });

  it("falls back when rates are unavailable entirely", () => {
    const r = formatMoney(PRO_PLAN, "USD", undefined);
    expect(r.text).toContain("₹");
    expect(r.converted).toBe(false);
  });

  it("falls back for a MALFORMED currency code instead of throwing", () => {
    // Verified against the runtime: Intl throws RangeError for anything that
    // is not three letters ("US", "USDD", "12A", ""), and that must never
    // reach the render. A well-formed-but-unlisted code like "XYZ" does NOT
    // throw — Intl formats it with the code as its own symbol — so it is
    // handled in the block below rather than here.
    for (const bad of ["US", "USDD", "12A", ""]) {
      const r = formatMoney(PRO_PLAN, bad, { [bad]: 2 });
      expect(() => formatMoney(PRO_PLAN, bad, { [bad]: 2 }), bad).not.toThrow();
      expect(r.converted, bad).toBe(false);
      expect(r.text, bad).toContain("₹");
    }
  });

  it("labels an unlisted but well-formed code with the code itself", () => {
    // Not a fallback case: the number IS correctly converted at the supplied
    // rate, and "XYZ 9,998.00" says plainly which currency it is. The unsafe
    // outcome would be a familiar symbol over an unconverted figure, which is
    // what the missing-rate test above guards.
    const r = formatMoney(PRO_PLAN, "XYZ", { ...RATES, XYZ: 2 });
    expect(r.converted).toBe(true);
    expect(r.text).toContain("XYZ");
    expect(digits(r.text)).toBe("9,998.00");
  });

  it("omits decimals for zero-decimal currencies", () => {
    // JPY has no minor unit — "¥8,598.28" is not a real amount. Intl knows
    // this per-currency, which is why the hardcoded list it replaced was both
    // redundant and incomplete (it had JPY but not KRW or VND).
    const r = formatMoney(PRO_PLAN, "JPY", RATES);
    expect(r.converted).toBe(true);
    expect(r.text).not.toMatch(/\./);
  });

  it("treats an empty preference as the base currency", () => {
    expect(formatMoney(PRO_PLAN, "", RATES).text).toContain("₹");
  });

  it("is case-insensitive about the code", () => {
    expect(digits(formatMoney(PRO_PLAN, "usd", RATES).text)).toBe("51.79");
  });
});

describe("currency symbols", () => {
  it("disambiguates the currencies that all share a dollar sign", () => {
    // narrowSymbol renders AUD/CAD/SGD/NZD/HKD/MXN as a bare "$", so an
    // Australian price would look identical to a US one. `symbol` keeps them
    // apart, which is the point of showing a currency at all.
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("AUD")).not.toBe("$");
    expect(formatMoney(PRO_PLAN, "AUD", RATES).text).not.toBe(
      formatMoney(PRO_PLAN, "USD", RATES).text,
    );
  });

  it("uses no right-to-left glyph for AED", () => {
    // The Arabic dirham glyph is RTL; concatenating it with digits invites the
    // bidi algorithm to reorder the result. Intl renders "AED" in an English
    // locale, which cannot be mangled.
    const text = formatMoney(PRO_PLAN, "AED", RATES).text;
    expect(text).not.toMatch(/[؀-ۿ]/);
  });

  it("falls back to the code for an unknown currency rather than throwing", () => {
    expect(() => currencySymbol("XYZ")).not.toThrow();
    expect(currencySymbol("XYZ")).toBe("XYZ");
  });

  it("gives a symbol for every currency the picker offers", () => {
    const OFFERED = [
      "INR", "USD", "EUR", "GBP", "AUD", "CAD", "SGD", "NZD", "HKD", "CHF",
      "SEK", "AED", "SAR", "JPY", "CNY", "KRW", "MYR", "IDR", "PHP", "THB",
      "VND", "BDT", "PKR", "LKR", "ZAR", "NGN", "KES", "EGP", "BRL", "MXN",
      "TRY", "PLN",
    ];
    for (const code of OFFERED) {
      const sym = currencySymbol(code);
      expect(sym, code).toBeTruthy();
      expect(() => formatMoney(PRO_PLAN, code, { [code]: 1 }), code).not.toThrow();
    }
  });
});

describe("formatBase", () => {
  it("always renders INR regardless of preference — this is the charged figure", () => {
    expect(formatBase(PRO_PLAN)).toContain("₹");
    expect(digits(formatBase(PRO_PLAN))).toBe("4,999.00");
    expect(digits(formatBase(79900))).toBe("799.00");
  });

  it("BASE_CURRENCY is the currency Razorpay actually charges", () => {
    expect(BASE_CURRENCY).toBe("INR");
  });
});

/**
 * Mirrors useUsdToInr's arithmetic. Kept as a copy because the hook needs a
 * QueryClient; the part worth pinning is the maths, not the plumbing.
 *
 * The admin panel mixes currencies by nature: DataForSEO bills in USD, Razorpay
 * revenue is INR. Converting in the wrong direction is invisible in the UI —
 * ₹1.06 and ₹9,873 both look like plausible spend figures — so the direction
 * itself needs a test.
 */
const usdCentsToInr = (usdCents: number, inrToUsd: number) =>
  formatBase(Math.round((usdCents / 100) * (1 / inrToUsd) * 100));

describe("admin USD spend shown in INR", () => {
  const INR_TO_USD = 0.01036; // live value; USD->INR is its inverse, ~96.53

  it("multiplies by the INVERSE rate, not the rate", () => {
    // $9.00 of DataForSEO spend is ~₹869. Using the rate directly instead of
    // its inverse would give ₹0.09 — small, plausible, and wrong by ~9300x.
    expect(digits(usdCentsToInr(900, INR_TO_USD))).toBe("868.73");
  });

  it("keeps sub-cent API calls from rounding to zero", () => {
    // An AI Overview call costs $0.002. At 2dp in rupees that is ₹0.19, which
    // must survive: rounding it to ₹0 would make per-call costs vanish while
    // the totals kept growing.
    expect(digits(usdCentsToInr(0.2, INR_TO_USD))).not.toBe("0.00");
  });

  it("scales linearly across the range the dashboard shows", () => {
    expect(digits(usdCentsToInr(110, INR_TO_USD))).toBe("106.18");
    expect(digits(usdCentsToInr(25000, INR_TO_USD))).toBe("24,131.27");
  });

  it("renders in rupees, not dollars", () => {
    expect(usdCentsToInr(900, INR_TO_USD)).toContain("₹");
    expect(usdCentsToInr(900, INR_TO_USD)).not.toContain("$");
  });
});
