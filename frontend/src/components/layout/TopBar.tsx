import { Bell, ChevronDown, LogOut, Menu, Moon, Search, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/store/auth";

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

/** Close a popover on outside-click or Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Bell size={18} />
      </Button>
      {open && (
        <div role="menu" className="glass-card absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-2xl lp-shadow-lg">
          <div className="border-b border-border px-3 py-2.5 text-sm font-semibold text-text">Notifications</div>
          <div className="px-3 py-8 text-center text-sm text-text-muted">You're all caught up.</div>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full p-0.5 pr-2 transition-colors hover:bg-surface-2"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="grid h-8 w-8 place-items-center rounded-full gradient-fill text-xs font-semibold text-white shadow-glow">
          {initials(user?.full_name, user?.email)}
        </span>
        <span className="hidden max-w-[8rem] truncate text-sm font-medium text-text sm:block">
          {user?.full_name || "Account"}
        </span>
        <ChevronDown size={14} className="text-text-muted" />
      </button>

      {open && (
        <div role="menu" className="glass-card absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-2xl lp-shadow-lg">
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-sm font-medium text-text">{user?.full_name || "Account"}</p>
            <p className="truncate text-xs text-text-muted">{user?.email}</p>
            {user?.role && (
              <span className="mt-1.5 inline-block rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium capitalize text-primary">
                {user.role}
              </span>
            )}
          </div>
          <button
            role="menuitem"
            onClick={logout}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text transition-colors hover:bg-surface-2"
          >
            <LogOut size={15} className="text-text-muted" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

export function TopBar({ onMenu, onCommand }: { onMenu: () => void; onCommand: () => void }) {
  const { dark, toggle } = useDarkMode();

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 bg-transparent px-3 sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu size={18} />
      </Button>

      {/* Search — opens the ⌘K command palette. */}
      <button
        onClick={onCommand}
        aria-label="Search"
        className="flex h-10 w-full max-w-md items-center gap-2 rounded-xl border border-border bg-surface-2/60 px-3.5 text-sm text-text-muted transition-colors hover:bg-surface-2"
      >
        <Search size={16} className="shrink-0" />
        <span className="flex-1 truncate text-left">Search anything…</span>
        <kbd className="hidden rounded bg-surface-2 px-1 font-mono text-[11px] sm:inline">⌘K</kbd>
      </button>

      {/* Theme, notifications, account — right-aligned. */}
      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </Button>
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
