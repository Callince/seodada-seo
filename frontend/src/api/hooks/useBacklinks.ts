import { useMeteredMutation } from "@/api/hooks/metered";
import type {
  AnchorsResponse,
  BacklinkHistoryResponse,
  BacklinksListResponse,
  BacklinksSummaryResponse,
  BLCompetitorsResponse,
  LinkGapResponse,
  NewLostResponse,
  ReferringDomainsResponse,
  SpamScoreResponse,
} from "@/types";

export interface BacklinksInput {
  target: string;
  limit?: number;
  force_live?: boolean;
}

/** Domain authority summary — authority score, backlink/referring-domain totals,
 *  dofollow split, broken links. Falls back to OpenPageRank (free) when the
 *  DataForSEO Backlinks subscription is inactive. */
export const useBacklinksSummary = () =>
  useMeteredMutation<BacklinksInput, BacklinksSummaryResponse>("/backlinks/summary");

/** Strongest backlinks, one per referring domain. */
export const useBacklinksList = () =>
  useMeteredMutation<BacklinksInput, BacklinksListResponse>("/backlinks/list");

/** Referring domains, ranked by their own authority. */
export const useReferringDomains = () =>
  useMeteredMutation<BacklinksInput, ReferringDomainsResponse>("/backlinks/referring-domains");

/** Anchor-text distribution ("keyword backlinks"). */
export const useBacklinkAnchors = () =>
  useMeteredMutation<BacklinksInput, AnchorsResponse>("/backlinks/anchors");

/** Authority & link totals over the last 12 months. */
export const useBacklinksHistory = () =>
  useMeteredMutation<BacklinksInput, BacklinkHistoryResponse>("/backlinks/history");

/** New vs lost links/domains per month. */
export const useBacklinksNewLost = () =>
  useMeteredMutation<BacklinksInput, NewLostResponse>("/backlinks/new-lost");

/** Domains with the most similar link profile. */
export const useBacklinkCompetitors = () =>
  useMeteredMutation<BacklinksInput, BLCompetitorsResponse>("/backlinks/competitors");

/** 0-100 spam score of the target's link profile. */
export const useSpamScore = () =>
  useMeteredMutation<BacklinksInput, SpamScoreResponse>("/backlinks/spam-score");

export interface LinkGapInput {
  target: string;
  competitors: string[];
  limit?: number;
  force_live?: boolean;
}

/** Referring domains that link to the competitors but not to you. */
export const useLinkGap = () =>
  useMeteredMutation<LinkGapInput, LinkGapResponse>("/backlinks/link-gap");
