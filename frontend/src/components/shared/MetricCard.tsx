import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

import { AreaChart, type Tone } from "@/components/public/landingKit";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/cn";

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  /** Trend chip, e.g. "+34.8%". Colored green (up) / red (down). */
  delta?: string;
  deltaUp?: boolean;
  /** Sparkline series — renders a small area chart under the value. */
  series?: number[];
  sparkId?: string;
  tone?: Tone;
  /** Fallback line shown when there is no series. */
  sub?: string;
  className?: string;
}

/**
 * Premium KPI tile: a module-accent icon chip, big count value, an optional
 * up/down trend chip, and a sparkline. Shared across Dashboard, Site Report,
 * and any analytics surface.
 */
export function MetricCard({
  icon: Icon,
  label,
  value,
  delta,
  deltaUp = true,
  series,
  sparkId,
  tone = "blue",
  sub,
  className,
}: MetricCardProps) {
  const hasSeries = !!series && series.length > 1;
  return (
    <Card className={cn("lp-card min-h-[150px]", className)}>
      <CardBody className="flex h-full flex-col gap-3">
        <div className="flex items-start justify-between">
          <span className="section-gradient grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white shadow-glow">
            <Icon size={18} />
          </span>
          {delta && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
                deltaUp ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
              )}
            >
              {deltaUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {delta}
            </span>
          )}
        </div>
        <div className="mt-auto">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
          <p className="mt-0.5 truncate font-mono text-2xl font-extrabold tracking-tight text-text">{value}</p>
        </div>
        {hasSeries ? (
          <div className="h-10">
            <AreaChart values={series!} id={sparkId ?? label} height={40} tone={tone} />
          </div>
        ) : sub ? (
          <p className="text-[11px] text-text-muted">{sub}</p>
        ) : null}
      </CardBody>
    </Card>
  );
}
