import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { AiVisibilityStartResponse, AiVisibilityStatusResponse, AiVolumeResponse, AskResponse, MentionsResponse } from "@/types";

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

/** LLM mentions of a domain (AI Optimization API). */
export function useLlmMentions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { domain: string; force_live?: boolean }) => {
      const { data } = await api.post<MentionsResponse>("/ai-visibility/mentions", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usage", "summary"] }),
  });
}

/** AI (LLM prompt) search volume for keywords. */
export function useAiVolume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { keywords: string[]; location_name?: string; force_live?: boolean }) => {
      const { data } = await api.post<AiVolumeResponse>("/ai-visibility/ai-volume", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usage", "summary"] }),
  });
}

/** Ask a live LLM and see the raw answer. */
export function useAskLlm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { prompt: string; model_name?: string; force_live?: boolean }) => {
      const { data } = await api.post<AskResponse>("/ai-visibility/ask", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usage", "summary"] }),
  });
}
