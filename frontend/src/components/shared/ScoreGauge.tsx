import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";

/**
 * Health is a QUALITY judgement, so it uses state colors — not the Signal
 * Spectrum (DESIGN_SYSTEM §1.2). A score of 30 means "bad", not "dim"; the
 * spectrum's brightness ramp would strip the alarm out of a failing audit.
 * Tokens rather than hex so both themes track automatically.
 */
function toneColor(score: number): string {
  if (score < 40) return "var(--danger)";
  if (score < 70) return "var(--warning)";
  return "var(--success)";
}

/** Same ramp, text-safe. The arc is a FILL and can be vivid; the numeral is
 *  text and cannot — amber on white measured 2.36:1, under the 3:1 large-text
 *  bar. Splitting them keeps the gauge legible without dulling the arc. */
function toneInk(score: number): string {
  if (score < 40) return "var(--danger-ink)";
  if (score < 70) return "var(--warning-ink)";
  return "var(--success-ink)";
}

interface ScoreGaugeProps {
  score: number | null;
  label?: string;
  size?: number;
  max?: number;
  /** Shown under the label when score is null (e.g. why no score exists). */
  emptyHint?: string;
}

export function ScoreGauge({ score, label, size = 160, max = 100, emptyHint }: ScoreGaugeProps) {
  const isEmpty = score == null;
  const value = score ?? 0;
  // Neutral grey when there's no score, so an empty gauge never reads as "bad".
  const color = isEmpty ? "var(--text-muted)" : toneColor((value / max) * 100);
  const data = [{ name: "score", value: isEmpty ? 0 : value }];

  return (
    <div
      className="relative inline-flex flex-col items-center"
      style={{ width: size }}
      role="img"
      aria-label={`${label || "Score"}: ${isEmpty ? "not available" : Math.round(value)} of ${max}`}
    >
      <ResponsiveContainer width={size} height={size}>
        <RadialBarChart
          innerRadius="72%"
          outerRadius="100%"
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, max]} tick={false} />
          <RadialBar dataKey="value" cornerRadius={999} fill={color} background={{ fill: "var(--surface-2)" }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
        <span
          className={isEmpty ? "font-mono text-xl font-semibold" : "font-mono text-3xl font-semibold"}
          style={{ color: isEmpty ? "var(--text-muted)" : toneInk((value / max) * 100) }}
        >
          {isEmpty ? "N/A" : Math.round(value)}
        </span>
        {label && <span className="text-xs text-text-muted">{label}</span>}
        {isEmpty && emptyHint && (
          <span className="mt-1 text-[10px] leading-tight text-text-muted">{emptyHint}</span>
        )}
      </div>
    </div>
  );
}
