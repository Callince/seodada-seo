export type PeriodKey =
  | "today"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "custom";

export const PERIOD_PRESETS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "this_week", label: "This week" },
  { key: "last_week", label: "Last week" },
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "this_year", label: "This year" },
  { key: "last_year", label: "Last year" },
];

const pad = (n: number) => String(n).padStart(2, "0");
export const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Monday-based start of the week containing `d`. */
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - day);
  return x;
}

/** Resolve a preset (or custom range) to concrete `date_from`/`date_to`. */
export function periodRange(
  key: PeriodKey,
  from?: string,
  to?: string,
): { date_from: string; date_to: string } {
  const now = new Date();
  switch (key) {
    case "today":
      return { date_from: fmtDate(now), date_to: fmtDate(now) };
    case "this_week":
      return { date_from: fmtDate(startOfWeek(now)), date_to: fmtDate(now) };
    case "last_week": {
      const thisStart = startOfWeek(now);
      const lastEnd = new Date(thisStart);
      lastEnd.setDate(thisStart.getDate() - 1);
      const lastStart = new Date(lastEnd);
      lastStart.setDate(lastEnd.getDate() - 6);
      return { date_from: fmtDate(lastStart), date_to: fmtDate(lastEnd) };
    }
    case "this_month":
      return { date_from: fmtDate(new Date(now.getFullYear(), now.getMonth(), 1)), date_to: fmtDate(now) };
    case "last_month":
      return {
        date_from: fmtDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        date_to: fmtDate(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    case "this_year":
      return { date_from: fmtDate(new Date(now.getFullYear(), 0, 1)), date_to: fmtDate(now) };
    case "last_year":
      return {
        date_from: fmtDate(new Date(now.getFullYear() - 1, 0, 1)),
        date_to: fmtDate(new Date(now.getFullYear() - 1, 11, 31)),
      };
    case "custom":
      return { date_from: from ?? "", date_to: to ?? "" };
  }
}
