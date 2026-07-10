import {
  Bot,
  CalendarClock,
  FileBarChart,
  FileSearch,
  Film,
  Folder,
  Globe,
  Heading,
  Image as ImageIcon,
  LayoutGrid,
  Link,
  LineChart,
  ListTree,
  MessageSquareText,
  Network,
  Radar,
  Search,
  Sparkles,
  Swords,
  Tags,
  type LucideIcon,
} from "lucide-react";

export interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
  to: string;
}

export interface FeatureGroup {
  key: string;
  title: string;
  tagline: string;
  features: Feature[];
}

/** The unified capability catalog — the merge of the "data for seo" search
 *  intelligence suite and the seodada on-page + AI content tools. Every `to`
 *  points at a real route in this app. One source of truth for the Landing
 *  grid, the Features page, the nav Tools menu, and the footer. */
export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    key: "tools",
    title: "Free Instant Tools",
    tagline: "Paste any URL and get a full on-page breakdown in seconds — no setup, no cost.",
    features: [
      { icon: Link, title: "URL Analysis", desc: "Status, redirects, canonical, robots, internal/external links and an SEO-checks scorecard.", to: "/tools/url" },
      { icon: Tags, title: "Meta Analysis", desc: "Title, description, canonical, Open Graph, Twitter cards and JSON-LD schema — with previews.", to: "/tools/meta" },
      { icon: Heading, title: "Heading Analysis", desc: "H1–H6 hierarchy, counts and structure issues, with a filterable document outline.", to: "/tools/heading" },
      { icon: Search, title: "Keyword Density", desc: "Word count, reading time and top keywords + phrases with visual density bars.", to: "/tools/keyword" },
      { icon: ImageIcon, title: "Image Analysis", desc: "Every image with alt text, dimensions and lazy-loading — click a stat to filter what's missing.", to: "/tools/image" },
      { icon: Network, title: "Sitemap Explorer", desc: "Discover the XML sitemap(s) and explore the whole site as an interactive structure graph.", to: "/tools/sitemap" },
    ],
  },
  {
    key: "intelligence",
    title: "Search Intelligence",
    tagline: "Know exactly where you stand — and where to win — with live SERP, keyword, and link data.",
    features: [
      { icon: Search, title: "SERP Ranking", desc: "See the top-100 ranking pages, brands, and People Also Ask for any keyword and location.", to: "/serp" },
      { icon: ListTree, title: "Keyword Research", desc: "Search volume, difficulty, intent, and thousands of keyword ideas from real search data.", to: "/keywords" },
      { icon: Globe, title: "Domain Analytics", desc: "Authority, estimated traffic, and the full ranked-keyword footprint of any domain.", to: "/domains" },
      { icon: Swords, title: "Competitor Analysis", desc: "Find keyword gaps and shared terms — see exactly where rivals out-rank you.", to: "/competitors" },
      { icon: Link, title: "Backlink Intelligence", desc: "Referring domains, anchor profiles, and authority scores, with free fallbacks built in.", to: "/backlinks" },
      { icon: LineChart, title: "Rank Tracking", desc: "Daily Google positions across locations and devices, with movement alerts.", to: "/rank" },
    ],
  },
  {
    key: "site-health",
    title: "Site Health & On-Page",
    tagline: "Crawl, audit, and fix — a next-gen scraper plus deep on-page and content analysis.",
    features: [
      { icon: Radar, title: "Site Audit", desc: "A JS-rendering, Cloudflare-resistant crawl that surfaces every technical issue by priority.", to: "/audit" },
      { icon: FileSearch, title: "On-Page Analysis", desc: "URL structure, headings, meta tags, images, schema, internal links and robots — in one scan.", to: "/onpage" },
      { icon: MessageSquareText, title: "Content Analysis", desc: "Keyword density, readability, and semantic relevance versus the pages you compete with.", to: "/content" },
      { icon: FileBarChart, title: "Site Report", desc: "One consolidated audit — page health, ranking signals, and fixes — with an AI advisor.", to: "/report" },
      { icon: CalendarClock, title: "Scheduled Monitoring", desc: "Automate audits and rank checks on a schedule and get the deltas that matter.", to: "/schedules" },
    ],
  },
  {
    key: "ai-workspace",
    title: "AI, Content & Workspace",
    tagline: "Turn insight into published content, track your AI visibility, and run it all from one place.",
    features: [
      { icon: Sparkles, title: "AI Visibility", desc: "Track how often your brand is cited in ChatGPT and other AI answer engines.", to: "/ai-visibility" },
      { icon: Bot, title: "AI SEO Advisor", desc: "Plain-English, prioritised fixes generated from your own audit and ranking data.", to: "/report" },
      { icon: Film, title: "Web Stories", desc: "Turn topics and posts into tap-through, mobile-first AMP web stories.", to: "/webstories" },
      { icon: LayoutGrid, title: "All-in-One Workspace", desc: "Run SERP, keywords, content, and site report on a single domain from one page.", to: "/workspace" },
      { icon: Folder, title: "Projects", desc: "Save, organise, and revisit every analysis run per client or site.", to: "/projects" },
    ],
  },
];

/** Flat list for the nav Tools mega-menu (first two features of each group). */
export const NAV_TOOLS: Feature[] = FEATURE_GROUPS.flatMap((g) => g.features.slice(0, 2));
