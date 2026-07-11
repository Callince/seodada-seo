import type { CSSProperties } from "react";

/**
 * Per-module accent system. Each module has its own hue (CSS vars
 * `--sec-<id>` / `--sec-<id>-soft` in index.css, themed light + dark). The
 * shell binds the active module's accent to `--section`, which every shared
 * component inherits — so a page's whole UI keys to its module color.
 */
export type ModuleId =
  | "overview"
  | "keywords"
  | "serp"
  | "domains"
  | "competitors"
  | "local"
  | "audit"
  | "onpage"
  | "content"
  | "report"
  | "rank"
  | "backlinks"
  | "aivis"
  | "schedules"
  | "manage"
  | "tools"
  | "admin";

/**
 * Route prefix → accent id (longest prefix wins). Each route takes its
 * workflow-group color so pages match the sidebar + dashboard stepper:
 * Research→purple, Audit→red, Optimize→violet, Track→green, Manage→slate.
 */
const ROUTE_MODULE: [string, ModuleId][] = [
  ["/dashboard", "overview"],
  ["/workspace", "overview"],
  // Research
  ["/keywords", "keywords"],
  ["/serp", "keywords"],
  ["/domains", "keywords"],
  ["/competitors", "keywords"],
  ["/local", "keywords"],
  // Audit
  ["/audit", "audit"],
  ["/onpage", "audit"],
  // Optimize
  ["/content", "content"],
  ["/report", "content"],
  // Track
  ["/rank", "rank"],
  ["/backlinks", "rank"],
  ["/ai-visibility", "rank"],
  ["/schedules", "rank"],
  // Manage
  ["/projects", "manage"],
  ["/billing", "manage"],
  // Free tools
  ["/tools", "tools"],
  ["/admin", "admin"],
];

/** The module a path belongs to (defaults to overview). */
export function moduleForPath(pathname: string): ModuleId {
  const hit = ROUTE_MODULE.filter(
    ([p]) => pathname === p || pathname.startsWith(p + "/"),
  ).sort((a, b) => b[0].length - a[0].length)[0];
  return hit ? hit[1] : "overview";
}

/**
 * Sidebar workflow group → its accent, matching the dashboard stepper colors
 * (one color per group, so the nav stays to a handful of hues, not one per
 * module). Research=purple, Audit=red, Optimize=violet, Track=green, Manage=slate.
 */
const SECTION_MODULE: Record<string, ModuleId> = {
  Overview: "overview",
  "1 · Research": "keywords",
  "2 · Audit": "audit",
  "3 · Optimize": "content",
  "4 · Track": "rank",
  "5 · Manage": "manage",
  "Free tools": "tools",
};

export function moduleForSection(name?: string): ModuleId {
  return (name && SECTION_MODULE[name]) || "overview";
}

/** Inline style that binds `--section`/`--section-soft` to a module's accent. */
export function sectionVars(id: ModuleId): CSSProperties {
  return {
    ["--section" as string]: `var(--sec-${id})`,
    ["--section-soft" as string]: `var(--sec-${id}-soft)`,
  } as CSSProperties;
}
