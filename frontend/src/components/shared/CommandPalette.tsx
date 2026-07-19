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

  // While open: lock body scroll and keep focus inside the dialog. Escape and
  // Tab are handled at the document level so they work regardless of which
  // element (input or an option button) currently holds focus.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab") {
        // Single-field palette — trap focus on the search input.
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

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
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        // Stratum z3 (§4): a true overlay — glass, top radius rung, deepest lift.
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] shadow-[shadow:var(--lift-3)] backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search size={16} className="text-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded
            aria-controls="cmdk-list"
            aria-activedescendant={actions[active] ? `cmdk-opt-${active}` : undefined}
            aria-autocomplete="list"
            aria-label="Jump to a page or search"
            placeholder="Jump to a page or search…"
            className="h-12 w-full bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
          />
        </div>
        <ul id="cmdk-list" role="listbox" aria-label="Results" className="max-h-80 overflow-y-auto p-2">
          {actions.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-text-muted">No matches.</li>
          )}
          {actions.map((a, i) => (
            <li key={a.id} id={`cmdk-opt-${i}`} role="option" aria-selected={i === active}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(a)}
                tabIndex={-1}
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
