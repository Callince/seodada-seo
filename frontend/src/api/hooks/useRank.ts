import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, apiErrorMessage } from "@/api/client";
import { toast } from "@/store/toast";
import type { RankTrackResponse, TrackedListResponse } from "@/types";

export interface RankTrackInput {
  force_live?: boolean;
  keyword: string;
  domain: string;
  location_code: number;
  language_code: string;
  depth?: number;
  device?: "desktop" | "mobile";
}

export function useTrackRank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RankTrackInput) => {
      const { data } = await api.post<RankTrackResponse>("/rank/track", input);
      return data;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["rank", "tracked"] });
      qc.invalidateQueries({ queryKey: ["usage", "summary"] });
      toast.success(d.found ? `${d.domain} ranks #${d.position} for “${d.keyword}”.` : `${d.domain} not in top results for “${d.keyword}”.`);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
}

export function useTracked() {
  return useQuery({
    queryKey: ["rank", "tracked"],
    queryFn: async () => {
      const { data } = await api.get<TrackedListResponse>("/rank/tracked");
      return data;
    },
    staleTime: 30_000,
  });
}
