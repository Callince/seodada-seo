import { ArrowDown, ArrowUp, Minus, Search, X } from "lucide-react";
import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { apiErrorMessage } from "@/api/client";
import { useTracked, useTrackRank, useUntrack } from "@/api/hooks/useRank";
import { CacheBadge } from "@/components/shared/CacheBadge";
import { ExcelButton } from "@/components/shared/ExcelButton";
import { LocationLanguagePicker, locationLabel } from "@/components/shared/LocationLanguagePicker";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { RankTrackResponse, TrackedItem } from "@/types";

function Delta({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="text-text-muted">—</span>;
  if (delta === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-text-muted">
        <Minus size={13} /> 0
      </span>
    );
  const up = delta > 0; // positions moved up = improvement
  return (
    <span className={`inline-flex items-center gap-0.5 ${up ? "text-success" : "text-danger"}`}>
      {up ? <ArrowUp size={13} /> : <ArrowDown size={13} />} {Math.abs(delta)}
    </span>
  );
}

function HistoryChart({ data }: { data: RankTrackResponse }) {
  const points = data.history.map((p) => ({
    date: new Date(p.created_at).toLocaleDateString(),
    position: p.position,
  }));
  const ranked = points.filter((p) => p.position != null).length;
  if (ranked === 0)
    return (
      <p className="text-sm text-text-muted">
        {data.domain} hasn’t appeared in the top {data.depth} results for “{data.keyword}” on any
        check yet, so there’s no position to chart. Try a keyword the domain actually ranks for.
      </p>
    );
  if (ranked < 2)
    return (
      <p className="text-sm text-text-muted">
        Only one ranked observation so far — check again over time to build the history graph.
      </p>
    );
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          minTickGap={24}
        />
        <YAxis
          reversed
          allowDecimals={false}
          domain={[1, "dataMax"]}
          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          width={32}
        />
        <Tooltip
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value) => {
            const v = typeof value === "number" ? value : null;
            return [v == null ? "Not in results" : `#${v}`, "Position"] as [string, string];
          }}
        />
        <Line
          type="monotone"
          dataKey="position"
          stroke="var(--section)"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function TrackedList({
  items,
  onPick,
}: {
  items: TrackedItem[];
  onPick: (it: TrackedItem) => void;
}) {
  const untrack = useUntrack();
  if (!items.length)
    return <p className="text-sm text-text-muted">Nothing tracked yet — run a check above.</p>;

  const remove = (it: TrackedItem) => {
    // Destructive: tracking is derived from the snapshots, so this drops the
    // position history and stops the daily recheck. Confirm before doing it.
    const n = it.observations;
    if (
      !confirm(
        `Stop tracking “${it.keyword}” for ${it.domain}?\n\n` +
          `This deletes ${n} recorded position${n === 1 ? "" : "s"} and stops the daily re-check. ` +
          `It can't be undone.`,
      )
    )
      return;
    untrack.mutate({
      keyword: it.keyword,
      domain: it.domain,
      location_code: it.location_code,
      language_code: it.language_code,
      device: it.device,
    });
  };

  return (
    <div className="divide-y divide-border">
      {items.map((it, i) => (
        // A row is not a <button>: it holds its own Remove button, and nesting
        // interactive elements is invalid HTML (and breaks keyboard nav).
        <div key={i} className="group flex items-center gap-2 py-2.5 hover:bg-surface-2">
          <button
            onClick={() => onPick(it)}
            className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
            title="Re-check this keyword"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text">{it.keyword}</p>
              <p className="truncate text-xs text-text-muted">
                {it.domain} · {locationLabel(it.location_code)}
                {it.device === "mobile" ? " · mobile" : ""}
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="font-mono text-text">
                {it.latest_position != null ? `#${it.latest_position}` : "—"}
              </span>
              <span className="w-12 text-right">
                <Delta delta={it.delta} />
              </span>
            </div>
          </button>
          <button
            onClick={() => remove(it)}
            disabled={untrack.isPending}
            aria-label={`Stop tracking ${it.keyword} for ${it.domain}`}
            title="Stop tracking"
            className="shrink-0 rounded-md p-1 text-text-muted opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function RankTracking({ embedded }: { embedded?: boolean }) {
  const [keyword, setKeyword] = useState("");
  const [domain, setDomain] = useState("");
  const [loc, setLoc] = useState({ location_code: 2840, language_code: "en" });
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [live, setLive] = useState(false);
  const mutation = useTrackRank();
  const tracked = useTracked();
  const data = mutation.data;

  const run = (kw = keyword, dom = domain, l = loc, dev = device) => {
    const k = kw.trim();
    const d = dom.trim();
    if (k && d) mutation.mutate({ keyword: k, domain: d, ...l, device: dev, force_live: live });
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run();
  };

  const buildExcel = () => {
    if (!data) return null;
    return {
      summary: {
        Report: "Rank Tracking",
        Keyword: data.keyword,
        Domain: data.domain,
        Market: locationLabel(loc.location_code),
        "Current position": data.found ? data.position : "Not found",
        Generated: new Date().toLocaleString(),
      },
      sheets: [
        {
          name: "Position history",
          columns: [
            { header: "Checked at", key: "checked_at", width: 22 },
            { header: "Position", key: "position", width: 10 },
            { header: "Ranking URL", key: "url", width: 60 },
          ],
          rows: data.history.map((p) => ({
            checked_at: new Date(p.created_at).toLocaleString(),
            position: p.position,
            url: p.url,
          })) as unknown as Record<string, unknown>[],
        },
        {
          name: "Tracked keywords",
          columns: [
            { header: "Keyword", key: "keyword", width: 36 },
            { header: "Domain", key: "domain", width: 26 },
            { header: "Market", key: "market", width: 22 },
            { header: "Device", key: "device", width: 10 },
            { header: "Latest position", key: "latest_position", width: 14 },
            { header: "Previous position", key: "previous_position", width: 16 },
            { header: "Delta", key: "delta", width: 8 },
            { header: "Last checked", key: "last_checked", width: 22 },
            { header: "Checks", key: "observations", width: 8 },
          ],
          rows: (tracked.data?.items ?? []).map((it) => ({
            ...it,
            market: locationLabel(it.location_code),
          })) as unknown as Record<string, unknown>[],
        },
      ],
    };
  };

  return (
    <div>
      {!embedded && (
        <PageHeader
          title="Rank Tracking"
          subtitle="Track a domain's Google position for a keyword. Tracked keywords are re-checked automatically every day, and big moves (±3 spots or in/out of the top 100) are emailed to you."
        />
      )}

      <Card className="mb-5">
        <CardBody>
          <form onSubmit={submit} className="flex flex-col gap-3 lg:flex-row">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Keyword — e.g. running shoes"
              className="lg:flex-1"
            />
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="Domain — e.g. nike.com"
              className="lg:w-64"
            />
            <LocationLanguagePicker value={loc} onChange={setLoc} />
            <Select
              value={device}
              onChange={(e) => setDevice(e.target.value as "desktop" | "mobile")}
              aria-label="Device"
              title="Google serves different results to phones and desktops"
            >
              <option value="desktop">Desktop</option>
              <option value="mobile">Mobile</option>
            </Select>
            <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-text-muted" title="Bypass the cache and fetch a fresh (billed) SERP snapshot">
              <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} className="h-4 w-4 accent-[var(--section)]" />
              Live
            </label>
            <Button type="submit" disabled={mutation.isPending || !keyword.trim() || !domain.trim()}>
              <Search size={16} /> {mutation.isPending ? "Checking…" : "Check rank"}
            </Button>
          </form>
        </CardBody>
      </Card>

      {mutation.isError && (
        <ErrorState message={apiErrorMessage(mutation.error)} onRetry={() => run()} />
      )}
      {mutation.isPending && <Skeleton className="h-64" />}


      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {data && !mutation.isPending && (
            <div className="animate-fade-rise space-y-5">
              <div className="flex items-center justify-end gap-2">
                <CacheBadge meta={data.meta} />
                <ExcelButton filename={`rank-${data.keyword}`} build={buildExcel} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardBody>
                    <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                      Current position
                    </p>
                    <p
                      className={`mt-1 font-mono text-3xl ${
                        data.found ? "text-[color:var(--section-ink)]" : "text-text-muted"
                      }`}
                    >
                      {data.found ? `#${data.position}` : "Not found"}
                    </p>
                  </CardBody>
                </Card>
                <Card className="sm:col-span-2">
                  <CardBody className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                      Ranking URL
                    </p>
                    {data.url ? (
                      <a
                        href={data.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-sm text-[color:var(--section-ink)] hover:underline"
                      >
                        {data.url}
                      </a>
                    ) : (
                      <p className="text-sm text-text-muted">
                        {data.domain} not in the top {data.depth} results for “{data.keyword}”.
                      </p>
                    )}
                  </CardBody>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Position history</CardTitle>
                </CardHeader>
                <CardBody>
                  <HistoryChart data={data} />
                </CardBody>
              </Card>
            </div>
          )}
          {!data && !mutation.isPending && !mutation.isError && (
            <EmptyState
              title="Check a ranking"
              hint="Enter a keyword and your domain to see where it ranks on Google."
            />
          )}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Tracked keywords</CardTitle>
          </CardHeader>
          <CardBody>
            {tracked.isLoading ? (
              <Skeleton className="h-32" />
            ) : (
              <TrackedList
                items={tracked.data?.items ?? []}
                onPick={(it) => {
                  const itemLoc = { location_code: it.location_code, language_code: it.language_code };
                  const itemDev = (it.device === "mobile" ? "mobile" : "desktop") as "desktop" | "mobile";
                  setKeyword(it.keyword);
                  setDomain(it.domain);
                  setLoc(itemLoc); // re-check in the item's own market, not the form's
                  setDevice(itemDev);
                  run(it.keyword, it.domain, itemLoc, itemDev);
                }}
              />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
