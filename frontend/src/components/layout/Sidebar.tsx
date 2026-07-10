import {
  BarChart3,
  Briefcase,
  ChevronDown,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Rocket,
  Search,
  ShieldCheck,
  Sun,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";

import { cn } from "@/lib/cn";
import { visibleNavItems, type NavItem } from "@/lib/nav";
import { sectionIdForName, sectionVars } from "@/lib/sections";
import { useAuth } from "@/store/auth";

/** One icon chip per workflow group (mock: search/shield/rocket/chart/case). */
const GROUP_ICONS: Record<string, LucideIcon> = {
  "1 · Research": Search,
  "2 · Audit": ShieldCheck,
  "3 · Optimize": Rocket,
  "4 · Track": BarChart3,
  "5 · Manage": Briefcase,
  "Free tools": Wrench,
};

/** Group consecutive nav items that share a section. */
function groupItems(items: NavItem[]): { section?: string; items: NavItem[] }[] {
  const out: { section?: string; items: NavItem[] }[] = [];
  for (const it of items) {
    const last = out[out.length - 1];
    if (last && last.section === it.section) last.items.push(it);
    else out.push({ section: it.section, items: [it] });
  }
  return out;
}

/** Tracks the desktop (lg) breakpoint so the collapse width can be animated
 *  via an inline style — which transitions reliably, unlike toggling between
 *  two media-query width classes. */
function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = () => setDesktop(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return desktop;
}

function useDarkMode() {
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

function initials(name?: string, email?: string): string {
  const src = (name || "").trim();
  if (src) {
    const parts = src.split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}

/** A footer control row — icon + label, collapses to an icon on the rail. */
function RailButton({
  icon: Icon,
  label,
  onClick,
  collapsed,
  badge,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  collapsed: boolean;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text",
        collapsed && "lg:justify-center lg:px-0",
      )}
    >
      <Icon size={17} className="shrink-0" />
      <span className={cn("flex-1 text-left whitespace-nowrap", collapsed && "lg:hidden")}>{label}</span>
      {badge && (
        <kbd
          className={cn(
            "rounded bg-surface-2 px-1 font-mono text-[11px] text-text-muted",
            collapsed && "lg:hidden",
          )}
        >
          {badge}
        </kbd>
      )}
    </button>
  );
}

export function Sidebar({
  open,
  onClose,
  collapsed,
  onToggleCollapse,
  onCommand,
}: {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onCommand: () => void;
}) {
  const isDesktop = useIsDesktop();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const isAdmin = useAuth((s) => s.user?.is_admin);
  const { dark, toggle } = useDarkMode();
  // Workflow groups are expanded by default; users can fold each one.
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const groups = groupItems(visibleNavItems(isAdmin));

  // Mobile drawer: close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} aria-hidden />
      )}

      <aside
        aria-label="Sidebar navigation"
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        style={isDesktop ? { width: collapsed ? "4rem" : "15rem" } : undefined}
        className={cn(
          "glass-card z-50 w-64 shrink-0 flex-col overflow-hidden rounded-none border-y-0 border-l-0 border-r border-border/70",
          "transition-[width] duration-300 ease-in-out",
          "fixed inset-y-0 left-0 lg:static",
          open ? "flex animate-fade-rise" : "hidden lg:flex",
        )}
      >
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden p-3 lg:px-2">
          {groups.map((g) => {
            const GroupIcon = g.section ? GROUP_ICONS[g.section] : undefined;
            const step = g.section?.match(/^(\d+)\s·\s(.+)$/);
            const title = step ? step[2] : g.section;
            const isFolded = !!(g.section && folded[g.section]);
            // Bind this group's accent so its chip + active items self-color.
            const gvars = sectionVars(sectionIdForName(g.section));

            const links = g.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={onClose}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
                    collapsed && "lg:justify-center lg:px-0",
                    isActive
                      ? "section-gradient font-semibold text-white shadow-glow"
                      : "text-text-muted hover:bg-[color:var(--section-soft)] hover:text-text",
                  )
                }
              >
                <Icon size={17} className="shrink-0" />
                <span className={cn("whitespace-nowrap", collapsed && "lg:hidden")}>{label}</span>
              </NavLink>
            ));

            // Ungrouped (Overview) items: flat links at the top.
            if (!g.section || !GroupIcon)
              return (
                <div key={g.section ?? "top"} className="contents" style={gvars}>
                  {links}
                </div>
              );

            // Collapsed rail: divider + icons only.
            if (collapsed && isDesktop) {
              return (
                <div key={g.section} className="contents" style={gvars}>
                  <div className="mx-2 mt-3 border-t border-border" aria-hidden />
                  {links}
                </div>
              );
            }

            // Expanded: icon-chip group header + collapsible items with a rail.
            return (
              <div key={g.section} className="mt-2 first:mt-0" style={gvars}>
                <button
                  onClick={() => setFolded((f) => ({ ...f, [g.section!]: !f[g.section!] }))}
                  aria-expanded={!isFolded}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="section-gradient grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white shadow-glow">
                    <GroupIcon size={15} />
                  </span>
                  <span className="flex-1 text-[13px] font-semibold text-text">{title}</span>
                  <ChevronDown
                    size={14}
                    className={cn("text-text-muted transition-transform", isFolded && "-rotate-90")}
                  />
                </button>
                {!isFolded && (
                  <div
                    className="ml-[15px] mt-0.5 space-y-0.5 border-l pl-2.5"
                    style={{ borderColor: "color-mix(in srgb, var(--section) 30%, transparent)" }}
                  >
                    {links}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer — search, theme, account (relocated from the old top bar). */}
        <div className="space-y-0.5 border-t border-border p-2">
          <RailButton icon={Search} label="Search" badge="⌘K" onClick={onCommand} collapsed={collapsed} />
          <RailButton
            icon={dark ? Sun : Moon}
            label={dark ? "Light mode" : "Dark mode"}
            onClick={toggle}
            collapsed={collapsed}
          />

          <div
            className={cn(
              "mt-1 flex items-center gap-2 rounded-xl px-2 py-1.5",
              collapsed && "lg:justify-center lg:px-0",
            )}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full gradient-fill text-xs font-semibold text-white shadow-glow">
              {initials(user?.full_name, user?.email)}
            </span>
            <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
              <p className="truncate text-xs font-medium text-text">{user?.full_name || "Account"}</p>
              <p className="truncate text-[11px] text-text-muted">{user?.email}</p>
            </div>
          </div>

          <RailButton icon={LogOut} label="Log out" onClick={logout} collapsed={collapsed} />

          {/* Collapse toggle — desktop only */}
          <button
            onClick={onToggleCollapse}
            className={cn(
              "hidden w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-text lg:flex",
              collapsed && "lg:justify-center lg:px-0",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            <span className={cn("whitespace-nowrap", collapsed && "lg:hidden")}>Collapse</span>
          </button>
        </div>
      </aside>
    </>
  );
}
