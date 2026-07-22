import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { Meta, SearchEngine, SerpResponse } from "@/types";

export interface SerpRankingInput {
  keyword: string;
  location_code: number;
  language_code: string;
  depth?: number;
  device?: "desktop" | "mobile";
  /** One billed call per engine — Google and Bing 0.200c each at depth 10,
   *  Yahoo 0.350c. Omit for Google alone. */
  engines?: SearchEngine[];
  force_live?: boolean;
  /** Billed per brand on the page — off by default, see SerpRankingRequest. */
  with_brand_volume?: boolean;
}

export function useSerpRanking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SerpRankingInput) => {
      const { data } = await api.post<SerpResponse>("/serp/ranking", input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usage", "summary"] });
    },
  });
}

export interface BulkRankInput {
  keywords: string[];
  domain: string;
  location_code: number;
  language_code: string;
  depth?: number;
  device?: "desktop" | "mobile";
  engines?: SearchEngine[];
  force_live?: boolean;
}

export interface BulkRankRow {
  keyword: string;
  /** engine -> position. A missing engine means "not ranking in the crawled
   *  depth" — deliberately absent rather than 0. */
  ranks: Partial<Record<SearchEngine, number>>;
  /** engine -> the URL that actually ranks: the page Google has indexed. */
  urls: Partial<Record<SearchEngine, string>>;
  best: number | null;
  error: string | null;
}

export interface BulkRankResponse {
  domain: string;
  rows: BulkRankRow[];
  engines: SearchEngine[];
  ranked: number;
  checked: number;
  meta: Meta;
}

/**
 * "Where does my page rank for each of these keywords?"
 *
 * One billed SERP call per keyword per engine — at depth 100 that is ~1.55c
 * each, so the UI shows a running estimate before the run.
 */
export function useBulkRank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BulkRankInput) => {
      const { data } = await api.post<BulkRankResponse>("/serp/bulk-rank", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usage", "summary"] }),
  });
}
