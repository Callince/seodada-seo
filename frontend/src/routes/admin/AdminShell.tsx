import { ExternalLink, LogOut, ShieldCheck } from "lucide-react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/store/auth";

/** Separate admin portal shell — its own dark top bar, no main-app sidebar.
 *  Guards the whole /admin area: non-admins are bounced to the admin login. */
export function AdminShell() {
  const token = useAuth((s) => s.accessToken);
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();

  if (!token || !user?.is_admin) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="min-h-screen bg-app-bg">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#05091a] text-white">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg gradient-fill text-white shadow-glow">
              <ShieldCheck size={16} />
            </span>
            <span className="font-extrabold lowercase tracking-tight">
              <span className="gradient-text">seo</span>
              <span className="text-white">dada</span>
            </span>
            <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white/70">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="hidden items-center gap-1.5 text-sm text-white/60 hover:text-white sm:flex"
            >
              <ExternalLink size={14} /> View site
            </a>
            <span className="hidden text-sm text-white/50 md:inline">{user.email}</span>
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/10"
              onClick={() => {
                logout();
                navigate("/admin/login");
              }}
            >
              <LogOut size={15} /> Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
