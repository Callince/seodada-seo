import { AlertTriangle, ChevronRight, SearchX, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { NAV_ITEMS } from "@/lib/nav";

export interface Crumb {
  label: string;
  to?: string;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <SearchX className="text-text-muted" size={40} />
      <p className="text-sm font-medium text-text">{title}</p>
      {hint && <p className="max-w-sm text-sm text-text-muted">{hint}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <AlertTriangle className="text-danger" size={40} />
      <p className="max-w-md text-sm text-text">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  icon,
  actions,
}: {
  title: string;
  subtitle?: string;
  breadcrumbs?: Crumb[];
  /** Defaults to the current module's nav icon when omitted. */
  icon?: LucideIcon;
  actions?: ReactNode;
}) {
  const { pathname } = useLocation();
  const navItem = NAV_ITEMS.find((n) =>
    n.end ? pathname === n.to : n.to !== "/" && pathname.startsWith(n.to),
  );
  const Icon = icon ?? navItem?.icon;

  return (
    <div className="mb-5 border-b border-border pb-4">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-2 flex items-center gap-1 text-xs text-text-muted">
          {breadcrumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={12} className="text-text-muted/60" />}
              {c.to ? (
                <Link to={c.to} className="hover:text-text">
                  {c.label}
                </Link>
              ) : (
                <span className="text-text">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Icon size={20} />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-text">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

export function Section({ children }: { children: ReactNode }) {
  return <div className="animate-fade-rise space-y-5">{children}</div>;
}
