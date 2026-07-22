import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";

export interface LocationItem {
  code: number;
  name: string;
  region: string;
  country_name: string;
  country_iso: string;
  kind: "country" | "city";
  language_code: string;
}

interface LocationSearchResponse {
  rows: LocationItem[];
  truncated: boolean;
}

/** "Chennai, Tamil Nadu, India" / "India" — the region is what disambiguates
 *  the many same-named cities (there are five Londons in the dataset). */
export function locationText(l: LocationItem): string {
  if (l.kind === "country") return l.name;
  return [l.name, l.region, l.country_name].filter(Boolean).join(", ");
}

/** Type-ahead over countries + cities. Not billed — a local table read. */
export function useLocationSearch(q: string, opts?: { country?: string; kind?: "country" | "city"; enabled?: boolean }) {
  const country = opts?.country ?? "";
  const kind = opts?.kind ?? "";
  return useQuery({
    queryKey: ["locations", "search", q, country, kind],
    queryFn: async () => {
      const { data } = await api.get<LocationSearchResponse>("/locations/search", {
        params: { q, country, kind, limit: 20 },
      });
      return data;
    },
    enabled: opts?.enabled !== false,
    // Geo data is static between seeds, so cache hard and never refetch on
    // focus — this endpoint should not be hit twice for the same keystroke.
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    // Keeps the previous list visible while the next query resolves, so the
    // dropdown doesn't blank out on every keystroke.
    placeholderData: keepPreviousData,
  });
}

/**
 * Resolve saved codes back to labels.
 *
 * Persisted UI state and saved analyses store only the numeric code, so without
 * this a reopened page would render "#1007809" instead of "Chennai".
 */
export function useLocationLookup(codes: number[]) {
  const key = [...new Set(codes)].filter(Boolean).sort((a, b) => a - b);
  return useQuery({
    queryKey: ["locations", "lookup", key.join(",")],
    queryFn: async () => {
      const { data } = await api.get<LocationSearchResponse>("/locations/lookup", {
        params: { codes: key.join(",") },
      });
      return data.rows;
    },
    enabled: key.length > 0,
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
