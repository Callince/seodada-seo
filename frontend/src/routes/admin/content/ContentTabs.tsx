import { NavLink } from "react-router-dom";

import { cn } from "@/lib/cn";

const TABS = [
  { to: "/admin/content/blog-categories", label: "Blog categories" },
  { to: "/admin/content/blogs", label: "Blogs" },
  { to: "/admin/content/story-categories", label: "Story categories" },
  { to: "/admin/content/stories", label: "Stories" },
];

/** Tab row shared by the four admin content list pages. */
export function ContentTabs() {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-surface-2 p-1">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-surface text-[color:var(--section-ink)] shadow-sm"
                : "text-text-muted hover:text-text",
            )
          }
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}
