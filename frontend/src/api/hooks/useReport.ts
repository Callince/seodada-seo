import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { SiteReportResponse } from "@/types";

export interface SiteReportInput {
  domain: string;
  keyword?: string;
  location_code: number;
  language_code: string;
  max_pages?: number;
  force_live?: boolean;
}

export function useSiteReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SiteReportInput) => {
      const { data } = await api.post<SiteReportResponse>("/report/site", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usage", "summary"] }),
  });
}
