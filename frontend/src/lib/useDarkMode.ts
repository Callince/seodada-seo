import { useEffect, useState } from "react";

/**
 * The single theme switch for the app.
 *
 * Deliberately shared rather than reimplemented per surface: the
 * `.theme-switching` suppression below is easy to omit, and omitting it is
 * silent — an element transitioning a token-driven property (color,
 * background) does NOT settle when the custom property changes underneath it.
 * It freezes on its OLD computed value, so a dark-mode nav item keeps painting
 * the light colour at ~2.8:1 while the token itself reads correctly. A second
 * copy of this hook without the guard is exactly how that bug came back.
 */
export function useDarkMode() {
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("theme-switching");
    root.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => root.classList.remove("theme-switching")),
    );
    return () => cancelAnimationFrame(id);
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}
