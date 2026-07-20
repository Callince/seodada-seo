import { Bell, Menu, Moon, Search, Sun } from "lucide-react";
import { useState } from "react";

import { AccountMenu } from "@/components/shared/AccountMenu";
import { Button } from "@/components/ui/button";
import { useDarkMode } from "@/lib/useDarkMode";
import { useDismiss } from "@/lib/useDismiss";

// Theme switching lives in @/lib/useDarkMode — see the note there on why the
// transition-suppression must not be reimplemented per surface.

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
        <div role="menu" className="glass-card absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-lg shadow-[shadow:var(--lift-3)]">
          <div className="border-b border-border px-3 py-2.5 text-sm font-semibold text-text">Notifications</div>
          <div className="px-3 py-8 text-center text-sm text-text-muted">You're all caught up.</div>
        </div>
      )}
    </div>
  );
}

export function TopBar({ onMenu, onCommand }: { onMenu: () => void; onCommand: () => void }) {
  const { dark, toggle } = useDarkMode();

  // Glass is rationed to chrome that floats over moving content (Aperture §4).
  // This bar is the canonical case: page content scrolls beneath it.
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border/60 bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] px-3 backdrop-blur-xl sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu size={18} />
      </Button>

      {/* Search — opens the ⌘K command palette. */}
      <button
        onClick={onCommand}
        aria-label="Search"
        className="flex h-10 w-full max-w-md items-center gap-2 rounded-md border border-border bg-surface-2/60 px-3.5 text-sm text-text-muted transition-colors hover:bg-surface-2"
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
        <AccountMenu />
      </div>
    </header>
  );
}
