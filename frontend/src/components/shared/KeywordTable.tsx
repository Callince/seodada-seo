import { DataTable, type Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { fmtInt } from "@/lib/format";
import type { KeywordRow } from "@/types";

function difficultyTone(kd: number): "success" | "warning" | "danger" {
  if (kd < 40) return "success";
  if (kd < 70) return "warning";
  return "danger";
}

const intentTone: Record<string, "info" | "primary" | "warning" | "neutral"> = {
  informational: "info",
  commercial: "primary",
  transactional: "warning",
  navigational: "neutral",
};

const columns: Column<KeywordRow>[] = [
  { key: "keyword", header: "Keyword", sortValue: (r) => r.keyword },
  {
    key: "search_volume",
    header: "Volume",
    align: "right",
    mono: true,
    sortValue: (r) => r.search_volume,
    render: (r) => fmtInt(r.search_volume),
    csvValue: (r) => r.search_volume,
  },
  {
    key: "keyword_difficulty",
    header: "Difficulty",
    align: "right",
    sortValue: (r) => r.keyword_difficulty,
    render: (r) =>
      r.keyword_difficulty == null ? (
        "—"
      ) : (
        <Badge tone={difficultyTone(r.keyword_difficulty)}>{r.keyword_difficulty}</Badge>
      ),
    csvValue: (r) => r.keyword_difficulty,
  },
  {
    key: "intent",
    header: "Intent",
    sortValue: (r) => r.intent,
    render: (r) =>
      r.intent ? <Badge tone={intentTone[r.intent] ?? "neutral"}>{r.intent}</Badge> : "—",
    csvValue: (r) => r.intent,
  },
  {
    key: "cpc",
    header: "CPC",
    align: "right",
    mono: true,
    sortValue: (r) => r.cpc,
    render: (r) => (r.cpc == null ? "—" : `$${r.cpc.toFixed(2)}`),
    csvValue: (r) => r.cpc,
  },
];

export function KeywordTable({ rows, csvName }: { rows: KeywordRow[]; csvName?: string }) {
  return <DataTable columns={columns} rows={rows} csvName={csvName ?? "keywords"} />;
}
