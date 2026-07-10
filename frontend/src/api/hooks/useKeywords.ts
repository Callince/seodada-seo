import { useMeteredMutation } from "@/api/hooks/metered";
import type {
  KeywordListResponse,
  KeywordOverviewResponse,
  TrendsResponse,
  VolumeResponse,
} from "@/types";

interface Loc {
  location_code: number;
  language_code: string;
  force_live?: boolean; // bypass cache and fetch fresh
}

export const useVolume = () =>
  useMeteredMutation<{ keywords: string[] } & Loc, VolumeResponse>("/keywords/volume");

export const useTrends = () =>
  useMeteredMutation<
    { keywords: string[]; time_range?: string; date_from?: string; date_to?: string } & Loc,
    TrendsResponse
  >("/keywords/trends");

export const useSuggestions = () =>
  useMeteredMutation<{ seed: string; limit?: number } & Loc, KeywordListResponse>(
    "/keywords/suggestions",
  );

export const useRelated = () =>
  useMeteredMutation<{ seed: string; limit?: number } & Loc, KeywordListResponse>(
    "/keywords/related",
  );

export const useIdeas = () =>
  useMeteredMutation<{ keywords: string[]; limit?: number } & Loc, KeywordListResponse>(
    "/keywords/ideas",
  );

/** Intent, difficulty, CPC and 12-month volume for a single keyword. */
export const useKeywordOverview = () =>
  useMeteredMutation<{ keyword: string } & Loc, KeywordOverviewResponse>("/keywords/overview");
