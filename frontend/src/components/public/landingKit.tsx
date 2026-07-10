import { animate, motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

// (motion + chart kit — in-view detection is fail-safe; see useSafeInView)

/* ============================================================================
   Motion + chart kit for the premium landing. Framer Motion (already a project
   dependency) drives reveals / magnetism / counters; charts are hand-built
   inline SVG so the public page stays light (no chart-lib weight, GPU-friendly).
   ========================================================================== */

const EASE = [0.2, 0.7, 0.2, 1] as const;

/**
 * In-view detector that never leaves content stuck hidden: checks position on
 * mount, uses IntersectionObserver when available, falls back to a scroll
 * listener, and has a safety timer. More robust than a bare observer (which can
 * silently never fire in some embedded/headless renderers).
 */
function useSafeInView(ref: React.RefObject<HTMLElement | null>) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const visible = () => {
      const r = el.getBoundingClientRect();
      return r.top < (window.innerHeight || 0) * 0.9 && r.bottom > 0;
    };
    if (visible()) {
      setInView(true);
      return;
    }
    let io: IntersectionObserver | undefined;
    let timer = 0;
    const onScroll = () => visible() && done();
    const cleanup = () => {
      io?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
    };
    const done = () => {
      setInView(true);
      cleanup();
    };
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(([e]) => e.isIntersecting && done(), { threshold: 0.12 });
      io.observe(el);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    timer = window.setTimeout(() => setInView(true), 2500); // failsafe
    return cleanup;
  }, [ref]);
  return inView;
}

/** Fade + rise into view once. The observed node is a plain wrapper (reliable
 *  ref); the inner motion.div does the animation. */
export function Reveal({
  children,
  className = "",
  y = 26,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useSafeInView(ref);
  return (
    <div ref={ref} className={className}>
      <motion.div
        className="h-full"
        initial={{ opacity: 0, y }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
        transition={{ duration: 0.65, delay, ease: EASE }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/** Magnetic hover — child drifts toward the cursor with spring physics. */
export function Magnetic({
  children,
  className = "",
  strength = 0.3,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 16 });
  const sy = useSpring(y, { stiffness: 220, damping: 16 });
  return (
    <motion.span
      style={{ x: sx, y: sy, display: "inline-block" }}
      className={className}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.span>
  );
}

/** Counts up from 0 → `to` when scrolled into view. */
export function CountUp({
  to,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1.7,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useSafeInView(ref);
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, {
      duration,
      ease: EASE,
      onUpdate: (v) => setVal(v),
    });
    // Failsafe: if the ticker is throttled (background tab), still settle.
    const settle = window.setTimeout(() => setVal(to), duration * 1000 + 400);
    return () => {
      controls.stop();
      window.clearTimeout(settle);
    };
  }, [inView, to, duration]);
  return (
    <span ref={ref}>
      {prefix}
      {val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/** Deterministic floating particles (no Math.random → SSR/hydration-safe). */
export function Particles({ count = 16, className = "" }: { count?: number; className?: string }) {
  const dots = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        left: `${(i * 37 + 7) % 100}%`,
        top: `${(i * 53 + 11) % 100}%`,
        size: 2 + (i % 3),
        delay: `${(i % 7) * 0.9}s`,
        dur: `${11 + (i % 6) * 2}s`,
      })),
    [count],
  );
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 ${className}`}>
      {dots.map((d, i) => (
        <span
          key={i}
          className="lp-particle absolute rounded-full bg-primary/40"
          style={{
            left: d.left,
            top: d.top,
            width: d.size,
            height: d.size,
            animationDelay: d.delay,
            animationDuration: d.dur,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Image slot with a graceful fallback. Renders `src`, but if the file is
 * missing (404) or fails to load it shows `fallback` (e.g. the existing SVG
 * mockup or initials). Lets us wire real images into the landing without ever
 * showing a broken image before the assets exist. Always lazy + async.
 */
export function LandingImage({
  src,
  alt,
  className = "",
  fallback = null,
}: {
  src: string;
  alt: string;
  className?: string;
  fallback?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

/* ------------------------------- SVG charts ------------------------------- */

function smoothPath(values: number[], w: number, h: number) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const nx = (i: number) => (i / (values.length - 1)) * w;
  const ny = (v: number) => h - ((v - min) / span) * (h * 0.8) - h * 0.1;
  let line = `M0,${ny(values[0]).toFixed(1)}`;
  for (let i = 1; i < values.length; i++) {
    const x0 = nx(i - 1);
    const x1 = nx(i);
    const y0 = ny(values[i - 1]);
    const y1 = ny(values[i]);
    const cx = (x0 + x1) / 2;
    line += ` C${cx.toFixed(1)},${y0.toFixed(1)} ${cx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return { line, area: `${line} L${w},${h} L0,${h} Z` };
}

/** Harmonious chart tones — every graph can have its own colour that still
 *  suits the UI. All sit in the cool blue→violet brand family plus a couple of
 *  fresh accents. Each entry is [light, deep]. */
export const TONES = {
  blue: ["#1d7dbd", "#2e3f87"],
  cyan: ["#06b6d4", "#0e7490"],
  violet: ["#8b5cf6", "#6d28d9"],
  indigo: ["#6366f1", "#4338ca"],
  emerald: ["#10b981", "#047857"],
  teal: ["#14b8a6", "#0f766e"],
  sky: ["#38bdf8", "#0369a1"],
  amber: ["#f59e0b", "#b45309"],
} as const;
export type Tone = keyof typeof TONES;

/** Gradient area chart with an animated draw-on line. */
export function AreaChart({
  values,
  height = 120,
  id = "lp",
  tone = "blue",
}: {
  values: number[];
  height?: number;
  id?: string;
  tone?: Tone;
}) {
  const w = 320;
  const { line, area } = smoothPath(values, w, height);
  const [c1, c2] = TONES[tone] ?? TONES.blue;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-full w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c1} stopOpacity="0.38" />
          <stop offset="100%" stopColor={c2} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-line`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={c2} />
          <stop offset="100%" stopColor={c1} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id}-area)`} />
      <path
        d={line}
        fill="none"
        stroke={`url(#${id}-line)`}
        strokeWidth="2.5"
        strokeLinecap="round"
        className="lp-draw"
      />
    </svg>
  );
}

/** Vertical bar chart that grows on mount. */
export function Bars({ values, className = "", tone = "blue" }: { values: number[]; className?: string; tone?: Tone }) {
  const max = Math.max(...values);
  const [c1, c2] = TONES[tone] ?? TONES.blue;
  return (
    <div className={`flex items-end gap-1.5 ${className}`} aria-hidden>
      {values.map((v, i) => (
        <div
          key={i}
          className="lp-bar flex-1 rounded-t-md"
          style={{
            height: `${(v / max) * 100}%`,
            background: `linear-gradient(180deg, ${c1}, ${c2})`,
            animationDelay: `${i * 60}ms`,
            opacity: 0.55 + (v / max) * 0.45,
          }}
        />
      ))}
    </div>
  );
}

/** Circular score ring (0–100) with the value in the middle. */
export function ScoreRing({
  value,
  size = 96,
  label,
  tone = "blue",
}: {
  value: number;
  size?: number;
  label?: string;
  tone?: Tone;
}) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const wrap = useRef<HTMLDivElement>(null);
  const inView = useSafeInView(wrap);
  const gid = useId(); // unique so rings of different tones don't collide
  const [c1, c2] = TONES[tone] ?? TONES.blue;
  return (
    <div ref={wrap} className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: inView ? c - (value / 100) * c : c }}
          transition={{ duration: 1.4, ease: EASE }}
        />
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c2} />
            <stop offset="100%" stopColor={c1} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute text-center">
        <div className="text-xl font-extrabold text-text">
          <CountUp to={value} />
        </div>
        {label && <div className="text-[10px] text-text-muted">{label}</div>}
      </div>
    </div>
  );
}
