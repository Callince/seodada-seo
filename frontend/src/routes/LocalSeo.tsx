import { ExternalLink, Flag, MapPin, MessageSquare, RefreshCw, Search, Star, Store } from "lucide-react";
import { useState } from "react";

import { apiErrorMessage } from "@/api/client";
import { useListings } from "@/api/hooks/useLocal";
import { CacheBadge } from "@/components/shared/CacheBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { ExcelButton } from "@/components/shared/ExcelButton";
import { MetricCard } from "@/components/shared/MetricCard";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtInt } from "@/lib/format";
import { usePersistedState } from "@/lib/persist";
import type { ListingRow, ListingsResponse } from "@/types";

/** Quick presets for common Indian metros (lat, lng). */
const CITIES: { label: string; lat: number; lng: number }[] = [
  { label: "Chennai", lat: 13.0827, lng: 80.2707 },
  { label: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  { label: "Mumbai", lat: 19.076, lng: 72.8777 },
  { label: "Delhi", lat: 28.6139, lng: 77.209 },
  { label: "Hyderabad", lat: 17.385, lng: 78.4867 },
];

const cols: Column<ListingRow>[] = [
  {
    key: "title",
    header: "Business",
    sortValue: (r) => r.title,
    render: (r) => (
      <div>
        <p className="font-medium text-text">{r.title}</p>
        <p className="text-xs text-text-muted">{r.category ?? ""}</p>
      </div>
    ),
    csvValue: (r) => r.title,
  },
  {
    key: "rating",
    header: "Rating",
    align: "right",
    sortValue: (r) => r.rating,
    render: (r) =>
      r.rating == null ? (
        "—"
      ) : (
        <span className="inline-flex items-center gap-1 font-semibold text-text">
          <Star size={13} className="fill-warning text-warning" /> {r.rating.toFixed(1)}
        </span>
      ),
    csvValue: (r) => r.rating,
  },
  { key: "reviews", header: "Reviews", align: "right", mono: true, sortValue: (r) => r.reviews, render: (r) => (r.reviews == null ? "—" : String(r.reviews)), csvValue: (r) => r.reviews },
  {
    key: "is_claimed",
    header: "Claimed",
    sortValue: (r) => (r.is_claimed ? 1 : 0),
    render: (r) =>
      r.is_claimed == null ? "—" : (
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.is_claimed ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
          {r.is_claimed ? "claimed" : "unclaimed"}
        </span>
      ),
    csvValue: (r) => (r.is_claimed ? "yes" : "no"),
  },
  { key: "address", header: "Address", sortValue: (r) => r.address, render: (r) => <span className="text-text-muted">{r.address ?? "—"}</span>, csvValue: (r) => r.address },
  { key: "phone", header: "Phone", mono: true, sortValue: (r) => r.phone, render: (r) => r.phone ?? "—", csvValue: (r) => r.phone },
  {
    key: "domain",
    header: "Website",
    sortValue: (r) => r.domain,
    render: (r) =>
      r.url ? (
        <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[color:var(--section-ink)] hover:underline">
          {r.domain ?? "site"} <ExternalLink size={12} />
        </a>
      ) : (
        "—"
      ),
    csvValue: (r) => r.url,
  },
];

export default function LocalSeo() {
  const [what, setWhat] = usePersistedState("local.what", "");
  const [city, setCity] = usePersistedState("local.city", CITIES[0]);
  const [result, setResult] = usePersistedState<ListingsResponse | null>("local.result", null);
  const [error, setError] = useState<string | null>(null);

  const listings = useListings();

  const run = async (force = false) => {
    const q = what.trim();
    if (!q) return;
    setError(null);
    try {
      const data = await listings.mutateAsync({
        what: q,
        lat: city.lat,
        lng: city.lng,
        radius_km: 25,
        limit: 50,
        force_live: force,
      });
      setResult(data);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const buildExcel = () => {
    if (!result) return null;
    return {
      summary: {
        Report: "Local SEO listings",
        Search: result.what,
        City: city.label,
        Listings: result.rows.length,
        Generated: new Date().toLocaleString(),
      },
      sheets: [
        {
          name: "Listings",
          columns: [
            { header: "Business", key: "title", width: 34 },
            { header: "Category", key: "category", width: 24 },
            { header: "Rating", key: "rating", width: 10 },
            { header: "Reviews", key: "reviews", width: 10 },
            { header: "Claimed", key: "claimed", width: 10 },
            { header: "Address", key: "address", width: 60 },
            { header: "Phone", key: "phone", width: 18 },
            { header: "Website", key: "url", width: 50 },
          ],
          rows: result.rows.map((r) => ({
            ...r,
            claimed: r.is_claimed == null ? null : r.is_claimed ? "yes" : "no",
          })) as unknown as Record<string, unknown>[],
        },
      ],
    };
  };

  return (
    <div>
      <PageHeader
        title="Local SEO"
        subtitle="Who owns the map pack — Google business listings, ratings, and unclaimed profiles around any location."
      />

      <Card className="mb-5">
        <CardBody>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(true);
            }}
            className="flex flex-col gap-3 md:flex-row"
          >
            <div className="relative lg:flex-1">
              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input
                value={what}
                onChange={(e) => setWhat(e.target.value)}
                placeholder='Business type, e.g. "electric scooter showroom"'
                className="pl-9"
              />
            </div>
            <Select
              value={city.label}
              onChange={(e) => setCity(CITIES.find((c) => c.label === e.target.value) ?? CITIES[0])}
              aria-label="City"
            >
              {CITIES.map((c) => (
                <option key={c.label}>{c.label}</option>
              ))}
            </Select>
            <Button type="submit" disabled={listings.isPending || !what.trim()}>
              <Search size={16} /> Search listings
            </Button>
            {result && (
              <Button type="button" variant="secondary" disabled={listings.isPending} onClick={() => run(true)} title="Bypass the cache and fetch live">
                <RefreshCw size={15} className={listings.isPending ? "animate-spin" : ""} /> Refresh
              </Button>
            )}
          </form>
          <p className="mt-2.5 text-xs text-text-muted">
            Searches a 25&nbsp;km radius around the selected city centre. Unclaimed profiles are
            outreach opportunities.
          </p>
        </CardBody>
      </Card>

      {listings.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => run(true)} />
      ) : !result ? (
        <EmptyState
          title="Search local listings"
          hint="Enter a business type to see who ranks in the local pack — ratings, reviews, and unclaimed profiles."
        />
      ) : result ? (
        <div className="animate-fade-rise space-y-4">
          {(() => {
            const rows = result.rows;
            const rated = rows.filter((r) => r.rating != null);
            const avg = rated.length ? rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length : null;
            const unclaimed = rows.filter((r) => r.is_claimed === false).length;
            const reviews = rows.reduce((s, r) => s + (r.reviews ?? 0), 0);
            return (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <MetricCard icon={Store} label="Listings in the pack" value={fmtInt(rows.length)} />
                <MetricCard icon={Star} label="Average rating" value={avg == null ? "—" : avg.toFixed(1)} />
                <MetricCard icon={Flag} label="Unclaimed" value={fmtInt(unclaimed)} sub="outreach targets" />
                <MetricCard icon={MessageSquare} label="Total reviews" value={fmtInt(reviews)} />
              </div>
            );
          })()}
          <div className="flex items-center justify-end gap-2">
            <CacheBadge meta={result.meta} />
            <ExcelButton filename={`local-${result.what}`} build={buildExcel} />
          </div>
          <Card>
            <CardBody>
              <DataTable columns={cols} rows={result.rows} csvName={`local-${result.what}`} />
            </CardBody>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
