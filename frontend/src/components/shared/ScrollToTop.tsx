import { useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/** Layout effect on the client, plain effect during prerender (where
 *  useLayoutEffect warns and no effect runs anyway). */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Scroll offset per history entry, keyed by `location.key`.
 *
 * Module-level on purpose: it must outlive the component across route changes,
 * and it is intentionally not persisted — a fresh page load starts a fresh
 * history stack, so stale entries would only ever be wrong.
 */
const positions = new Map<string, number>();

/** The dashboard shell is `h-screen overflow-hidden` with a scrollable inner
 *  <main>, so the window never scrolls there. Public pages scroll the window.
 *  Whichever is actually scrollable is the one to read and write. */
function scrollableMain(): HTMLElement | null {
  const main = document.querySelector("main");
  return main && main.scrollHeight > main.clientHeight + 1 ? main : null;
}

function currentOffset(): number {
  return scrollableMain()?.scrollTop ?? window.scrollY;
}

function scrollTo(top: number): void {
  // `behavior: "instant"` is required, not cosmetic: `html { scroll-behavior:
  // smooth }` is set globally in index.css, so an unqualified call animates a
  // multi-thousand-pixel glide on every navigation.
  const main = scrollableMain();
  if (main) main.scrollTo({ top, left: 0, behavior: "instant" });
  window.scrollTo({ top, left: 0, behavior: "instant" });
}

/**
 * Scroll handling across route changes.
 *
 * A SPA keeps the scroll offset when the route changes, so clicking a footer
 * link — the one place a visitor is *always* scrolled to the bottom — landed
 * them partway down the next page with the header and hero off-screen.
 * Measured before this existed: /features at 7621px → /pricing still at 2947px.
 *
 * Behaviour:
 *   - PUSH/REPLACE  → top of the new page (or the `#hash` target if it exists).
 *   - POP (back/fwd) → the offset that entry was left at.
 *
 * The browser's own restoration cannot do the POP case here: it fires before
 * React has rendered the destination, so the page is still short and the offset
 * clamps to 0. Verified — Back landed at 0 instead of the 3000 it was left at.
 */
export function ScrollToTop() {
  const { pathname, hash, key } = useLocation();
  const navigationType = useNavigationType();

  // Record where this entry was left. The cleanup runs when `key` changes —
  // i.e. as we navigate away — so it captures the *outgoing* entry's offset.
  useIsomorphicLayoutEffect(() => {
    return () => {
      positions.set(key, currentOffset());
    };
  }, [key]);

  useIsomorphicLayoutEffect(() => {
    if (navigationType === "POP") {
      scrollTo(positions.get(key) ?? 0);
      return;
    }

    if (hash) {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) {
        target.scrollIntoView();
        return;
      }
      // Unknown anchor: fall through to the top rather than leaving the visitor
      // wherever the previous page happened to be.
    }

    scrollTo(0);
  }, [pathname, hash, key, navigationType]);

  return null;
}
