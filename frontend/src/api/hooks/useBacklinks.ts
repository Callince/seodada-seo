import { useMeteredMutation } from "@/api/hooks/metered";
import type { BacklinksSummaryResponse } from "@/types";

export interface BacklinksInput {
  target: string;
  limit?: number;
  force_live?: boolean;
}

/** Domain authority summary. Used by Competitors and Domain Analytics for the
 *  authority ring/strip; falls back to OpenPageRank when the DataForSEO
 *  Backlinks subscription is inactive. */
export const useBacklinksSummary = () =>
  useMeteredMutation<BacklinksInput, BacklinksSummaryResponse>("/backlinks/summary");
