import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { ListingsResponse } from "@/types";

export interface ListingsInput {
  what: string;
  /** DataForSEO geo-target, from the shared location picker. Replaced a
   *  lat/lng + radius circle so Local SEO reaches the same 57k cities as every
   *  other page instead of five hardcoded metros. */
  location_code: number;
  limit?: number;
  force_live?: boolean;
}

/** Google business listings around a location (Local SEO / map pack). */
export function useListings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ListingsInput) => {
      const { data } = await api.post<ListingsResponse>("/local/listings", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usage", "summary"] }),
  });
}
