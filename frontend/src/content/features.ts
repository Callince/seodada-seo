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
  MapPin,
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
  /** A brief plain-English explanation of what the tool actually does once you
   *  open it. `desc` is the one-line tagline used in grids and menus; `how` is
   *  the longer answer, and only the Features page renders it. Written from
   *  each tool's real page, not from the tagline. */
  how?: string;
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
      { icon: Link, title: "URL Analysis", desc: "Status, redirects, canonical, robots, internal/external links and an SEO-checks scorecard.", to: "/tools/url",
        how: "Fetches the page and reports what a crawler sees first: the HTTP status, any redirect chain it had to follow, the canonical it declares and whether robots rules allow indexing. Every internal and external link is listed and split by follow/nofollow, and the checks roll up into a pass/fail scorecard." },
      { icon: Tags, title: "Meta Analysis", desc: "Title, description, canonical, Open Graph, Twitter cards and JSON-LD schema — with previews.", to: "/tools/meta",
        how: "Pulls every tag that controls how the page is presented in search and on social, then renders the Google and social-card previews so you can see the truncation before Google does. Any JSON-LD structured data on the page is parsed and its types listed." },
      { icon: Heading, title: "Heading Analysis", desc: "H1–H6 hierarchy, counts and structure issues, with a filterable document outline.", to: "/tools/heading",
        how: "Builds the page's heading outline the way a screen reader and a search engine read it, then flags the structural faults that matter — a missing or duplicated H1, and any skipped level such as an H2 followed straight by an H4." },
      { icon: Search, title: "Keyword Density", desc: "Word count, reading time and top keywords + phrases with visual density bars.", to: "/tools/keyword",
        how: "Counts the real body text — word count and reading time — then ranks single words and multi-word phrases by frequency with a density bar for each, so you can see whether a target term is genuinely present or accidentally repeated into keyword stuffing." },
      { icon: ImageIcon, title: "Image Analysis", desc: "Every image with alt text, dimensions and lazy-loading — click a stat to filter what's missing.", to: "/tools/image",
        how: "Lists every image on the page with its alt text, dimensions and loading strategy. The summary stats double as filters: click \"missing alt\" or \"not lazy-loaded\" to narrow the table to exactly the images that need fixing." },
      { icon: Network, title: "Sitemap Explorer", desc: "Discover the XML sitemap(s) and explore the whole site as an interactive structure graph.", to: "/tools/sitemap",
        how: "Finds the site's XML sitemaps from robots.txt and the usual locations, follows sitemap indexes to the child files, and draws the URLs as an interactive graph so the site's real depth and section balance are visible at a glance." },
    ],
  },
  {
    key: "intelligence",
    title: "Search Intelligence",
    tagline: "Know exactly where you stand — and where to win — with live SERP, keyword, and link data.",
    features: [
      { icon: Search, title: "SERP Ranking", desc: "See the top-100 ranking pages, brands, and People Also Ask for any keyword and location.", to: "/serp",
        how: "Crawls a live results page for your keyword and location and shows it as the search engine returns it — organic results plus the People Also Ask questions. You can run Google, Bing or Yahoo, compare two markets side by side, and search the results for a domain to get its exact position." },
      { icon: ListTree, title: "Keyword Research", desc: "Search volume, difficulty, intent, and thousands of keyword ideas from real search data.", to: "/keywords",
        how: "Takes a seed keyword and returns monthly search volume, competition, cost-per-click and search intent, then expands it into related, long-tail and competitor-derived ideas. A bulk mode accepts a whole list at once, and seasonal trend data shows when demand actually peaks." },
      { icon: Globe, title: "Domain Analytics", desc: "Authority, estimated traffic, and the full ranked-keyword footprint of any domain.", to: "/domains",
        how: "Profiles any domain — yours or a competitor's — with its authority score, estimated organic traffic and the complete list of keywords it ranks for, each with position and volume, so you can see what is actually carrying the site's traffic." },
      { icon: Swords, title: "Competitor Analysis", desc: "Find keyword gaps and shared terms — see exactly where rivals out-rank you.", to: "/competitors",
        how: "Compares your domain against rivals and splits the keyword sets three ways: terms you both rank for, terms only they rank for, and terms only you do. The gap list is the actionable one — real keywords with real volume that a competitor already wins and you do not." },
      { icon: Link, title: "Backlink Intelligence", desc: "Referring domains, anchor profiles, and authority scores, with free fallbacks built in.", to: "/backlinks",
        how: "Reads the backlink index for a domain and reports how many distinct sites link to it, which individual links carry the most authority, and what anchor text those links use — an anchor profile skewed to exact-match commercial terms is a risk signal worth seeing." },
      { icon: LineChart, title: "Rank Tracking", desc: "Daily Google positions across locations and devices, with movement alerts.", to: "/rank",
        how: "Records a domain's Google position for a keyword and then re-checks it automatically every day, keeping the history as a chart. Significant moves — a shift of about three places, or entering or leaving the top ten — are flagged so you notice a drop without watching the table." },
    ],
  },
  {
    key: "site-health",
    title: "Site Health & On-Page",
    tagline: "Crawl, audit, and fix — a next-gen scraper plus deep on-page and content analysis.",
    features: [
      { icon: Radar, title: "Site Audit", desc: "A JS-rendering, Cloudflare-resistant crawl that surfaces every technical issue by priority.", to: "/audit",
        how: "Crawls the whole site rather than a single page and returns its technical health page by page, sorted into errors, warnings and notices. The crawler executes JavaScript, so single-page apps are audited as rendered rather than as an empty shell." },
      { icon: FileSearch, title: "On-Page Analysis", desc: "URL structure, headings, meta tags, images, schema, internal links and robots — in one scan.", to: "/onpage",
        how: "The deep single-URL scan: one pass returns a content score, readability grade, keyword density and the on-page issues found — headings, meta tags, images, schema, internal links and robots directives — with each issue explained in plain English." },
      { icon: MessageSquareText, title: "Content Analysis", desc: "Keyword density, readability, and semantic relevance versus the pages you compete with.", to: "/content",
        how: "Looks at how a keyword or brand is discussed across the web rather than on one page: the overall sentiment, the emotional connotations attached to it, and the sources cited most often when it comes up." },
      { icon: FileBarChart, title: "Site Report", desc: "One consolidated audit — page health, ranking signals, and fixes — with an AI advisor.", to: "/report",
        how: "A single run that assembles the domain overview, top-page scores, ranked keywords, competitors and current positions into one report, then has the AI advisor turn the findings into a prioritised, plain-English list of what to fix first." },
      { icon: CalendarClock, title: "Scheduled Monitoring", desc: "Automate audits and rank checks on a schedule and get the deltas that matter.", to: "/schedules",
        how: "Puts the reports you would otherwise re-run by hand on a recurring schedule. Each run executes on its own and saves into the matching project, so the history accumulates and you are comparing changes over time instead of isolated snapshots." },
    ],
  },
  {
    key: "ai-workspace",
    title: "AI, Content & Workspace",
    tagline: "Turn insight into published content, track your AI visibility, and run it all from one place.",
    features: [
      { icon: Sparkles, title: "AI Visibility", desc: "Track how often your brand is cited in ChatGPT and other AI answer engines.", to: "/ai-visibility",
        how: "Asks AI answer engines your keywords as real questions and records whether an answer appeared at all, whether your domain was cited in it, and which sources were cited instead. Google's dedicated AI Mode can be included as an optional extra call, and the whole run exports to a single spreadsheet." },
      { icon: Bot, title: "AI SEO Advisor", desc: "Plain-English, prioritised fixes generated from your own audit and ranking data.", to: "/report",
        how: "Part of the Site Report rather than a separate destination: it reads that report's own audit and ranking data and writes the recommendations out in order of impact, so the output is grounded in your measured results and not generic advice." },
      { icon: Film, title: "Web Stories", desc: "Turn topics and posts into tap-through, mobile-first AMP web stories.", to: "/webstories",
        how: "Builds tap-through, full-screen AMP web stories from a topic or an existing post. They are published as their own indexable pages, which is the format Google surfaces in the mobile stories carousel." },
      { icon: LayoutGrid, title: "All-in-One Workspace", desc: "Run SERP, keywords, content, and site report on a single domain from one page.", to: "/workspace",
        how: "Enter one keyword and one domain and every tool runs against them together, with the results laid out on a single page. It is the fastest way to open a new site or client without visiting each tool and re-typing the same two inputs." },
      { icon: Folder, title: "Projects", desc: "Save, organise, and revisit every analysis run per client or site.", to: "/projects",
        how: "Groups saved runs by client or site so a past analysis can be reopened later. Reopening a saved result is served from cache and costs nothing, which makes revisiting and sharing earlier work free." },
      { icon: MapPin, title: "Local SEO", desc: "See who owns the map pack for any location — listings, ratings, and unclaimed profiles.", to: "/local",
        how: "Searches Google's business listings around a location you pick by name and shows who holds the map pack: each business with its rating, review count and category, including profiles that are still unclaimed — the openings a local competitor has left available." },
    ],
  },
];

/** Flat list for the nav Tools mega-menu (first two features of each group). */
export const NAV_TOOLS: Feature[] = FEATURE_GROUPS.flatMap((g) => g.features.slice(0, 2));
