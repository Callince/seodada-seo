import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { AuditStartResponse, AuditStatusResponse } from "@/types";

export function useStartAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { domain: string; max_crawl_pages: number }) => {
      const { data } = await api.post<AuditStartResponse>("/audit/start", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usage", "summary"] }),
  });
}

/** Polls crawl status every 5s until the crawl reports finished. */
export function useAuditStatus(taskId: string | null) {
  return useQuery({
    queryKey: ["audit", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data } = await api.get<AuditStatusResponse>(`/audit/status/${taskId}`);
      return data;
    },
    refetchInterval: (query) => {
      const p = query.state.data?.progress;
      return p === "finished" || p === "error" || p === "unknown" ? false : 3000;
    },
  });
}
