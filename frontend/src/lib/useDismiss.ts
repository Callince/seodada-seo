import { useEffect, useRef } from "react";

/**
 * Close a popover on outside-click or Escape.
 *
 * Shared rather than redefined per surface — the app shell and the public
 * header both need it, and a second copy is how behaviour quietly drifts
 * (the theme toggle already went that way once).
 */
export function useDismiss(open: boolean, close: () => void) {
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
