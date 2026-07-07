import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { ContentResponse } from "@/types";

export function useContentAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { keyword: string; citation_limit?: number }) => {
      const { data } = await api.post<ContentResponse>("/content/analyze", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usage", "summary"] }),
  });
}
