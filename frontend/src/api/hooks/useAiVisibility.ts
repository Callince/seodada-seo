import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { AiVisibilityStartResponse, AiVisibilityStatusResponse } from "@/types";

export interface AiVisibilityInput {
  domain: string;
  keywords: string[];
  location_code: number;
  language_code: string;
  device?: "desktop" | "mobile";
  include_ai_mode?: boolean;
  force_live?: boolean;
}

export function useStartAiVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AiVisibilityInput) => {
      const { data } = await api.post<AiVisibilityStartResponse>("/ai-visibility/check", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usage", "summary"] }),
  });
}

/** Polls the check every 2.5s until it finishes (or errors). */
export function useAiVisibilityStatus(taskId: string | null) {
  return useQuery({
    queryKey: ["ai-visibility", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data } = await api.get<AiVisibilityStatusResponse>(`/ai-visibility/status/${taskId}`);
      return data;
    },
    refetchInterval: (query) => {
      const p = query.state.data?.progress;
      return p === "finished" || p === "error" || p === "unknown" ? false : 2500;
    },
  });
}
