import { ExternalLink, LogOut, Menu } from "lucide-react";
import { Suspense, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { sectionVars } from "@/lib/sections";
import { useAuth } from "@/store/auth";
import { AdminSidebar } from "@/routes/admin/AdminSidebar";

/** Admin portal shell — a left sidebar + slim top bar, mirroring the main app.
 *  Guards the whole /admin area: non-admins are bounced to the admin login. */
export function AdminShell() {
  const token = useAuth((s) => s.accessToken);
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("admin-nav-collapsed") === "1");
  const [navOpen, setNavOpen] = useState(false);

  if (!token || !user?.is_admin) {
    return <Navigate to="/admin/login" replace />;
  }

  const toggleCollapse = () =>
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("admin-nav-collapsed", next ? "1" : "0");
      return next;
    });

  return (
    <div className="flex h-screen overflow-hidden bg-app-bg">
      <AdminSidebar
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        open={navOpen}
        onClose={() => setNavOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
          <button
            className="text-text-muted hover:text-text lg:hidden"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="ml-auto flex items-center gap-3">
            <a href="/" className="hidden items-center gap-1.5 text-sm text-text-muted hover:text-text sm:flex">
              <ExternalLink size={14} /> View site
            </a>
            <span className="hidden text-sm text-text-muted md:inline">{user.email}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                logout();
                navigate("/admin/login");
              }}
            >
              <LogOut size={15} /> Log out
            </Button>
          </div>
        </header>

        <main className="scrollbar-subtle flex-1 overflow-y-auto p-4 sm:p-6" style={sectionVars("admin")}>
          <div key={location.pathname} className="animate-fade-rise mx-auto max-w-[1400px]">
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
