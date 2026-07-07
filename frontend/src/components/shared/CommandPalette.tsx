import { CornerDownLeft, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { cn } from "@/lib/cn";
import { visibleNavItems } from "@/lib/nav";
import { useAuth } from "@/store/auth";

interface Action {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  run: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const isAdmin = useAuth((s) => s.user?.is_admin);

  const actions = useMemo<Action[]>(() => {
    const q = query.trim().toLowerCase();
    const nav: Action[] = visibleNavItems(isAdmin).map((n) => ({
      id: `nav:${n.to}`,
      label: n.label,
      hint: "Go to page",
      icon: n.icon,
      run: () => navigate(n.to),
    }));
    const filtered = q ? nav.filter((a) => a.label.toLowerCase().includes(q)) : nav;
    if (q) {
      filtered.push({
        id: "serp-search",
        label: `Search “${query.trim()}” in SERP`,
        hint: "Run SERP",
        icon: Search,
        run: () => navigate(`/serp?q=${encodeURIComponent(query.trim())}`),
      });
    }
    return filtered;
  }, [query, navigate, isAdmin]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // focus after paint
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);

  if (!open) return null;

  const choose = (a: Action) => {
    a.run();
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, actions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (actions[active]) choose(actions[active]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-surface shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search size={16} className="text-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to a page or search…"
            className="h-12 w-full bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {actions.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-text-muted">No matches.</li>
          )}
          {actions.map((a, i) => (
            <li key={a.id}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(a)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm",
                  i === active ? "bg-primary-soft text-primary" : "text-text hover:bg-surface-2",
                )}
              >
                <a.icon size={16} className={i === active ? "text-primary" : "text-text-muted"} />
                <span className="flex-1">{a.label}</span>
                {a.hint && <span className="text-xs text-text-muted">{a.hint}</span>}
                {i === active && <CornerDownLeft size={13} className="text-text-muted" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
