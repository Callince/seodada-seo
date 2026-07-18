export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</p>
      {items.filter(Boolean).length ? <div className="rounded-lg border border-border">{children}</div> : <p className="text-text-muted">None.</p>}
    </div>
  );
}

export function Line({ left, mid, right }: { left: React.ReactNode; mid: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2 last:border-0">
      <span className="min-w-0 flex-1 truncate text-text">{left}</span>
      <span className="text-text-muted">{mid}</span>
      <span className="shrink-0 text-xs text-text-muted">{right}</span>
    </div>
  );
}
