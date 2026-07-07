export const fmtInt = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("en-US").format(n);

export const fmtCents = (cents: number | null | undefined) =>
  cents == null ? "$0.00" : `$${(cents / 100).toFixed(2)}`;

export const fmtCurrency = (cents: number | null | undefined) =>
  cents == null ? "—" : `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export const fmtPct = (n: number | null | undefined, digits = 1) =>
  n == null ? "—" : `${n.toFixed(digits)}%`;
