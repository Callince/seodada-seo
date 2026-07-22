import { ArrowLeftRight, Hash, HelpCircle, Search, Sparkles, Target } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useBulkRank, useSerpRanking, type BulkRankResponse, type BulkRankRow } from "@/api/hooks/useSerp";
import { apiErrorMessage } from "@/api/client";
import { CacheBadge } from "@/components/shared/CacheBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { MetricCard } from "@/components/shared/MetricCard";
import {
  LocationLanguagePicker,
  locationLabel,
} from "@/components/shared/LocationLanguagePicker";
import { PAAList } from "@/components/shared/PAAList";
import { RankBadge } from "@/components/shared/RankBadge";
import { SaveToProject } from "@/components/shared/SaveToProject";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ExcelButton } from "@/components/shared/ExcelButton";
import { usePersistedState } from "@/lib/persist";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";
import { fmtInt } from "@/lib/format";
import type { ComparisonRow, SearchEngine, SerpResponse, SerpResult } from "@/types";

const columns: Column<SerpResult>[] = [
  {
    key: "position", header: "#", align: "right", mono: true,
    sortValue: (r) => r.position,
    render: (r) => <RankBadge position={r.position} />,
  },
  {
    key: "serp_slot", header: "SERP slot", align: "right", mono: true,
    sortValue: (r) => r.serp_slot ?? 999,
    render: (r) => (r.serp_slot != null ? r.serp_slot : "—"),
    csvValue: (r) => r.serp_slot,
  },
  {
    key: "title", header: "Title", sortValue: (r) => r.title,
    render: (r) => (
      <span className="inline-flex items-center gap-2">
        <a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-text hover:text-[color:var(--section-ink)] hover:underline">
          {r.title || r.url}
        </a>
        {r.featured && <Badge tone="warning">featured</Badge>}
      </span>
    ),
    csvValue: (r) => r.title,
  },
  { key: "brand_name", header: "Brand", sortValue: (r) => r.brand_name },
  {
    key: "brand_volume", header: "Brand Volume", align: "right", mono: true,
    sortValue: (r) => r.brand_volume,
    render: (r) => (r.brand_volume != null ? fmtInt(r.brand_volume) : "—"),
    csvValue: (r) => r.brand_volume,
  },
  {
    key: "url", header: "URL", sortValue: (r) => r.url,
    render: (r) => <span className="text-text-muted">{r.domain}</span>,
    csvValue: (r) => r.url,
  },
  {
    key: "description", header: "Description",
    render: (r) => <span className="line-clamp-2 text-text-muted">{r.description || "—"}</span>,
    csvValue: (r) => r.description,
  },
];

const normDomain = (d: string | null | undefined) => (d ?? "").toLowerCase().replace(/^www\./, "");

/** Engines offered in the picker, with what each run actually costs.
 *
 *  Both are DataForSEO — verified live to take an identical payload and parse
 *  with the same code, at the same price.
 *
 *  Yahoo is supported by the API (0.350¢) but not offered here: 75% dearer than
 *  Google or Bing for markedly less search share.
 */
const ENGINES: { id: SearchEngine; label: string; hint: string }[] = [
  { id: "google", label: "Google", hint: "0.20¢ per crawl · the only engine with AI Overview and People Also Ask" },
  { id: "bing", label: "Bing", hint: "0.20¢ per crawl · same price as Google. Organic results only — no PAA" },
];
/** Display names for *every* engine the API can return, which is wider than the
 *  picker offers — a response can be tagged `yahoo` without it appearing above.
 *  Deriving this from ENGINES would leave such runs labelled "Google". */
const ENGINE_LABEL: Record<string, string> = {
  google: "Google",
  bing: "Bing",
  yahoo: "Yahoo",
};

/**
 * One row per URL, showing where it sits on each engine.
 *
 * Built from the backend's `comparison`, which keys on URL rather than domain —
 * a domain can hold several slots on one SERP and merging them would report a
 * rank it does not hold. An engine missing from `ranks` means the URL was not
 * in the top N *that engine returned*, which is why it renders as "—" and not
 * as a number.
 */
function EngineComparison({
  rows, engines, highlight,
}: {
  rows: ComparisonRow[]; engines: SearchEngine[]; highlight: string;
}) {
  const hl = normDomain(highlight.trim());
  const isHit = (d: string) => !!hl && (normDomain(d) === hl || normDomain(d).endsWith("." + hl));
  const agreed = rows.filter((r) => r.engine_count === engines.length).length;

  const cols: Column<ComparisonRow>[] = [
    {
      key: "domain", header: "Result", sortValue: (r) => r.domain,
      render: (r) => (
        <div className="min-w-0">
          <a
            href={r.url}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "block truncate font-medium hover:underline",
              isHit(r.domain) ? "text-[color:var(--section-ink)]" : "text-text",
            )}
          >
            {r.domain}
          </a>
          <p className="truncate text-xs text-text-muted">{r.title || r.url}</p>
        </div>
      ),
      csvValue: (r) => r.domain,
    },
    ...engines.map<Column<ComparisonRow>>((eng) => ({
      key: eng,
      header: ENGINE_LABEL[eng] ?? eng,
      align: "right",
      mono: true,
      // Absent = not ranked at all, so it must sort *below* every real rank
      // rather than alongside rank 0.
      sortValue: (r) => r.ranks[eng] ?? 9999,
      render: (r) =>
        r.ranks[eng] == null
          ? <span className="text-text-muted" title={`Not in the top results on ${ENGINE_LABEL[eng] ?? eng}`}>—</span>
          : <RankBadge position={r.ranks[eng]!} />,
      csvValue: (r) => r.ranks[eng] ?? null,
    })),
    {
      key: "engine_count", header: "Agreement", align: "right",
      sortValue: (r) => r.engine_count,
      render: (r) =>
        r.engine_count === engines.length
          ? <Badge tone="success">all {engines.length}</Badge>
          : <Badge tone="neutral">{r.engine_count} of {engines.length}</Badge>,
      csvValue: (r) => r.engine_count,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge tone="primary">{rows.length} results across {engines.length} engines</Badge>
        <Badge tone="success">{agreed} ranked by all {engines.length}</Badge>
        <span className="text-text-muted">
          Engines index the web separately — little overlap is normal, not an error.
        </span>
      </div>
      <DataTable columns={cols} rows={rows} csvName="serp-engine-comparison" />
    </div>
  );
}

/** The crawled SERP rendered the way Google presents it. */
function GoogleView({ results, highlight }: { results: SerpResult[]; highlight: string }) {
  const hl = normDomain(highlight.trim());
  if (!results.length) return <p className="text-sm text-text-muted">No organic results.</p>;
  return (
    <div className="max-w-2xl space-y-4">
      {results.map((r) => {
        const hit = hl && (normDomain(r.domain) === hl || normDomain(r.domain).endsWith("." + hl));
        return (
          <div
            key={`${r.position}-${r.url}`}
            className={cn("rounded-md p-3", hit && "bg-[color:var(--section-soft)] ring-1 ring-[color:var(--section)]")}
          >
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <RankBadge position={r.position} />
              {r.featured && <Badge tone="warning">featured snippet</Badge>}
              <span className="truncate">{r.url}</span>
            </div>
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 block truncate text-[15px] font-medium text-accent hover:underline"
            >
              {r.title || r.url}
            </a>
            {r.description && <p className="line-clamp-2 text-sm text-text-muted">{r.description}</p>}
          </div>
        );
      })}
    </div>
  );
}

interface DiffRow {
  domain: string;
  title: string;
  posA: number | null;
  posB: number | null;
}

function buildDiff(a: SerpResult[], b: SerpResult[]): DiffRow[] {
  const best = (rows: SerpResult[]) => {
    const m = new Map<string, SerpResult>();
    for (const r of rows) {
      const d = normDomain(r.domain);
      if (d && (!m.has(d) || (r.position ?? 999) < (m.get(d)!.position ?? 999))) m.set(d, r);
    }
    return m;
  };
  const ma = best(a), mb = best(b);
  const domains = [...new Set([...ma.keys(), ...mb.keys()])];
  const rows: DiffRow[] = domains.map((d) => ({
    domain: d,
    title: (ma.get(d) ?? mb.get(d))!.title,
    posA: ma.get(d)?.position ?? null,
    posB: mb.get(d)?.position ?? null,
  }));
  rows.sort((x, y) => Math.min(x.posA ?? 999, x.posB ?? 999) - Math.min(y.posA ?? 999, y.posB ?? 999));
  return rows;
}

function CompareView({
  a, b, labelA, labelB, highlight,
}: {
  a: SerpResponse; b: SerpResponse; labelA: string; labelB: string; highlight: string;
}) {
  const rows = buildDiff(a.results, b.results);
  const hl = normDomain(highlight.trim());
  const onlyA = rows.filter((r) => r.posA != null && r.posB == null).length;
  const onlyB = rows.filter((r) => r.posB != null && r.posA == null).length;
  const hlRow = hl ? rows.find((r) => r.domain === hl || r.domain.endsWith("." + hl)) : null;

  const diffCols: Column<DiffRow>[] = [
    {
      key: "domain", header: "Domain", sortValue: (r) => r.domain,
      render: (r) => (
        <div className="min-w-0">
          <p className={cn("truncate font-medium", hl && (r.domain === hl || r.domain.endsWith("." + hl)) ? "text-[color:var(--section-ink)]" : "text-text")}>
            {r.domain}
          </p>
          <p className="truncate text-xs text-text-muted">{r.title}</p>
        </div>
      ),
    },
    {
      key: "posA", header: labelA, align: "right", mono: true,
      sortValue: (r) => r.posA ?? 999,
      render: (r) => (r.posA == null ? <span className="text-text-muted">—</span> : `#${r.posA}`),
      csvValue: (r) => r.posA,
    },
    {
      key: "posB", header: labelB, align: "right", mono: true,
      sortValue: (r) => r.posB ?? 999,
      render: (r) => (r.posB == null ? <span className="text-text-muted">—</span> : `#${r.posB}`),
      csvValue: (r) => r.posB,
    },
    {
      key: "delta", header: "Δ", align: "right", mono: true,
      sortValue: (r) => (r.posA != null && r.posB != null ? r.posA - r.posB : -999),
      render: (r) => {
        if (r.posA == null && r.posB != null) return <Badge tone="info">only {labelB.split(",")[0]}</Badge>;
        if (r.posB == null && r.posA != null) return <Badge tone="neutral">only {labelA.split(",")[0]}</Badge>;
        const d = (r.posA ?? 0) - (r.posB ?? 0);
        if (d === 0) return <span className="text-text-muted">=</span>;
        return <span className={d > 0 ? "text-success" : "text-danger"}>{d > 0 ? `▲${d}` : `▼${-d}`}</span>;
      },
      csvValue: (r) => (r.posA != null && r.posB != null ? r.posA - r.posB : null),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge tone="primary">{rows.length} domains compared</Badge>
        <Badge tone="neutral">{onlyA} only in {labelA}</Badge>
        <Badge tone="info">{onlyB} only in {labelB}</Badge>
      </div>
      {hl && (
        <Card className={hlRow ? "border-[color:var(--section)] bg-[color:var(--section-soft)]" : "border-warning/40 bg-warning/5"}>
          <CardBody className="py-3 text-sm">
            {hlRow ? (
              <>
                <span className="font-medium text-text">{highlight.trim()}</span>:{" "}
                {hlRow.posA != null ? `#${hlRow.posA}` : "absent"} in {labelA} ·{" "}
                {hlRow.posB != null ? `#${hlRow.posB}` : "absent"} in {labelB}
              </>
            ) : (
              <>
                <span className="font-medium text-text">{highlight.trim()}</span> is absent from{" "}
                <strong>both</strong> crawled SERPs — if you see it in your own browser, that view is
                being shaped by your search history and precise location.
              </>
            )}
          </CardBody>
        </Card>
      )}
      <DataTable columns={diffCols} rows={rows} csvName="serp-compare" />
    </div>
  );
}

/**
 * Bulk rank results: one row per keyword showing *your* position and the URL
 * that is actually indexed — not the whole SERP.
 *
 * Keywords you do not rank for are kept, not hidden. You were billed for that
 * lookup either way, and "an AI-free page-2 gap a competitor owns" is the row
 * worth acting on; dropping it would make a missing keyword indistinguishable
 * from one that was never searched.
 */
function BulkRankTable({ data }: { data: BulkRankResponse }) {
  const engines = data.engines;
  const cols: Column<BulkRankRow>[] = [
    {
      key: "keyword", header: "Keyword",
      sortValue: (r) => r.keyword,
      render: (r) => <span className="font-medium text-text">{r.keyword}</span>,
    },
    ...engines.map<Column<BulkRankRow>>((eng) => ({
      key: eng,
      header: engines.length > 1 ? `${ENGINE_LABEL[eng] ?? eng} rank` : "Your rank",
      align: "right",
      mono: true,
      // Absent must sort *below* every real position, not alongside rank 0.
      sortValue: (r) => r.ranks[eng] ?? 9999,
      render: (r) =>
        r.ranks[eng] == null
          ? <span className="whitespace-nowrap text-xs text-text-muted">not ranking</span>
          : <RankBadge position={r.ranks[eng]!} />,
      csvValue: (r) => r.ranks[eng] ?? null,
    })),
    {
      key: "url", header: "Indexed page",
      sortValue: (r) => r.urls[engines[0]] ?? "",
      render: (r) => {
        // Whichever engine gave the best position is the one whose URL we show
        // — with several of your pages competing, this is the one that won.
        const best = engines.reduce<string | null>(
          (acc, e) => (r.ranks[e] != null && (acc === null || r.ranks[e]! < (r.ranks[acc as SearchEngine] ?? 9999)) ? e : acc),
          null,
        ) as SearchEngine | null;
        const url = best ? r.urls[best] : undefined;
        if (!url) return <span className="text-text-muted">—</span>;
        return (
          <a href={url} target="_blank" rel="noreferrer" className="block max-w-md truncate text-text hover:text-[color:var(--section-ink)] hover:underline" title={url}>
            {url.replace(/^https?:\/\//, "")}
          </a>
        );
      },
      csvValue: (r) => {
        const best = engines.find((e) => r.ranks[e] != null);
        return best ? r.urls[best] ?? null : null;
      },
    },
  ];

  const missing = data.checked - data.ranked;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge tone="success">{data.ranked} ranking</Badge>
        <Badge tone="neutral">{missing} not ranking</Badge>
        <span className="text-text-muted">
          {missing > 0
            ? `Those ${missing} are your gaps — a competitor holds the spot for each.`
            : "Every keyword places somewhere in the crawled depth."}
        </span>
      </div>
      <DataTable columns={cols} rows={data.rows} csvName={`bulk-rank-${data.domain}`} />
    </div>
  );
}

export default function SerpRanking({ embedded }: { embedded?: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [keyword, setKeyword] = useState(() => searchParams.get("q") ?? "");
  const [loc, setLoc] = usePersistedState("serp.loc", { location_code: 2840, language_code: "en" });
  const [loc2, setLoc2] = usePersistedState("serp.loc2", { location_code: 2356, language_code: "en" });
  const [depth, setDepth] = useState(100);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [live, setLive] = useState(false);
  const [compare, setCompare] = useState(false);
  // Google alone by default, so an unchanged run costs exactly what it did
  // before engines existed. Kept across in-app navigation like the other
  // controls here (module-level store — a full reload starts fresh).
  const [engines, setEngines] = usePersistedState<SearchEngine[]>("serp.engines", ["google"]);
  // Off by default: brand volume is a second billed lookup that costs several
  // times the SERP crawl. Remembered, so anyone who wants it keeps it.
  const [brandVol, setBrandVol] = usePersistedState("serp.brandVolume", false);
  const [highlight, setHighlight] = useState("");
  // "one" = crawl a full SERP for a single keyword. "bulk" = ask where one
  // domain ranks across many keywords, showing only your own row per keyword.
  const [mode, setMode] = usePersistedState<"one" | "bulk">("serp.mode", "one");
  const [bulkRaw, setBulkRaw] = usePersistedState("serp.bulkKeywords", "");
  const [bulkDomain, setBulkDomain] = usePersistedState("serp.bulkDomain", "");
  const bulk = useBulkRank();
  const [view, setView] = useState<string | null>(null);
  const mutation = useSerpRanking();
  const mutation2 = useSerpRanking();
  const data = mutation.data;
  const mutateRef = useRef(mutation.mutate);
  mutateRef.current = mutation.mutate;
  const depthRef = useRef(depth);
  depthRef.current = depth;
  const locRef = useRef(loc);
  locRef.current = loc;

  // Unchecking the last engine would send an empty list, which the API rejects
  // — keep at least one selected rather than surfacing a validation error.
  const toggleEngine = (id: SearchEngine) =>
    setEngines((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((e) => e !== id) : prev) : [...prev, id],
    );

  const run = () => {
    const kw = keyword.trim();
    if (!kw) return;
    setView(null);  // back to auto so a new engine set picks its own best tab
    const base = { keyword: kw, depth, device, engines, force_live: live, with_brand_volume: brandVol };
    mutation.mutate({ ...loc, ...base });
    // Market compare runs the same engine set against a second location; its
    // diff uses each response's primary engine.
    if (compare) mutation2.mutate({ ...loc2, ...base });
  };

  // Auto-run when arriving from the dashboard quick-search (?q=...).
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && q.trim()) {
      mutateRef.current({ ...locRef.current, keyword: q.trim(), depth: depthRef.current });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const bulkKeywords = useMemo(
    () => Array.from(new Set(bulkRaw.split(/[\n,]+/).map((k) => k.trim().toLowerCase()).filter(Boolean))).slice(0, 50),
    [bulkRaw],
  );

  /**
   * Measured DataForSEO prices per SERP call, by crawl depth. Bulk multiplies
   * this by keywords x engines, so a 20-keyword two-engine run at depth 100 is
   * ~62c — far too much to leave implicit behind a button.
   */
  const COST_BY_DEPTH: Record<number, number> = { 10: 0.2, 20: 0.35, 50: 0.8, 100: 1.55 };
  const bulkCostCents = bulkKeywords.length * engines.length * (COST_BY_DEPTH[depth] ?? 1.55);

  const runBulk = () => {
    const d = bulkDomain.trim();
    if (!d || bulkKeywords.length === 0 || bulk.isPending) return;
    bulk.mutate({
      ...loc, keywords: bulkKeywords, domain: d, depth, device, engines, force_live: live,
    });
  };

  const pending = mutation.isPending || (compare && mutation2.isPending);
  const failedEngines = (data?.engines ?? []).filter((e) => e.error);
  // Only engines that actually returned rows get a comparison column — a failed
  // engine would otherwise render as a column of dashes indistinguishable from
  // "ranked nowhere".
  const rankedEngines = (data?.engines ?? []).filter((e) => !e.error).map((e) => e.engine);
  const primaryEngine = rankedEngines[0] ?? "google";
  const primaryLabel = ENGINE_LABEL[primaryEngine] ?? primaryEngine;

  // `view === null` means "no explicit choice yet", so a multi-engine run lands
  // on the comparison — that is what the extra engines were paid for. Derived
  // rather than synced in an effect: picking a tab sets `view` and sticks, and
  // starting a new run clears it back to auto.
  const effectiveView = view ?? (data && data.comparison.length > 0 ? "engines" : "google");

  return (
    <div>
      {!embedded && (
        <PageHeader
          title="SERP Ranking"
          subtitle="Crawl Google's results for any keyword — see them as Google shows them, compare two markets, and spot exactly where any domain sits."
        />
      )}

      <Card className="mb-5">
        <CardBody className="space-y-3">
          {/* Two genuinely different questions, so two modes rather than one
              overloaded form: "show me this SERP" vs "where do I rank across
              these keywords". The location/depth/device/engine controls below
              are shared because both modes need exactly the same ones. */}
          <Tabs value={mode} onChange={(v) => setMode(v as "one" | "bulk")}>
            <TabsList>
              <TabsTrigger value="one">Single keyword</TabsTrigger>
              <TabsTrigger value="bulk">Bulk rank check</TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === "bulk" && (
            <div className="space-y-3">
              <Input
                value={bulkDomain}
                onChange={(e) => setBulkDomain(e.target.value)}
                aria-label="Your domain"
                placeholder="Your domain — e.g. komaki.in"
              />
              <textarea
                value={bulkRaw}
                onChange={(e) => setBulkRaw(e.target.value)}
                rows={4}
                aria-label="Keywords"
                placeholder={"One keyword per line (or comma-separated) — up to 50.\nbest electric scooter in india\nelectric scooter under 50000"}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--section)]"
              />
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); if (mode === "bulk") runBulk(); else run(); }} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {mode === "one" && (
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                aria-label="Keyword"
                placeholder="Enter a keyword, e.g. running shoes"
                className="sm:flex-1 sm:basis-64"
              />
            )}
            <LocationLanguagePicker value={loc} onChange={setLoc} />
            {compare && (
              <span className="flex items-center gap-2">
                <ArrowLeftRight size={14} className="text-text-muted" />
                <LocationLanguagePicker value={loc2} onChange={setLoc2} />
              </span>
            )}
            <Select value={depth} onChange={(e) => setDepth(Number(e.target.value))} aria-label="Number of results">
              <option value={10}>Top 10</option>
              <option value={20}>Top 20</option>
              <option value={50}>Top 50</option>
              <option value={100}>Top 100</option>
            </Select>
            <Select
              value={device}
              onChange={(e) => setDevice(e.target.value as "desktop" | "mobile")}
              aria-label="Device"
              title="Google serves different results to phones and desktops"
            >
              <option value="desktop">Desktop</option>
              <option value="mobile">Mobile</option>
            </Select>
            <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-text-muted" title="Bypass the cache and fetch fresh (billed) data">
              <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} className="h-4 w-4 accent-[var(--section)]" />
              Live
            </label>
            {/* Market compare and brand volume are single-keyword concepts:
                diffing two markets across 50 keywords is a different report,
                and brand volume bills per brand on every SERP fetched. */}
            {mode === "one" && (
              <>
                <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-text-muted" title="Crawl the same keyword in a second market and diff the results">
                  <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="h-4 w-4 accent-[var(--section)]" />
                  Compare markets
                </label>
                <label
                  className="flex items-center gap-1.5 whitespace-nowrap text-sm text-text-muted"
                  title="Look up monthly search volume for each brand in the results. Billed per brand — typically several times the cost of the SERP crawl itself."
                >
                  <input type="checkbox" checked={brandVol} onChange={(e) => setBrandVol(e.target.checked)} className="h-4 w-4 accent-[var(--section)]" />
                  Brand volume
                </label>
              </>
            )}
            {mode === "one" ? (
              <Button type="submit" disabled={pending || !keyword.trim()}>
                <Search size={16} />{" "}
                {pending
                  ? "Crawling…"
                  : engines.length === 1
                    ? `Crawl ${ENGINE_LABEL[engines[0]] ?? engines[0]}`
                    : `Crawl ${engines.length} engines`}
              </Button>
            ) : (
              <Button type="submit" loading={bulk.isPending} disabled={!bulkDomain.trim() || bulkKeywords.length === 0}>
                {!bulk.isPending && <Search size={16} />} Check {bulkKeywords.length || ""} keyword{bulkKeywords.length === 1 ? "" : "s"}
              </Button>
            )}
          </form>

          {/* Bulk multiplies cost by keywords x engines, so the estimate is
              shown before the click rather than discovered on the invoice. */}
          {mode === "bulk" && (
            <p className="text-xs text-text-muted">
              {bulkKeywords.length === 0 ? (
                "Add keywords above — one billed SERP lookup per keyword, per engine."
              ) : (
                <>
                  {bulkKeywords.length} keyword{bulkKeywords.length === 1 ? "" : "s"} ×{" "}
                  {engines.length} engine{engines.length === 1 ? "" : "s"} at top {depth}:{" "}
                  <span className="font-medium text-text">up to {bulkCostCents.toFixed(2)}¢</span>
                  {/* Deliberately "up to": DataForSEO bills on results actually
                      returned, not the depth requested — a thin SERP at depth
                      100 came back at 0.35c against 1.55c for a full one. Cached
                      keywords cost nothing at all. */}
                  {" "}· usually less, and repeat runs hit the cache for free.
                </>
              )}
            </p>
          )}

          <fieldset className="flex flex-wrap items-center gap-2">
            <legend className="sr-only">Search engines to crawl</legend>
            <span className="text-sm text-text-muted">Engines:</span>
            {ENGINES.map((e) => {
              const on = engines.includes(e.id);
              const isLast = on && engines.length === 1;
              return (
                <label
                  key={e.id}
                  title={isLast ? `${e.hint} — at least one engine must stay selected` : e.hint}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
                    on
                      ? "border-[color:var(--section)] bg-[color:var(--section-soft)] text-[color:var(--section-ink)]"
                      : "border-border text-text-muted hover:border-[color:var(--section)]",
                    isLast && "cursor-not-allowed",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={isLast}
                    onChange={() => toggleEngine(e.id)}
                    className="h-3.5 w-3.5 accent-[var(--section)]"
                  />
                  {e.label}
                </label>
              );
            })}
            {engines.length > 1 && (
              <span className="text-xs text-text-muted">
                One billed crawl per engine — they run in parallel.
              </span>
            )}
          </fieldset>

          <Input
            value={highlight}
            onChange={(e) => setHighlight(e.target.value)}
            aria-label="Highlight a domain in the results"
            placeholder="Highlight a domain in the results (optional) — e.g. komaki.in"
            className="sm:w-96"
          />
        </CardBody>
      </Card>

      {/* ── Bulk rank results ─────────────────────────────────────────────── */}
      {mode === "bulk" && (
        <>
          {bulk.isPending && (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          )}
          {bulk.isError && !bulk.isPending && (
            <ErrorState message={apiErrorMessage(bulk.error)} onRetry={runBulk} />
          )}
          {!bulk.isPending && !bulk.isError && !bulk.data && (
            <EmptyState
              title="Check where you rank"
              hint="Enter your domain and a list of keywords. You get one row per keyword — your position and the exact page Google has indexed — instead of a full results page for each."
            />
          )}
          {bulk.data && !bulk.isPending && (
            <Card className="animate-fade-rise">
              <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>
                    {bulk.data.domain} · {bulk.data.ranked} of {bulk.data.checked} ranking
                  </CardTitle>
                  <p className="mt-0.5 text-xs text-text-muted">
                    Top {depth} · {locationLabel(loc.location_code)} · {device}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CacheBadge meta={bulk.data.meta} />
                  <ExcelButton
                    filename={`bulk-rank-${bulk.data.domain}`}
                    build={() => ({
                      summary: {
                        Report: "Bulk rank check",
                        Domain: bulk.data!.domain,
                        Market: locationLabel(loc.location_code),
                        Device: device,
                        Depth: depth,
                        Engines: bulk.data!.engines.join(", "),
                        "Keywords checked": bulk.data!.checked,
                        Ranking: bulk.data!.ranked,
                        "Not ranking": bulk.data!.checked - bulk.data!.ranked,
                        Generated: new Date().toLocaleString(),
                      },
                      sheets: [
                        {
                          name: "Rank by keyword",
                          columns: [
                            { header: "Keyword", key: "keyword", width: 40 },
                            ...bulk.data!.engines.map((e) => ({
                              header: `${ENGINE_LABEL[e] ?? e} rank`, key: `rank_${e}`, width: 14,
                            })),
                            { header: "Indexed page", key: "url", width: 60 },
                          ],
                          rows: bulk.data!.rows.map((r) => {
                            const best = bulk.data!.engines.find((e) => r.ranks[e] != null);
                            return {
                              keyword: r.keyword,
                              ...Object.fromEntries(
                                bulk.data!.engines.map((e) => [`rank_${e}`, r.ranks[e] ?? "not ranking"]),
                              ),
                              url: best ? r.urls[best] ?? "" : "",
                            };
                          }) as unknown as Record<string, unknown>[],
                        },
                      ],
                    })}
                  />
                </div>
              </CardHeader>
              <CardBody className="p-0">
                <BulkRankTable data={bulk.data} />
              </CardBody>
            </Card>
          )}
        </>
      )}

      {mode === "one" && pending && (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {mode === "one" && mutation.isError && !pending && (
        <ErrorState message={apiErrorMessage(mutation.error)} onRetry={run} />
      )}

      {mode === "one" && !pending && !mutation.isError && !data && (
        <EmptyState title="Crawl your first SERP" hint="Enter a keyword to fetch Google's actual results — the neutral view, free of your personal search history." />
      )}

      {mode === "one" && data && !pending && (
        <div className="animate-fade-rise space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-text">
              {data.results.length} results for <span className="text-[color:var(--section-ink)]">“{data.keyword}”</span>
              <span className="ml-2 text-sm font-normal text-text-muted">{locationLabel(loc.location_code)}</span>
            </h2>
            <div className="flex items-center gap-2">
              <CacheBadge meta={data.meta} />
              <ExcelButton
                filename={`serp-${data.keyword}`}
                build={() => ({
                  summary: {
                    Report: "SERP Ranking",
                    Keyword: data.keyword,
                    Market: locationLabel(loc.location_code),
                    Device: device,
                    Results: data.results.length,
                    Generated: new Date().toLocaleString(),
                  },
                  sheets: [
                    {
                      name: "Results",
                      columns: [
                        { header: "Position", key: "position", width: 10 },
                        { header: "Domain", key: "domain", width: 28 },
                        { header: "Title", key: "title", width: 50 },
                        { header: "URL", key: "url", width: 60 },
                        { header: "Brand", key: "brand_name", width: 18 },
                        { header: "Brand volume", key: "brand_volume", width: 14 },
                      ],
                      rows: data.results as unknown as Record<string, unknown>[],
                    },
                    {
                      name: "People Also Ask",
                      columns: [
                        { header: "Question", key: "question", width: 60 },
                        { header: "Answer", key: "answer", width: 80 },
                        { header: "Source", key: "url", width: 50 },
                      ],
                      rows: (data.paa ?? []) as unknown as Record<string, unknown>[],
                    },
                  ],
                })}
              />
              <SaveToProject
                module="serp"
                params={{ ...loc, keyword: data.keyword }}
                result={data as unknown as Record<string, unknown>}
              />
            </div>
          </div>

          {!compare && data.results.length > 0 && (() => {
            const hlNorm = normDomain(highlight.trim());
            const hlHit = hlNorm
              ? data.results.find((r) => normDomain(r.domain) === hlNorm || normDomain(r.domain).endsWith("." + hlNorm))
              : null;
            return (
              <div className={cn("grid grid-cols-2 gap-4", hlNorm ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
                <MetricCard icon={Hash} label="Organic results" value={fmtInt(data.results.length)} />
                <MetricCard icon={Sparkles} label="Featured snippet" value={data.results.some((r) => r.featured) ? "Yes" : "No"} />
                <MetricCard icon={HelpCircle} label="People Also Ask" value={fmtInt(data.paa.length)} />
                {hlNorm && (
                  <MetricCard
                    icon={Target}
                    label={highlight.trim()}
                    value={hlHit?.position != null ? `#${hlHit.position}` : "Not ranking"}
                    sub={hlHit ? "best position" : "absent from results"}
                  />
                )}
              </div>
            );
          })()}

          {/* An engine that failed on its own — the run still succeeded on the
              others, so this is a notice, not an error state. */}
          {failedEngines.length > 0 && (
            <Card className="border-warning/40 bg-warning/5">
              <CardBody className="space-y-1 py-3 text-sm">
                {failedEngines.map((e) => (
                  <p key={e.engine}>
                    <span className="font-medium text-text">{ENGINE_LABEL[e.engine] ?? e.engine}</span>{" "}
                    <span className="text-text-muted">didn’t return results — {e.error}</span>
                  </p>
                ))}
              </CardBody>
            </Card>
          )}

          {compare && mutation2.data ? (
            <CompareView
              a={data}
              b={mutation2.data}
              labelA={locationLabel(loc.location_code)}
              labelB={locationLabel(loc2.location_code)}
              highlight={highlight}
            />
          ) : data.results.length ? (
            <Tabs value={effectiveView} onChange={setView}>
              <TabsList>
                {data.comparison.length > 0 && (
                  <TabsTrigger value="engines">Engine comparison</TabsTrigger>
                )}
                <TabsTrigger value="google">{primaryLabel} view</TabsTrigger>
                <TabsTrigger value="table">Data table</TabsTrigger>
              </TabsList>
              <div className="mt-4">
                {data.comparison.length > 0 && (
                  <TabsContent value="engines">
                    <EngineComparison
                      rows={data.comparison}
                      engines={rankedEngines}
                      highlight={highlight}
                    />
                  </TabsContent>
                )}
                <TabsContent value="google">
                  <GoogleView results={data.results} highlight={highlight} />
                </TabsContent>
                <TabsContent value="table">
                  <DataTable columns={columns} rows={data.results} csvName={`serp-${data.keyword}`} />
                </TabsContent>
              </div>
            </Tabs>
          ) : (
            <EmptyState title="No organic results" hint="No organic listings were returned for this query." />
          )}

          {!compare && data.paa.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>People Also Ask</CardTitle>
              </CardHeader>
              <CardBody className="p-0">
                <PAAList items={data.paa} />
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
