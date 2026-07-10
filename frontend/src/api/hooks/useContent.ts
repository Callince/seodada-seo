import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { ContentResponse, PhraseTrendsResponse, SentimentResponse } from "@/types";

export function useContentAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { keyword: string; citation_limit?: number; force_live?: boolean }) => {
      const { data } = await api.post<ContentResponse>("/content/analyze", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usage", "summary"] }),
  });
}

/** Citation sentiment for a keyword/brand. */
export function useSentiment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { keyword: string; force_live?: boolean }) => {
      const { data } = await api.post<SentimentResponse>("/content/sentiment", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usage", "summary"] }),
  });
}

/** Citation volume over the last 12 months. */
export function usePhraseTrends() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { keyword: string; force_live?: boolean }) => {
      const { data } = await api.post<PhraseTrendsResponse>("/content/phrase-trends", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usage", "summary"] }),
  });
}
