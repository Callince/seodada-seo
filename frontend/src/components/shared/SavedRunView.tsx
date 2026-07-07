import type { ReactNode } from "react";

import { CacheBadge } from "@/components/shared/CacheBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/states";
import { Card, CardBody } from "@/components/ui/card";
import { fmtInt } from "@/lib/format";
import type { Meta } from "@/types";

export const MODULE_LABELS: Record<string, string> = {
  serp: "SERP Ranking",
  "keywords.volume": "Search Volume",
  "keywords.trends": "Trends",
  "keywords.suggestions": "Keyword Suggestions",
  "keywords.related": "Related Keywords",
  "keywords.ideas": "Keyword Ideas",
  "domains.ranked": "Ranked Keywords",
  "domains.competitors": "Competitors",
  "domains.overview": "Domain Overview",
  "domains.intersection": "Keyword Gap",
  onpage: "On-Page Analysis",
  content: "Content Analysis",
  report: "Site Report",
};

const SHORT_STR = 48;

function prettify(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function fmtScalar(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return Number.isInteger(v) ? fmtInt(v) : v.toFixed(2);
  return String(v);
}

type Entry = [string, unknown];

const isMetric = (v: unknown) =>
  typeof v === "number" ||
  typeof v === "boolean" ||
  v == null ||
  (typeof v === "string" && v.length <= SHORT_STR);
const isLongText = (v: unknown) => typeof v === "string" && v.length > SHORT_STR;
const isFlatArray = (v: unknown): v is (string | number)[] =>
  Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string" || typeof x === "number");
const isObjectArray = (v: unknown): v is Record<string, unknown>[] =>
  Array.isArray(v) && v.length > 0 && v.every((x) => isPlainObject(x));

function dynamicColumns(rows: Record<string, unknown>[]): Column<Record<string, unknown>>[] {
  const sample = rows[0] ?? {};
  return Object.keys(sample)
    .filter((k) => !isPlainObject(sample[k]) && !Array.isArray(sample[k]))
    .slice(0, 8)
    .map((k) => ({
      key: k,
      header: prettify(k),
      align: typeof sample[k] === "number" ? "right" : "left",
      mono: typeof sample[k] === "number",
      sortValue: (r) => {
        const v = r[k];
        return typeof v === "number" || typeof v === "string" ? v : "";
      },
      render: (r) => fmtScalar(r[k]),
      csvValue: (r) => {
        const v = r[k];
        return typeof v === "number" || typeof v === "string" ? v : "";
      },
    }));
}

function MetricGrid({ entries }: { entries: Entry[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {entries.map(([k, v]) => (
        <Card key={k}>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{prettify(k)}</p>
            <p className="mt-1 truncate font-mono text-lg text-text" title={fmtScalar(v)}>
              {fmtScalar(v)}
            </p>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function KVGrid({ entries }: { entries: Entry[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1.5 text-sm">
          <span className="shrink-0 text-text-muted">{prettify(k)}</span>
          <span className="truncate text-right font-mono text-text" title={fmtScalar(v)}>
            {fmtScalar(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChipList({ items }: { items: (string | number)[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it, i) => (
        <span key={i} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text">
          {String(it)}
        </span>
      ))}
    </div>
  );
}

function LongText({ label, text }: { label: string; text: string }) {
  return (
    <div className="text-sm">
      <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className="break-words text-text">{text}</p>
    </div>
  );
}

/** Renders an object's fields into aligned sections, recursing into nested
 *  objects/arrays. `depth` controls card vs inline styling. */
function ObjectContents({ obj, depth }: { obj: Record<string, unknown>; depth: number }) {
  const entries = Object.entries(obj).filter(([k]) => k !== "meta");
  const metrics = entries.filter(([, v]) => isMetric(v));
  const longText = entries.filter(([, v]) => isLongText(v));
  const flatArrays = entries.filter(([, v]) => isFlatArray(v));
  const objectArrays = entries.filter(([, v]) => isObjectArray(v));
  const nested = entries.filter(([, v]) => isPlainObject(v));

  const Section = ({ title, children }: { title: string; children: ReactNode }) =>
    depth === 0 ? (
      <Card>
        <CardBody className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{title}</p>
          {children}
        </CardBody>
      </Card>
    ) : (
      <div className="space-y-2 rounded-md border border-border p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{title}</p>
        {children}
      </div>
    );

  return (
    <div className="space-y-4">
      {metrics.length > 0 &&
        (depth === 0 ? <MetricGrid entries={metrics} /> : <KVGrid entries={metrics} />)}

      {longText.map(([k, v]) => (
        <LongText key={k} label={prettify(k)} text={String(v)} />
      ))}

      {flatArrays.map(([k, v]) => (
        <div key={k} className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{prettify(k)}</p>
          <ChipList items={v as (string | number)[]} />
        </div>
      ))}

      {objectArrays.map(([k, v]) => (
        <div key={k} className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{prettify(k)}</p>
          <DataTable columns={dynamicColumns(v as Record<string, unknown>[])} rows={v as Record<string, unknown>[]} csvName={k} />
        </div>
      ))}

      {nested.map(([k, v]) => (
        <Section key={k} title={prettify(k)}>
          <ObjectContents obj={v as Record<string, unknown>} depth={depth + 1} />
        </Section>
      ))}
    </div>
  );
}

export function SavedRunView({
  module,
  result,
}: {
  module: string;
  result: Record<string, unknown>;
}) {
  const meta = result.meta as Meta | undefined;
  const hasData = Object.keys(result).some((k) => k !== "meta" && result[k] != null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text">{MODULE_LABELS[module] ?? module}</span>
        <CacheBadge meta={meta} />
      </div>

      {hasData ? (
        <ObjectContents obj={result} depth={0} />
      ) : (
        <EmptyState title="Empty snapshot" hint="This saved run has no data." />
      )}
    </div>
  );
}
