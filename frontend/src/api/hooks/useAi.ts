import { useMutation } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { AiInsightsResponse } from "@/types";

export function useAiInsights() {
  return useMutation({
    mutationFn: async (context: Record<string, unknown>) =>
      (await api.post<AiInsightsResponse>("/ai/insights", { context })).data,
  });
}
