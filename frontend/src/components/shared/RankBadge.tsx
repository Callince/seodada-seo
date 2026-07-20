/**
 * Rank rendered as light (DESIGN_SYSTEM §1.2, §6.5).
 *
 * A SERP position is a visibility measurement, so it maps onto the Signal
 * Spectrum: #1 glows, #90 is nearly dark. The reader takes in "how visible is
 * this" from the brightness before parsing the digits.
 *
 * Two channels, deliberately different:
 *  - the FILL uses the full L 0.30–0.88 range, so the brightness signal is
 *    actually visible;
 *  - the NUMERAL uses a compressed L 0.30–0.45 cut, because at full range a
 *    high-visibility value lands ~3.9:1 and fails the 4.5:1 floor for small
 *    text (§1.3).
 * The position is always printed, so nothing is encoded by color alone.
 */

/** 0 (buried) → 1 (peak). Position 1 = 1.0, position 100+ = 0. */
export function visibility(position: number | null | undefined): number {
  if (position == null || position <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - (position - 1) / 99));
}

const hue = (v: number) => 268 - 78 * v;

/** Full-range spectrum color — fills and bars only. */
export const signalFill = (v: number) => `oklch(${(0.3 + 0.58 * v).toFixed(3)} 0.13 ${hue(v).toFixed(1)})`;

/**
 * Text-safe spectrum cut, as inline style props for the `.signal-ink` class.
 *
 * NOT a colour string: the readable lightness band inverts per theme (dark ink
 * on light, bright ink on dark), and a JS helper cannot see the theme. The
 * band lives in CSS (`--signal-ink-l0/-lr`, flipped under `.dark`) and this
 * only supplies `--v`. The previous string form was light-only and rendered
 * dark-mode rank numerals at ~1.05:1.
 */
export const signalInkVars = (v: number) => ({ ["--v" as string]: v.toFixed(3) });

export function RankBadge({
  position,
  className = "",
}: {
  position: number | null | undefined;
  className?: string;
}) {
  if (position == null) {
    return (
      <span className={`inline-flex h-5 min-w-7 items-center justify-center rounded bg-surface-2 px-1 font-mono text-xs text-text-muted ${className}`}>
        —
      </span>
    );
  }
  const v = visibility(position);
  return (
    <span
      className={`signal-ink inline-flex h-5 min-w-7 items-center justify-center rounded px-1 font-mono text-xs font-semibold tabular-nums ${className}`}
      style={{
        ...signalInkVars(v),
        // Alpha is CONSTANT at 38%. An earlier version ramped opacity with
        // visibility, which broke monotonicity: as the color darkened the tint
        // also thinned, and below ~#60 the thinning won, so #100 rendered
        // *lighter* than #60 and the signal reversed. Holding alpha fixed lets
        // the spectrum's own lightness drive the tint. 38% measured as the best
        // trade-off — luminance spread 0.45 with 5.56:1 minimum text contrast.
        background: `color-mix(in srgb, ${signalFill(v)} 38%, transparent)`,
        // colour comes from `.signal-ink` + --v, so it flips per theme
      }}
    >
      {position}
    </span>
  );
}
