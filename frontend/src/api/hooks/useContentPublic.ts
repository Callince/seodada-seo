import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";

/** Normalize any migrated asset path to the copied public assets. */
export function assetUrl(path: string | undefined): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  if (path.startsWith("/content-assets/")) return path;
  const base = path.split("/").pop();
  return base ? "/content-assets/" + base : path;
}

export interface BlogSummary {
  title: string;
  slug: string;
  excerpt: string;
  cover_image_url: string;
  author: string;
  meta_description: string;
  published_at: string | null;
}
export interface BlogDetail extends BlogSummary {
  meta_title: string;
  body_html: string;
  faqs: { question: string; answer: string }[];
}
export interface Category {
  name: string;
  slug: string;
}
export interface WebStorySummary {
  title: string;
  slug: string;
  cover_image_url: string;
  published_at: string | null;
}
export interface WebStorySlide {
  image: string;
  image_alt?: string;
  heading?: string;
  text?: string;
  learn_more_url?: string;
}
export interface WebStoryDetail extends WebStorySummary {
  meta_description: string;
  slides: WebStorySlide[];
}

export function usePublicBlogs() {
  return useQuery({
    queryKey: ["pub-blogs"],
    queryFn: async () => (await api.get<BlogSummary[]>("/public/blog")).data,
  });
}
export function usePublicBlog(slug: string) {
  return useQuery({
    queryKey: ["pub-blog", slug],
    queryFn: async () => (await api.get<BlogDetail>(`/public/blog/${slug}`)).data,
  });
}
export function usePublicWebstories() {
  return useQuery({
    queryKey: ["pub-stories"],
    queryFn: async () => (await api.get<WebStorySummary[]>("/public/webstories")).data,
  });
}
export function usePublicWebstory(slug: string) {
  return useQuery({
    queryKey: ["pub-story", slug],
    queryFn: async () => (await api.get<WebStoryDetail>(`/public/webstories/${slug}`)).data,
  });
}
