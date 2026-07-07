import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

export interface Metric {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "danger" | "warning" | "success";
}

const TONE: Record<NonNullable<Metric["tone"]>, string> = {
  default: "text-text",
  danger: "text-danger",
  warning: "text-warning",
  success: "text-primary",
};

/** Ahrefs-style horizontal metric strip — big numbers separated by dividers. */
export function MetricBar({ metrics, className }: { metrics: Metric[]; className?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="grid grid-cols-2 divide-y divide-border sm:grid-cols-3 sm:divide-y-0 lg:flex lg:divide-x">
        {metrics.map((m) => (
          <div key={m.label} className="flex-1 px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{m.label}</p>
            <p className={cn("mt-1 font-mono text-2xl", TONE[m.tone ?? "default"])}>{m.value}</p>
            {m.sub && <p className="mt-0.5 text-xs text-text-muted">{m.sub}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}
