import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { OnPageResponse } from "@/types";

export function useOnPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { url: string; target_keyword?: string }) => {
      const { data } = await api.post<OnPageResponse>("/onpage/analyze", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usage", "summary"] }),
  });
}
