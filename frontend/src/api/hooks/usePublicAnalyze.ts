import { useMutation } from "@tanstack/react-query";

import { api } from "@/api/client";

/** A headline check from the public landing-page analyzer. */
export interface PublicCheck {
  label: string;
  ok: boolean;
  detail?: string;
}

export interface PublicAnalysis {
  url: string;
  status_code: number | null;
  score: number;
  passed: number;
  total: number;
  checks: PublicCheck[];
  summary: {
    title_length: number | null;
    headings: number | null;
    images: number | null;
    internal_links: number | null;
    external_links: number | null;
  };
  cached: boolean;
}

/** Anonymous instant analysis for the landing page — no login, no cost.
 *  Rate limited per IP server-side (429 surfaces as a friendly message). */
export function usePublicAnalyze() {
  return useMutation({
    mutationFn: async (url: string) =>
      (await api.post<PublicAnalysis>("/public/analyze", { url })).data,
  });
}
