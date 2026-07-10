import { useCallback, useState } from "react";

/**
 * Route components unmount on navigation, so their `useState` (inputs, results,
 * active tab…) is lost — coming back shows a blank page. `usePersistedState`
 * keeps the value in a module-level store that survives unmount/remount within
 * the SPA session, so a page looks exactly as you left it. It resets on a full
 * page reload (which is the expected "start fresh" gesture).
 *
 * Use a stable, page-scoped key, e.g. `usePersistedState("onpage.url", "")`.
 */
const store = new Map<string, unknown>();

export function usePersistedState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => (store.has(key) ? (store.get(key) as T) : initial));

  const set = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next = typeof value === "function" ? (value as (p: T) => T)(prev) : value;
        store.set(key, next);
        return next;
      });
    },
    [key],
  );

  return [state, set] as const;
}

/** Imperatively stash/read a value (e.g. a mutation result) in the same store. */
export function rememberValue<T>(key: string, value: T): void {
  store.set(key, value);
}
export function recallValue<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}
