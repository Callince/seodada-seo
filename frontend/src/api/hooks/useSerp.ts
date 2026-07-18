import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { SerpResponse } from "@/types";

export interface SerpRankingInput {
  keyword: string;
  location_code: number;
  language_code: string;
  depth?: number;
  device?: "desktop" | "mobile";
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
