import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  mono?: boolean;
  render?: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null | undefined;
  csvValue?: (row: T) => string | number | null | undefined;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  csvName?: string;
}

type SortState = { key: string; dir: "asc" | "desc" } | null;

function toCsv<T>(columns: Column<T>[], rows: T[]): string {
  const head = columns.map((c) => `"${c.header}"`).join(",");
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const v = c.csvValue ? c.csvValue(row) : c.sortValue ? c.sortValue(row) : "";
        return `"${String(v ?? "").replace(/"/g, '""')}"`;
      })
      .join(","),
  );
  return [head, ...lines].join("\n");
}

export function DataTable<T>({ columns, rows, csvName = "export" }: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, sort, columns]);

  const toggleSort = (key: string) =>
    setSort((s) =>
      s?.key === key
        ? s.dir === "asc"
          ? { key, dir: "desc" }
          : null
        : { key, dir: "asc" },
    );

  const exportCsv = () => {
    const blob = new Blob([toCsv(columns, sorted)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${csvName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-xs text-text-muted">{rows.length} rows</span>
        <Button variant="ghost" size="sm" onClick={exportCsv} disabled={!rows.length}>
          <Download size={14} /> CSV
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-surface-2">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={
                    c.sortValue
                      ? sort?.key === c.key
                        ? sort.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                      : undefined
                  }
                  className={cn(
                    "px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-text-muted",
                    c.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded uppercase tracking-wide hover:text-text",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--section)]",
                        c.align === "right" && "flex-row-reverse",
                      )}
                    >
                      {c.header}
                      {sort?.key === c.key ? (
                        sort.dir === "asc" ? (
                          <ArrowUp size={12} />
                        ) : (
                          <ArrowDown size={12} />
                        )
                      ) : (
                        <ArrowUpDown size={12} className="opacity-40" />
                      )}
                    </button>
                  ) : (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1",
                        c.align === "right" && "flex-row-reverse",
                      )}
                    >
                      {c.header}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const rowKey =
                columns.map((c) => String(c.sortValue?.(row) ?? c.csvValue?.(row) ?? "")).join("¦") ||
                String(i);
              return (
              <tr key={rowKey} className="border-t border-border hover:bg-[color:var(--section-soft)]">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-4 py-2.5 text-text",
                      c.align === "right" ? "text-right" : "text-left",
                      c.mono && "font-mono tabular-nums",
                    )}
                  >
                    {c.render ? c.render(row) : (c.sortValue?.(row) ?? "")}
                  </td>
                ))}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
