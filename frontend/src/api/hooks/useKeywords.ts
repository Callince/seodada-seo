import { useMeteredMutation } from "@/api/hooks/metered";
import type {
  KeywordListResponse,
  TrendsResponse,
  VolumeResponse,
} from "@/types";

interface Loc {
  location_code: number;
  language_code: string;
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
