import {
  Activity, CreditCard, FileText, Inbox, LayoutDashboard, Mail, Settings,
  ShieldCheck, Users, Wallet, type LucideIcon,
} from "lucide-react";

/** Admin sections — single source of truth for the sidebar + routes.
 *  `perm` mirrors the backend permission slug that gates each section. */
export interface AdminNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  perm: string;
  end?: boolean;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, perm: "dashboard", end: true },
  { to: "/admin/users", label: "Users", icon: Users, perm: "user_management" },
  { to: "/admin/content", label: "Content", icon: FileText, perm: "content_management" },
  { to: "/admin/plans", label: "Plans", icon: CreditCard, perm: "subscription_management" },
  { to: "/admin/billing", label: "Billing", icon: Wallet, perm: "payments" },
  { to: "/admin/contact", label: "Contact", icon: Inbox, perm: "contact_submissions" },
  { to: "/admin/emails", label: "Emails", icon: Mail, perm: "email_logs" },
  { to: "/admin/usage", label: "Usage", icon: Activity, perm: "search_history" },
  { to: "/admin/roles", label: "Roles", icon: ShieldCheck, perm: "manage_roles" },
  { to: "/admin/settings", label: "Settings", icon: Settings, perm: "website_settings" },
];

/** What this admin may see. Until `me` loads, show everything (matches the old
 *  behaviour); a super-admin holds every permission implicitly. */
export function visibleAdminNav(me?: { is_super: boolean; permissions: string[] }): AdminNavItem[] {
  if (!me) return ADMIN_NAV;
  return ADMIN_NAV.filter((n) => me.is_super || me.permissions.includes(n.perm));
}

/** Whether an admin may access a section (for direct-URL guarding). */
export function canAccessAdmin(perm: string, me?: { is_super: boolean; permissions: string[] }): boolean {
  if (!me) return true; // permissions still loading
  return me.is_super || me.permissions.includes(perm);
}
