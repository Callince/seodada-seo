import {
  CalendarClock,
  FileBarChart,
  FileSearch,
  Folder,
  Globe,
  LayoutDashboard,
  LayoutGrid,
  LineChart,
  ListTree,
  MessageSquareText,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Only shown to platform admins (user.is_admin). */
  adminOnly?: boolean;
  /** Sidebar section header this item belongs to. */
  section?: string;
}

/** Single source of truth for primary navigation — used by the Sidebar and
 *  the ⌘K command palette so they never drift. */
export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/workspace", label: "All-in-One", icon: LayoutGrid },
  { to: "/serp", label: "SERP Ranking", icon: Search, section: "Research" },
  { to: "/keywords", label: "Keyword Research", icon: ListTree, section: "Research" },
  { to: "/domains", label: "Domain Analytics", icon: Globe, section: "Research" },
  { to: "/competitors", label: "Competitors", icon: Swords, section: "Research" },
  { to: "/ai-visibility", label: "AI Visibility", icon: Sparkles, section: "Research" },
  { to: "/onpage", label: "On-Page", icon: FileSearch, section: "Site health" },
  { to: "/content", label: "Content Analysis", icon: MessageSquareText, section: "Site health" },
  { to: "/rank", label: "Rank Tracking", icon: LineChart, section: "Site health" },
  { to: "/report", label: "Site Report", icon: FileBarChart, section: "Site health" },
  { to: "/audit", label: "Site Audit", icon: Radar, section: "Site health" },
  { to: "/schedules", label: "Schedules", icon: CalendarClock, section: "Workspace" },
  { to: "/projects", label: "Projects", icon: Folder, section: "Workspace" },
  { to: "/admin", label: "Admin", icon: ShieldCheck, adminOnly: true, section: "Workspace" },
];

/** Nav items visible to the given user (admin entries filtered out otherwise). */
export function visibleNavItems(isAdmin: boolean | undefined): NavItem[] {
  return NAV_ITEMS.filter((n) => !n.adminOnly || isAdmin);
}
