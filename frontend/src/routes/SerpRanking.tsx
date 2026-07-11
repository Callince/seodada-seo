import { ArrowLeftRight, Hash, HelpCircle, Search, Sparkles, Target } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useSerpRanking } from "@/api/hooks/useSerp";
import { apiErrorMessage } from "@/api/client";
import { CacheBadge } from "@/components/shared/CacheBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { MetricCard } from "@/components/shared/MetricCard";
import {
  LocationLanguagePicker,
  locationLabel,
} from "@/components/shared/LocationLanguagePicker";
import { PAAList } from "@/components/shared/PAAList";
import { SaveToProject } from "@/components/shared/SaveToProject";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { usePersistedState } from "@/lib/persist";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";
import { fmtInt } from "@/lib/format";
import type { SerpResponse, SerpResult } from "@/types";

const columns: Column<SerpResult>[] = [
  { key: "position", header: "#", align: "right", mono: true, sortValue: (r) => r.position },
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
        <a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-text hover:text-[color:var(--section)] hover:underline">
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
              <span className="flex h-5 min-w-7 items-center justify-center rounded bg-surface-2 px-1 font-mono">
                {r.position}
              </span>
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
          <p className={cn("truncate font-medium", hl && (r.domain === hl || r.domain.endsWith("." + hl)) ? "text-[color:var(--section)]" : "text-text")}>
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

export default function SerpRanking({ embedded }: { embedded?: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [keyword, setKeyword] = useState(() => searchParams.get("q") ?? "");
  const [loc, setLoc] = usePersistedState("serp.loc", { location_code: 2840, language_code: "en" });
  const [loc2, setLoc2] = usePersistedState("serp.loc2", { location_code: 2356, language_code: "en" });
  const [depth, setDepth] = useState(100);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [live, setLive] = useState(false);
  const [compare, setCompare] = useState(false);
  const [highlight, setHighlight] = useState("");
  const [view, setView] = useState("google");
  const mutation = useSerpRanking();
  const mutation2 = useSerpRanking();
  const data = mutation.data;
  const mutateRef = useRef(mutation.mutate);
  mutateRef.current = mutation.mutate;
  const depthRef = useRef(depth);
  depthRef.current = depth;
  const locRef = useRef(loc);
  locRef.current = loc;

  const run = () => {
    const kw = keyword.trim();
    if (!kw) return;
    mutation.mutate({ ...loc, keyword: kw, depth, device, force_live: live });
    if (compare) mutation2.mutate({ ...loc2, keyword: kw, depth, device, force_live: live });
  };

  // Auto-run when arriving from the dashboard quick-search (?q=...).
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && q.trim()) {
      mutateRef.current({ ...locRef.current, keyword: q.trim(), depth: depthRef.current });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const pending = mutation.isPending || (compare && mutation2.isPending);

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
          <form onSubmit={(e) => { e.preventDefault(); run(); }} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              aria-label="Keyword"
              placeholder="Enter a keyword, e.g. running shoes"
              className="sm:flex-1 sm:basis-64"
            />
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
            <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-text-muted" title="Crawl the same keyword in a second market and diff the results">
              <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="h-4 w-4 accent-[var(--section)]" />
              Compare markets
            </label>
            <Button type="submit" disabled={pending || !keyword.trim()}>
              <Search size={16} /> {pending ? "Crawling…" : "Crawl Google"}
            </Button>
          </form>
          <Input
            value={highlight}
            onChange={(e) => setHighlight(e.target.value)}
            aria-label="Highlight a domain in the results"
            placeholder="Highlight a domain in the results (optional) — e.g. komaki.in"
            className="sm:w-96"
          />
        </CardBody>
      </Card>

      {pending && (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {mutation.isError && !pending && (
        <ErrorState message={apiErrorMessage(mutation.error)} onRetry={run} />
      )}

      {!pending && !mutation.isError && !data && (
        <EmptyState title="Crawl your first SERP" hint="Enter a keyword to fetch Google's actual results — the neutral view, free of your personal search history." />
      )}

      {data && !pending && (
        <div className="animate-fade-rise space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-text">
              {data.results.length} results for <span className="text-[color:var(--section)]">“{data.keyword}”</span>
              <span className="ml-2 text-sm font-normal text-text-muted">{locationLabel(loc.location_code)}</span>
            </h2>
            <div className="flex items-center gap-2">
              <CacheBadge meta={data.meta} />
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

          {compare && mutation2.data ? (
            <CompareView
              a={data}
              b={mutation2.data}
              labelA={locationLabel(loc.location_code)}
              labelB={locationLabel(loc2.location_code)}
              highlight={highlight}
            />
          ) : data.results.length ? (
            <Tabs value={view} onChange={setView}>
              <TabsList>
                <TabsTrigger value="google">Google view</TabsTrigger>
                <TabsTrigger value="table">Data table</TabsTrigger>
              </TabsList>
              <div className="mt-4">
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
