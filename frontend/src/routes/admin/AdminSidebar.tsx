import { PanelLeftClose, PanelLeftOpen, ShieldCheck } from "lucide-react";
import { NavLink } from "react-router-dom";

import { useAdminMe } from "@/api/hooks/useAdmin";
import { cn } from "@/lib/cn";
import { sectionVars } from "@/lib/sections";
import { visibleAdminNav } from "@/lib/adminNav";

/** Flat admin sidebar (no workflow groups). Desktop: collapsible rail.
 *  Mobile: slide-in drawer controlled by `open`/`onClose`. Slate section accent. */
export function AdminSidebar({
  collapsed,
  onToggleCollapse,
  open,
  onClose,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  open: boolean;
  onClose: () => void;
}) {
  const { data: me } = useAdminMe();
  const items = visibleAdminNav(me);

  return (
    <>
      {/* mobile scrim */}
      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} aria-hidden />}

      <aside
        style={sectionVars("admin")}
        className={cn(
          "z-50 flex shrink-0 flex-col border-r border-border bg-surface transition-all duration-200",
          "fixed inset-y-0 left-0 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
          collapsed ? "w-[68px]" : "w-60",
        )}
        aria-label="Admin navigation"
      >
        {/* brand */}
        <div className="flex h-14 items-center gap-2 px-4">
          <span className="section-gradient grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white shadow-sm">
            <ShieldCheck size={16} />
          </span>
          {!collapsed && (
            <span className="truncate font-extrabold lowercase tracking-tight text-text">
              seodada <span className="text-xs font-semibold uppercase text-text-muted">admin</span>
            </span>
          )}
        </div>

        {/* nav */}
        <nav className="scrollbar-subtle flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              onClick={onClose}
              title={collapsed ? it.label : undefined}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                  collapsed && "justify-center",
                  isActive
                    ? "section-gradient text-white shadow-sm"
                    : "text-text-muted hover:bg-[color:var(--section-soft)] hover:text-[color:var(--section)]",
                )
              }
            >
              <it.icon size={17} className="shrink-0" />
              {!collapsed && <span className="truncate">{it.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* collapse toggle (desktop) */}
        <button
          onClick={onToggleCollapse}
          className="hidden items-center gap-2 border-t border-border px-3 py-2.5 text-sm text-text-muted hover:text-text lg:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <><PanelLeftClose size={16} /> Collapse</>}
        </button>
      </aside>
    </>
  );
}
