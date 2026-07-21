import {
  CalendarClock,
  MapPin,
  FileBarChart,
  FileSearch,
  Folder,
  CreditCard,
  Globe,
  Heading,
  Image,
  Link2,
  LayoutDashboard,
  LayoutGrid,
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

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Only shown to platform admins (user.is_admin). */
  adminOnly?: boolean;
  /** Sidebar section header this item belongs to. Numbered sections
   *  ("1 · Research") render as connected workflow steps. */
  section?: string;
}

/**
 * Single source of truth for primary navigation — used by the Sidebar and the
 * ⌘K command palette so they never drift.
 *
 * Ordered as the real SEO workflow so the sidebar reads as a process, each step
 * feeding the next: Research → Audit → Optimize → Track → Manage.
 */
export const NAV_ITEMS: NavItem[] = [
  // ---- Overview ----
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true, section: "Overview" },
  { to: "/workspace", label: "All-in-One", icon: LayoutGrid, section: "Overview" },

  // ---- Step 1 · Research — understand the landscape before you build ----
  { to: "/keywords", label: "Keyword Research", icon: ListTree, section: "1 · Research" },
  { to: "/serp", label: "SERP Ranking", icon: Search, section: "1 · Research" },
  { to: "/domains", label: "Domain Analytics", icon: Globe, section: "1 · Research" },
  { to: "/competitors", label: "Competitors", icon: Swords, section: "1 · Research" },
  { to: "/local", label: "Local SEO", icon: MapPin, section: "1 · Research" },

  // ---- Step 2 · Audit — scan the site & every page ----
  { to: "/audit", label: "Site Audit", icon: Radar, section: "2 · Audit" },
  { to: "/onpage", label: "On-Page", icon: FileSearch, section: "2 · Audit" },

  // ---- Step 3 · Optimize — fix, write, and improve ----
  { to: "/content", label: "Content Analysis", icon: MessageSquareText, section: "3 · Optimize" },
  { to: "/report", label: "Site Report", icon: FileBarChart, section: "3 · Optimize" },

  // ---- Step 4 · Track — monitor rankings & visibility over time ----
  { to: "/rank", label: "Rank Tracking", icon: LineChart, section: "4 · Track" },
  { to: "/backlinks", label: "Backlinks", icon: Link2, section: "4 · Track" },
  { to: "/ai-visibility", label: "AI Visibility", icon: Sparkles, section: "4 · Track" },
  { to: "/schedules", label: "Schedules", icon: CalendarClock, section: "4 · Track" },

  // ---- Step 5 · Manage ----
  { to: "/projects", label: "Projects", icon: Folder, section: "5 · Manage" },
  { to: "/billing", label: "Billing", icon: CreditCard, section: "5 · Manage" },

  // ---- Free instant tools (utilities, available any time) ----
  { to: "/tools", label: "All-in-One", icon: LayoutGrid, end: true, section: "Free tools" },
  { to: "/tools/url", label: "URL Analysis", icon: Link2, section: "Free tools" },
  { to: "/tools/keyword", label: "Keyword Analysis", icon: Search, section: "Free tools" },
  { to: "/tools/heading", label: "Heading Analysis", icon: Heading, section: "Free tools" },
  { to: "/tools/image", label: "Image Analysis", icon: Image, section: "Free tools" },
  { to: "/tools/meta", label: "Meta Analysis", icon: Tags, section: "Free tools" },
  { to: "/tools/sitemap", label: "Sitemap Analysis", icon: Network, section: "Free tools" },
];

/** Nav items visible to the given user (admin entries filtered out otherwise). */
export function visibleNavItems(isAdmin: boolean | undefined): NavItem[] {
  return NAV_ITEMS.filter((n) => !n.adminOnly || isAdmin);
}
