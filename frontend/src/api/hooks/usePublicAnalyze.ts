import { useMutation } from "@tanstack/react-query";

import { api } from "@/api/client";

/** A headline check from the public landing-page analyzer. */
export interface PublicCheck {
  label: string;
  ok: boolean;
  detail?: string;
}

export interface HeadingItem { level: number; text: string }
export interface ImageItem { src: string; alt: string; title?: string; width?: number | null; height?: number | null }
export interface KeywordItem { phrase: string; count: number; density: number }
export interface LinkSample { url?: string; text?: string; internal?: boolean; nofollow?: boolean }

/** Per-tool detail powering the public /free-tools page. Every list is capped
 *  server-side (50 items) — this is an unauthenticated endpoint. */
export interface PublicDetail {
  url: {
    final_url: string | null; status_code: number | null; redirected: boolean | null;
    https: boolean | null; path_depth: number | null; slug: string | null;
    canonical: string | null; robots_meta: string | null;
    checks: { label: string; ok: boolean; detail?: string }[];
  };
  meta: {
    title: string | null; title_length: number | null; title_check: string | null;
    description: string | null; description_length: number | null; description_check: string | null;
    canonical: string | null; robots: string | null; viewport: string | null; language: string | null;
    open_graph: Record<string, string>; twitter: Record<string, string>; schema_types: string[];
  };
  headings: {
    counts: Record<string, number>; h1_text: string | null; issues: string[];
    items: HeadingItem[]; truncated: boolean;
  };
  keywords: {
    word_count: number | null; unique_words: number | null; reading_time_min: number | null;
    top_keywords: KeywordItem[]; top_phrases: KeywordItem[];
  };
  images: {
    total: number | null; missing_alt: number | null; with_alt: number | null;
    lazy_count: number | null; items: ImageItem[]; truncated: boolean;
  };
  links: {
    internal_count: number | null; external_count: number | null;
    nofollow_count: number | null; total: number | null; samples: LinkSample[];
  };
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
  detail: PublicDetail;
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
