/** Ahrefs-DR-style circular authority score (0-100), colored by tier. */
export function AuthorityBadge({
  score,
  label = "Authority",
  size = 96,
}: {
  score: number | null | undefined;
  label?: string;
  size?: number;
}) {
  const value = score ?? null;
  const color =
    value == null
      ? "var(--text-muted)"
      : value >= 60
        ? "var(--primary)"
        : value >= 30
          ? "var(--warning)"
          : "var(--danger)";
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const filled = value == null ? 0 : (value / 100) * c;

  return (
    <div className="inline-flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={7} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${c - filled}`}
            className="transition-[stroke-dasharray] duration-500"
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center font-mono text-2xl font-semibold"
          style={{ color }}
        >
          {value == null ? "—" : value}
        </span>
      </div>
      <span className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</span>
    </div>
  );
}
