import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/cn";

interface StatCardProps {
  label: string;
  value: string;
  accent?: boolean;
  /** Render the value in JetBrains Mono (default true — metrics line up). */
  mono?: boolean;
  sub?: string;
  /** Extra classes for the tile (e.g. bento col-span / hover lift). */
  className?: string;
}

/** The metric tile reused across Dashboard, On-Page, Site Report, etc. */
export function StatCard({ label, value, accent, mono = true, sub, className }: StatCardProps) {
  return (
    <Card className={cn("h-full transition-all duration-300 hover:-translate-y-0.5 hover:lp-shadow-lg", className)}>
      <CardBody className="flex h-full flex-col justify-center">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: "var(--section)" }} />
          {label}
        </p>
        <p
          className={cn("mt-1 text-2xl font-extrabold tracking-tight", mono && "font-mono", !accent && "text-text")}
          style={accent ? { color: "var(--section)" } : undefined}
        >
          {value}
        </p>
        {sub && <p className="mt-0.5 text-xs text-text-muted">{sub}</p>}
      </CardBody>
    </Card>
  );
}
