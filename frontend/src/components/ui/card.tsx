import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/**
 * Aperture card (DESIGN_SYSTEM §6.3) — stratum z1.
 *
 * Deliberately SOLID, not glass. Per the glass-discipline rule (§4), frosting
 * is reserved for chrome that floats over moving content (sidebar, topbar
 * menus, modals) because `backdrop-filter` repaints everything beneath it — a
 * 200-row table behind glass drops frames. Data surfaces stay opaque and fast.
 * Pass `className="glass-card"` on the rare card that genuinely floats.
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // `shadow-[shadow:…]` type hint is required: given a bare
        // `shadow-[var(--x)]` Tailwind guesses *color* and emits
        // --tw-shadow-color, so the elevation silently disappears.
        "rounded-xl border border-border bg-surface shadow-[shadow:var(--lift-1)]",
        "transition-shadow duration-[var(--dur-2)] ease-[var(--ease)]",
        // `clip` rather than `hidden` so descendant focus rings stay visible.
        "[overflow:clip]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-start gap-3 border-b border-border px-5 py-4", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-base font-semibold tracking-[-0.01em] text-text", className)}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
