import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { UsageSummary } from "@/types";

export function useUsage() {
  return useQuery({
    queryKey: ["usage", "summary"],
    queryFn: async () => {
      const { data } = await api.get<UsageSummary>("/usage/summary");
      return data;
    },
    staleTime: 30_000,
  });
}
