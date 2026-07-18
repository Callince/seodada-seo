import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/**
 * Aperture button (DESIGN_SYSTEM §6.1).
 *
 * Primary is a *lit surface*, not a flat fill: a subtle top-to-bottom lightening
 * of the section accent plus an inset highlight, so it reads as catching light
 * rather than as a colored rectangle. Press depresses it 1px.
 */
export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-md",
    "text-sm font-semibold tracking-[-0.01em]",
    "transition-[background,box-shadow,transform,color] duration-[var(--dur-1)] ease-[var(--ease)]",
    "active:translate-y-px active:scale-[.99]",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
    "disabled:opacity-50 disabled:pointer-events-none",
  ].join(" "),
  {
    variants: {
      variant: {
        // primary + outline follow the active page's section accent
        // (--section defaults to the brand primary outside the app shell).
        primary: [
          "text-white",
          "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--section)_82%,white),var(--section))]",
          // `shadow-[shadow:…]` type hint required — a bare `shadow-[var(--x)]`
          // is read as a shadow *color* and the elevation vanishes silently.
          "shadow-[shadow:var(--lift-1),inset_0_1px_0_rgb(255_255_255/.22)]",
          "hover:shadow-[shadow:var(--lift-2),0_0_0_1px_var(--section-glow),inset_0_1px_0_rgb(255_255_255/.28)]",
        ].join(" "),
        secondary:
          "border border-border bg-surface text-text hover:bg-surface-2 hover:border-[color:var(--section)]",
        outline:
          "border border-[color:var(--section)] text-[color:var(--section-ink)] hover:bg-[color:var(--section-soft)]",
        ghost:
          "text-text-muted hover:bg-[color:var(--section-soft)] hover:text-[color:var(--section-ink)]",
        danger: "bg-danger text-white shadow-[shadow:var(--lift-1)] hover:brightness-110",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  /** Cost/quota line rendered beside the label — see the cost-honesty rule in
   *  UI_DESIGN_PROMPTS §2 ("Cached · free", "1 of 10 today"). */
  meta?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, meta, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden />}
      {children}
      {meta && <span className="text-[11px] font-medium opacity-75">{meta}</span>}
    </button>
  ),
);
Button.displayName = "Button";
