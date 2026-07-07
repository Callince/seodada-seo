import { BarChart3, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";

import { cn } from "@/lib/cn";
import { visibleNavItems } from "@/lib/nav";
import { useAuth } from "@/store/auth";

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

export function Sidebar({
  open,
  onClose,
  collapsed,
  onToggleCollapse,
}: {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const isDesktop = useIsDesktop();
  const isAdmin = useAuth((s) => s.user?.is_admin);

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} aria-hidden />
      )}

      <aside
        style={isDesktop ? { width: collapsed ? "4rem" : "15rem" } : undefined}
        className={cn(
          "z-50 w-64 shrink-0 flex-col overflow-hidden border-r border-border bg-surface",
          "transition-[width] duration-300 ease-in-out",
          "fixed inset-y-0 left-0 lg:static",
          open ? "flex animate-fade-rise" : "hidden lg:flex",
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-border px-5 lg:px-4">
          <BarChart3 className="shrink-0 text-primary" size={22} />
          <span
            className={cn(
              "whitespace-nowrap text-sm font-extrabold lowercase tracking-tight transition-opacity duration-200",
              collapsed && "lg:pointer-events-none lg:opacity-0",
            )}
          >
            <span className="gradient-text">seo</span>
            <span className="text-text">dada</span>
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden p-3 lg:px-2">
          {visibleNavItems(isAdmin).map(({ to, label, icon: Icon, end, section }, i, items) => (
            <div key={to} className="contents">
              {section && section !== items[i - 1]?.section && (
                collapsed ? (
                  <div className="mx-2 mt-3 hidden border-t border-border lg:block" aria-hidden />
                ) : (
                  <p className="mt-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-text-muted first:mt-0">
                    {section}
                  </p>
                )
              )}
            <NavLink
              to={to}
              end={end}
              onClick={onClose}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  collapsed && "lg:justify-center lg:px-0",
                  isActive
                    ? "border-l-2 border-primary bg-primary-soft text-primary"
                    : "border-l-2 border-transparent text-text-muted hover:bg-surface-2 hover:text-text",
                )
              }
            >
              <Icon size={18} className="shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-opacity duration-200",
                  collapsed && "lg:hidden",
                )}
              >
                {label}
              </span>
            </NavLink>
            </div>
          ))}
        </nav>

        {/* Collapse toggle — desktop only */}
        <button
          onClick={onToggleCollapse}
          className="hidden h-11 items-center gap-3 border-t border-border px-3 text-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-text lg:flex lg:px-4"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          <span className={cn("whitespace-nowrap", collapsed && "lg:hidden")}>Collapse</span>
        </button>
      </aside>
    </>
  );
}
