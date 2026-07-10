import { Menu } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { Sidebar } from "@/components/layout/Sidebar";
import { CommandPalette } from "@/components/shared/CommandPalette";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/toaster";
import { sectionIdForPath, sectionVars } from "@/lib/sections";

export function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("nav-collapsed") === "1");
  const location = useLocation();

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("nav-collapsed", next ? "1" : "0");
      return next;
    });

  // Global ⌘K / Ctrl+K toggle for the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app-canvas flex h-screen overflow-hidden">
      <Sidebar
        open={navOpen}
        onClose={() => setNavOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
        onCommand={() => setPaletteOpen(true)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* No top bar — a floating button opens the nav drawer on mobile. */}
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Open menu"
          className="glass-card lp-shadow fixed left-3 top-3 z-30 grid h-10 w-10 place-items-center rounded-xl lg:hidden"
        >
          <Menu size={18} />
        </button>
        <main className="flex-1 overflow-y-auto px-4 pb-6 pt-16 sm:px-6 lg:pt-6">
          {/* --section accent is bound to the active route's workflow group, so
              every shared component below inherits its color automatically. */}
          <div className="mx-auto max-w-[1440px]" style={sectionVars(sectionIdForPath(location.pathname))}>
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              {/* Re-key on path so the CSS fade-rise replays on each navigation
                  (zero-JS page transition — no Framer Motion in the bundle). */}
              <div key={location.pathname} className="animate-fade-rise">
                <Outlet />
              </div>
            </Suspense>
          </div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Toaster />
    </div>
  );
}
