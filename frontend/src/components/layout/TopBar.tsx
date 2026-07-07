import { ChevronDown, LogOut, Menu, Moon, Search, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { NAV_ITEMS } from "@/lib/nav";
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

function UserMenu() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full p-0.5 pr-2 transition-colors hover:bg-surface-2"
        aria-label="Account menu"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
          {initials(user?.full_name, user?.email)}
        </span>
        <ChevronDown size={14} className="text-text-muted" />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-surface shadow-md">
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
  const { pathname } = useLocation();
  const pageLabel =
    NAV_ITEMS.find((n) => (n.end ? pathname === n.to : n.to !== "/" && pathname.startsWith(n.to)))
      ?.label ?? "Dashboard";

  return (
    <header className="flex h-14 items-center justify-between gap-2 border-b border-border bg-surface px-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open menu">
          <Menu size={18} />
        </Button>
        <span className="truncate text-sm font-semibold text-text">{pageLabel}</span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={onCommand}
          className={cn(
            "hidden items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1.5 text-xs text-text-muted",
            "transition-colors hover:bg-surface-2 md:inline-flex",
          )}
          aria-label="Open command palette"
        >
          <Search size={13} /> Search
          <kbd className="rounded bg-surface-2 px-1 font-mono text-[10px] text-text-muted">⌘K</kbd>
        </button>
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </Button>
        <UserMenu />
      </div>
    </header>
  );
}
