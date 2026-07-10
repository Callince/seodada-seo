import type { CSSProperties } from "react";

import { NAV_ITEMS } from "@/lib/nav";

/**
 * Workflow sections, each with its own accent color. The actual color values
 * live as CSS variables in index.css (`--sec-<id>` / `--sec-<id>-soft`, themed
 * for light + dark). This module only maps routes → section id so the shell can
 * set the active `--section` accent, which every shared component inherits.
 */
export type SectionId =
  | "overview"
  | "research"
  | "audit"
  | "optimize"
  | "track"
  | "manage"
  | "tools";

/** Sidebar section label → stable id used for the accent CSS var. */
const NAME_TO_ID: Record<string, SectionId> = {
  Overview: "overview",
  "1 · Research": "research",
  "2 · Audit": "audit",
  "3 · Optimize": "optimize",
  "4 · Track": "track",
  "5 · Manage": "manage",
  "Free tools": "tools",
};

export function sectionIdForName(name?: string): SectionId {
  return (name && NAME_TO_ID[name]) || "overview";
}

/** Longest-matching nav item for a path → its section id (defaults to overview). */
export function sectionIdForPath(pathname: string): SectionId {
  const item = NAV_ITEMS.filter((n) =>
    n.end ? pathname === n.to : n.to !== "/" && pathname.startsWith(n.to),
  ).sort((a, b) => b.to.length - a.to.length)[0];
  return sectionIdForName(item?.section);
}

/** Inline style that binds `--section`/`--section-soft` to a section's accent. */
export function sectionVars(id: SectionId): CSSProperties {
  return {
    ["--section" as string]: `var(--sec-${id})`,
    ["--section-soft" as string]: `var(--sec-${id}-soft)`,
  } as CSSProperties;
}
