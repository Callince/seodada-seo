import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      // 12px labels on a 15% tint => small text, so every tone uses the
      // text-safe `-ink` variant. The base state colours sit at the accent
      // lightness band and land ~3.3:1 here (DESIGN_SYSTEM §1.3).
      tone: {
        neutral: "bg-surface-2 text-text-muted",
        primary: "bg-primary-soft text-primary-ink",
        success: "bg-success/15 text-success-ink",
        warning: "bg-warning/15 text-warning-ink",
        danger: "bg-danger/15 text-danger-ink",
        info: "bg-info/15 text-[color:var(--signal-1)]",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
