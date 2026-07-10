import { useMutation } from "@tanstack/react-query";

import { api } from "@/api/client";

export interface Check {
  label: string;
  status: "ok" | "warning" | "danger";
  detail: string;
}

export interface PageAnalysis {
  url: {
    input_url: string;
    final_url: string;
    status_code: number;
    redirected: boolean;
    https: boolean;
    path_depth: number;
    slug: string;
    length: number;
    has_query: boolean;
    robots_meta: string;
    canonical: string;
    internal_links: number;
    external_links: number;
    checks: Check[];
  };
  links: {
    internal_count: number;
    external_count: number;
    nofollow_count: number;
    total: number;
    samples: { url: string; anchor: string; rel: string; internal: boolean; nofollow: boolean }[];
  };
  headings: {
    counts: Record<string, number>;
    items: { level: number; text: string }[];
    issues: string[];
    h1_text: string;
  };
  images: {
    total: number;
    missing_alt: number;
    with_alt: number;
    lazy_count: number;
    dimensioned_count: number;
    items: {
      src: string; alt: string; title: string; width: number | null; height: number | null;
      loading: string; has_alt: boolean; has_dimensions: boolean; lazy: boolean;
    }[];
  };
  keywords: {
    word_count: number;
    unique_words: number;
    reading_time_min: number;
    top_keywords: { phrase: string; count: number; density: number }[];
    top_phrases: { phrase: string; count: number; density: number }[];
  };
  meta: {
    title: string;
    title_length: number;
    title_check: string;
    description: string;
    description_length: number;
    description_check: string;
    canonical: string;
    robots: string;
    viewport: string;
    charset: string;
    language: string;
    open_graph: Record<string, string>;
    twitter: Record<string, string>;
    schema_types: string[];
    schema_blocks: unknown[];
  };
  fetch?: { from_cache: boolean; status: number };
}

export interface SitemapAnalysis {
  sitemaps_found: string[];
  is_index: boolean;
  child_sitemaps: string[];
  total_urls: number;
  sample_urls: string[];
}

export interface AnalyzeInput {
  url: string;
  refresh?: boolean;
}

export function useAnalyzePage() {
  return useMutation({
    mutationFn: async ({ url, refresh }: AnalyzeInput) =>
      (await api.post<PageAnalysis>("/analyze/page", { url, refresh })).data,
  });
}

export function useAnalyzeSitemap() {
  return useMutation({
    mutationFn: async ({ url, refresh }: AnalyzeInput) =>
      (await api.post<SitemapAnalysis>("/analyze/sitemap", { url, refresh })).data,
  });
}
