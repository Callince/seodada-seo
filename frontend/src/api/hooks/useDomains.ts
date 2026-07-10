import { useMeteredMutation } from "@/api/hooks/metered";
import type {
  CompetitorsResponse,
  DomainHistoryResponse,
  TechnologiesResponse,
  WhoisResponse,
  IntersectionResponse,
  OverviewResponse,
  RankedKeywordsResponse,
} from "@/types";

interface Loc {
  location_code: number;
  language_code: string;
  force_live?: boolean; // bypass cache and fetch fresh
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

/** Monthly ranked-keyword & traffic history. */
export const useDomainHistory = () =>
  useMeteredMutation<{ target: string } & Loc, DomainHistoryResponse>("/domains/history");

/** WHOIS — registrar, age, expiry. */
export const useWhois = () =>
  useMeteredMutation<{ target: string; force_live?: boolean }, WhoisResponse>("/domains/whois");

/** Detected technology stack + site profile. */
export const useTechnologies = () =>
  useMeteredMutation<{ target: string; force_live?: boolean }, TechnologiesResponse>("/domains/technologies");
