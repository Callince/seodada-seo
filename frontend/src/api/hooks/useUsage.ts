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

export interface DashboardStats {
  today_used: number;
  daily_limit: number;
  remaining: number;
  total_analyses: number;
  favorite_tool: string | null;
  favorite_tool_count: number;
  usage_series: number[];
  plan_name: string;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["usage", "dashboard"],
    queryFn: async () => (await api.get<DashboardStats>("/usage/dashboard")).data,
    staleTime: 20_000,
  });
}
