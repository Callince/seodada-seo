import { TrendingUp } from "lucide-react";

/* ============================== data ============================== */

export const TRAFFIC = [22, 30, 26, 38, 34, 48, 44, 60, 55, 72, 68, 88];

const KEYWORDS = [
  { kw: "ai seo platform", pos: 3, up: true },
  { kw: "geo optimization", pos: 1, up: true },
  { kw: "answer engine seo", pos: 5, up: true },
  { kw: "technical seo audit", pos: 8, up: false },
];

/* ============================== widgets ============================== */

export function KeywordRows() {
  return (
    <div className="space-y-2">
      {KEYWORDS.map((k) => (
        <div key={k.kw} className="flex items-center justify-between rounded-xl border border-border bg-surface px-3.5 py-2.5">
          <span className="truncate text-sm font-medium text-text">{k.kw}</span>
          <span className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${k.up ? "text-emerald-600" : "text-rose-500"}`}>
              <TrendingUp size={12} className={k.up ? "" : "rotate-180"} /> #{k.pos}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
