import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { LighthouseResponse, OnPageResponse } from "@/types";

export function useOnPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { url: string; target_keyword?: string; force_live?: boolean }) => {
      const { data } = await api.post<OnPageResponse>("/onpage/analyze", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usage", "summary"] }),
  });
}

/** Google Lighthouse categories + Core Web Vitals (mobile). */
export function useLighthouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { url: string; force_live?: boolean }) => {
      const { data } = await api.post<LighthouseResponse>("/onpage/lighthouse", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usage", "summary"] }),
  });
}
