import { Check, ChevronDown, Loader2, MapPin, Search } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { locationText, useLocationLookup, useLocationSearch, type LocationItem } from "@/api/hooks/useLocations";
import { cn } from "@/lib/cn";

export interface LocationOption {
  location_code: number;
  language_code: string;
  label: string;
}

/**
 * Markets shown before the user types, so the dropdown opens useful rather than
 * empty and the common case needs no network round-trip. The full catalogue —
 * 213 countries and 57k cities — is searched server-side via
 * `/locations/search`; these are just the head of the list.
 *
 * Codes are DataForSEO geotarget IDs (2000 + ISO-3166 numeric for countries).
 */
export const REGIONS: { label: string; options: LocationOption[] }[] = [
  {
    label: "Popular",
    options: [
      { location_code: 2840, language_code: "en", label: "United States" },
      { location_code: 2356, language_code: "en", label: "India" },
      { location_code: 2826, language_code: "en", label: "United Kingdom" },
      { location_code: 2124, language_code: "en", label: "Canada" },
      { location_code: 2036, language_code: "en", label: "Australia" },
      { location_code: 2276, language_code: "de", label: "Germany" },
      { location_code: 2250, language_code: "fr", label: "France" },
      { location_code: 2784, language_code: "en", label: "United Arab Emirates" },
    ],
  },
  {
    label: "Popular cities",
    options: [
      { location_code: 1007809, language_code: "en", label: "Chennai, Tamil Nadu, India" },
      { location_code: 1007785, language_code: "en", label: "Mumbai, Maharashtra, India" },
      { location_code: 1007768, language_code: "en", label: "Bengaluru, Karnataka, India" },
      { location_code: 1023191, language_code: "en", label: "New York, New York, United States" },
      { location_code: 1006886, language_code: "en", label: "London, England, United Kingdom" },
    ],
  },
];

/** Flat list of the quick-pick options. */
export const LOCATIONS: LocationOption[] = REGIONS.flatMap((r) => r.options);

/**
 * Code → label, so `locationLabel()` can stay **synchronous** for the report
 * headers and CSV exports that call it during render.
 *
 * Seeded with the quick picks, then filled by every search/lookup the picker
 * performs, so any code the user actually selected resolves. A code never seen
 * still degrades to "#123" exactly as it did before.
 */
const labelCache = new Map<number, string>(LOCATIONS.map((o) => [o.location_code, o.label]));

export function rememberLocations(items: LocationItem[]): void {
  for (const it of items) labelCache.set(it.code, locationText(it));
}

/** Human label for a location code, e.g. for list rows and export headers. */
export function locationLabel(code: number): string {
  return labelCache.get(code) ?? `#${code}`;
}

interface Props {
  value: { location_code: number; language_code: string };
  onChange: (v: { location_code: number; language_code: string }) => void;
  className?: string;
  /** Restrict to one kind; omit to search countries and cities together. */
  kind?: "country" | "city";
  "aria-label"?: string;
}

/**
 * Searchable country/city picker backed by `/locations/search`.
 *
 * A `<select>` cannot hold 57k cities and shipping them to the browser would
 * cost ~741 KB gzipped, so matching happens server-side against the `locations`
 * table. Every code it emits comes from DataForSEO's own geo-target list, so a
 * selection can never be one the research endpoints reject.
 */
export function LocationLanguagePicker({
  value, onChange, className, kind, "aria-label": ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // The panel is portalled to <body>, so it needs explicit coordinates.
  const [rect, setRect] = useState<
    { top: number; left: number; width: number; above: boolean; maxHeight: number } | null
  >(null);

  // Debounce so a fast typist fires one request, not one per keystroke.
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 180);
    return () => clearTimeout(t);
  }, [query]);

  const search = useLocationSearch(debounced, { kind, enabled: open });
  // Resolve the *selected* code so the closed button shows a real name after a
  // reload, when only the number survived in persisted state.
  const unresolved = labelCache.has(value.location_code) ? [] : [value.location_code];
  const lookup = useLocationLookup(unresolved);

  useEffect(() => {
    if (search.data?.rows) rememberLocations(search.data.rows);
  }, [search.data]);
  useEffect(() => {
    if (lookup.data) rememberLocations(lookup.data);
  }, [lookup.data]);

  const quickPicks = useMemo(
    () => (kind ? LOCATIONS.filter((o) => (kind === "city") === o.label.includes(",")) : LOCATIONS),
    [kind],
  );

  // Before the user types, show the quick picks; after, the server's results.
  const rows: { code: number; language_code: string; text: string; sub?: string }[] = debounced
    ? (search.data?.rows ?? []).map((r) => ({
        code: r.code,
        language_code: r.language_code,
        text: r.name,
        sub: r.kind === "country" ? "Country" : [r.region, r.country_name].filter(Boolean).join(", "),
      }))
    : quickPicks.map((o) => ({ code: o.location_code, language_code: o.language_code, text: o.label }));

  // Closing resets the search, so reopening never shows a stale query with
  // results that no longer match it. Done here rather than in an effect on
  // `open` — that would be a setState cascade for something every caller
  // already knows it is doing.
  const close = () => {
    setOpen(false);
    setQuery("");
    setActive(0);
  };

  const PANEL_MAX = 360; // the panel's preferred height when there is room
  const PANEL_MIN = 160; // below this a dropdown is not worth showing

  /** Anchor the portalled panel to the trigger, flipping up when short of room. */
  const place = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 4;
    const below = window.innerHeight - r.bottom - gap;
    const aboveRoom = r.top - gap;
    // Flip up only when that genuinely helps.
    const above = below < PANEL_MAX && aboveRoom > below;
    // Cap to the room on the chosen side: on a short viewport the panel fits
    // neither way, and without this it hangs off the top of the screen.
    const room = above ? aboveRoom : below;
    setRect({
      top: above ? r.top - gap : r.bottom + gap,
      left: Math.min(Math.max(r.left, 8), window.innerWidth - Math.max(r.width, 288) - 8),
      width: Math.max(r.width, 288),
      above,
      maxHeight: Math.max(Math.min(PANEL_MAX, room), PANEL_MIN),
    });
  }, []);

  // Before paint, so the panel never renders at a stale position for a frame.
  useLayoutEffect(() => {
    if (!open) return;
    place();
    // `true` = capture, so scrolling any ancestor (not just the window) keeps
    // the panel glued to its trigger.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  // Close on outside click. The panel lives in a portal outside `rootRef`, so
  // clicks inside it must be checked separately or picking an option would
  // close the dropdown before the click landed.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!rootRef.current?.contains(t) && !panelRef.current?.contains(t)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Moving focus is a real side effect on the DOM, so this one belongs here.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const choose = (row: { code: number; language_code: string }) => {
    onChange({ location_code: row.code, language_code: row.language_code });
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, rows.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (rows[active]) choose(rows[active]); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  };

  const current = locationLabel(value.location_code);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? "Country or city"}
        className="flex w-full min-w-0 items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-left text-sm text-text hover:border-[color:var(--section)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--section)]"
      >
        <MapPin size={14} className="shrink-0 text-text-muted" />
        <span className="min-w-0 flex-1 truncate">
          {lookup.isPending && unresolved.length > 0 ? "Loading…" : current}
        </span>
        <ChevronDown size={14} className="shrink-0 text-text-muted" />
      </button>

      {/* Portalled to <body>: every page puts this picker inside a Card, and
          Card sets `[overflow:clip]`, which would slice the panel off at the
          card's edge. A portal also sidesteps any ancestor stacking context. */}
      {open && rect && createPortal(
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            top: rect.above ? undefined : rect.top,
            bottom: rect.above ? window.innerHeight - rect.top : undefined,
            left: rect.left,
            width: rect.width,
            maxHeight: rect.maxHeight,
          }}
          className="z-50 flex flex-col overflow-hidden rounded-md border border-border bg-surface shadow-lg"
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
            <Search size={14} className="shrink-0 text-text-muted" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={onKeyDown}
              placeholder="Search any country or city…"
              aria-label="Search locations"
              aria-controls={listId}
              aria-autocomplete="list"
              role="combobox"
              aria-expanded
              className="w-full bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
            />
            {search.isFetching && <Loader2 size={14} className="shrink-0 animate-spin text-text-muted" />}
          </div>

          <ul id={listId} role="listbox" className="min-h-0 flex-1 overflow-y-auto py-1">
            {rows.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-text-muted">
                {search.isFetching ? "Searching…" : `No location matches “${debounced}”.`}
              </li>
            )}
            {rows.map((r, i) => (
              <li key={r.code} role="option" aria-selected={r.code === value.location_code}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(r)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm",
                    i === active ? "bg-[color:var(--section-soft)]" : "hover:bg-[color:var(--section-soft)]",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-text">{r.text}</span>
                  {r.sub && <span className="shrink-0 text-xs text-text-muted">{r.sub}</span>}
                  {r.code === value.location_code && (
                    <Check size={14} className="shrink-0 text-[color:var(--section-ink)]" />
                  )}
                </button>
              </li>
            ))}
          </ul>

          {search.data?.truncated && (
            <p className="shrink-0 border-t border-border px-3 py-1.5 text-xs text-text-muted">
              More matches than shown — keep typing to narrow it down.
            </p>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
