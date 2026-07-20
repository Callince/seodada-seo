import { ChevronDown, LayoutDashboard, LogOut } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/cn";
import { useDismiss } from "@/lib/useDismiss";
import { useAuth } from "@/store/auth";

/** Two initials from a name, falling back to the email's first letter. */
export function initials(name?: string, email?: string): string {
  const src = (name || "").trim();
  if (src) {
    const parts = src.split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}

/**
 * Signed-in account control: avatar, name, and a menu with the account's
 * destinations and log out.
 *
 * Shared between the app shell and the public header on purpose. The public
 * site previously had no account UI at all — a signed-in visitor saw a bare
 * "Dashboard" button on desktop and, worse, "Log in / Get started" in the
 * mobile drawer, with no way to sign out without going into the app first.
 * One component means the two can't answer that question differently.
 */
export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 rounded-full p-0.5 pr-2 transition-colors hover:bg-surface-2",
          compact && "pr-0.5",
        )}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full gradient-fill text-xs font-semibold text-white shadow-glow">
          {initials(user?.full_name, user?.email)}
        </span>
        {!compact && (
          <>
            <span className="hidden max-w-[8rem] truncate text-sm font-medium text-text sm:block">
              {user?.full_name || "Account"}
            </span>
            <ChevronDown
              size={14}
              aria-hidden
              className={cn("text-text-muted transition-transform", open && "rotate-180")}
            />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-surface shadow-[shadow:var(--lift-3)]"
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-sm font-medium text-text">{user?.full_name || "Account"}</p>
            <p className="truncate text-xs text-text-muted">{user?.email}</p>
          </div>
          <Link
            role="menuitem"
            to="/dashboard"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text transition-colors hover:bg-surface-2"
          >
            <LayoutDashboard size={15} aria-hidden className="text-text-muted" /> Dashboard
          </Link>
          <button
            role="menuitem"
            onClick={logout}
            className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-sm text-text transition-colors hover:bg-surface-2"
          >
            <LogOut size={15} aria-hidden className="text-text-muted" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
