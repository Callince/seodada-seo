import { createContext, useContext, type ReactNode } from "react";

import { cn } from "@/lib/cn";

const TabsCtx = createContext<{ value: string; onChange: (v: string) => void } | null>(null);

export function Tabs({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return <TabsCtx.Provider value={{ value, onChange }}>{children}</TabsCtx.Provider>;
}

export function TabsList({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-surface-2 p-1" role="tablist">
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useContext(TabsCtx)!;
  const active = ctx.value === value;
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={() => ctx.onChange(value)}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-surface text-primary shadow-sm"
          : "text-text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useContext(TabsCtx)!;
  if (ctx.value !== value) return null;
  return <div role="tabpanel">{children}</div>;
}
