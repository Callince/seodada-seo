import { useMeteredMutation } from "@/api/hooks/metered";
import type {
  CompetitorsResponse,
  IntersectionResponse,
  OverviewResponse,
  RankedKeywordsResponse,
} from "@/types";

interface Loc {
  location_code: number;
  language_code: string;
}

export const useRankedKeywords = () =>
  useMeteredMutation<{ target: string; limit?: number } & Loc, RankedKeywordsResponse>(
    "/domains/ranked-keywords",
  );

export const useCompetitors = () =>
  useMeteredMutation<{ target: string; limit?: number } & Loc, CompetitorsResponse>(
    "/domains/competitors",
  );

export const useDomainOverview = () =>
  useMeteredMutation<{ target: string } & Loc, OverviewResponse>("/domains/overview");

export const useIntersection = () =>
  useMeteredMutation<{ target1: string; target2: string; limit?: number } & Loc, IntersectionResponse>(
    "/domains/intersection",
  );
