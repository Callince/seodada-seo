import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/**
 * Aperture input (DESIGN_SYSTEM §6.2).
 *
 * The signature behaviour: the field sits INSET (surface-2) at rest and rises
 * to the top surface on focus, so engaging it feels physical — the control
 * comes toward you rather than just outlining itself.
 */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-md border border-border bg-surface-2 px-3.5",
        "text-sm text-text placeholder:text-text-muted",
        "transition-[background,border-color,box-shadow] duration-[var(--dur-1)] ease-[var(--ease-soft)]",
        "focus-visible:outline-none focus-visible:bg-surface",
        "focus-visible:border-[color:var(--section)]",
        "focus-visible:shadow-[0_0_0_3px_var(--section-glow)]",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
