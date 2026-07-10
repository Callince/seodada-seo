import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { ListingsResponse } from "@/types";

export interface ListingsInput {
  what: string;
  lat: number;
  lng: number;
  radius_km?: number;
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
