import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { AiVisibilityStartResponse, AiVisibilityStatusResponse, AiVolumeResponse, MentionsResponse, Meta } from "@/types";

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
    // Keep polling while the tab is in the background. This is a server-side
    // job with a progress bar: without this, switching tabs mid-run freezes the
    // bar and the results only appear once you come back and the query
    // refocuses — it looks stuck even though the work finished.
    refetchIntervalInBackground: true,
  });
}

/** LLM mentions of a domain (AI Optimization API). */
export interface DomainKeywordRow {
  question: string;
  ai_search_volume: number;
  platform: string;
  platforms: string[];
  answer_snippet: string;
  source_count: number;
  location_code: number | null;
}
export interface DomainKeywordsResponse {
  domain: string;
  rows: DomainKeywordRow[];
  /** Upstream match count — usually far larger than rows.length. */
  total_count: number;
  returned: number;
  meta: Meta;
}

/** Questions asked of AI engines that surface a domain — the reverse of the
 *  keyword check. ~11c a call, so it is never fired automatically. */
export function useDomainKeywords() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { domain: string; limit?: number; force_live?: boolean }) => {
      const { data } = await api.post<DomainKeywordsResponse>("/ai-visibility/domain-keywords", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usage", "summary"] }),
  });
}

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

// `useAskLlm` lived here until the "Ask an LLM" panel was removed from the AI
// Visibility page. The backend route (`POST /ai-visibility/ask`) is untouched
// and still callable — only the unused client binding is gone.
