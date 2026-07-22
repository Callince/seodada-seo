/**
 * Display typography for the public pages.
 *
 * One place for the oversized-uppercase treatment so a page never hand-rolls
 * the class string: the sizes, weight and negative tracking have to stay
 * identical across sections or the rhythm breaks where two pages meet.
 */

/**
 * Oversized outline numeral used to open a numbered section.
 *
 * Filled with `--surface-2` *and* stroked, rather than stroked over
 * transparent: `-webkit-text-stroke` is unsupported outside WebKit/Blink, and a
 * transparent fill would render the numeral invisible there instead of merely
 * unstyled.
 *
 * The stroke is `--text-muted`, not `--border`: border sits at ~1.2:1 against
 * the page in both themes, which measured as an invisible numeral rather than a
 * subtle one. Decorative and aria-hidden, so it carries no AA obligation — but
 * it still has to be seen to do its job.
 */
export function GroupNumeral({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="select-none font-black leading-none tracking-tighter text-[color:var(--surface-2)] [-webkit-text-stroke:2px_var(--text-muted)] text-6xl sm:text-8xl"
    >
      {n}
    </span>
  );
}

/** Section headline. `size="lg"` opens a major block, `md` a sub-section. */
export function DisplayHeading({
  children,
  size = "md",
  className = "",
}: {
  children: React.ReactNode;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <h2
      className={`text-balance font-black uppercase leading-[0.95] tracking-tight text-text ${
        size === "lg" ? "text-4xl sm:text-6xl" : "text-3xl sm:text-5xl"
      } ${className}`}
    >
      {children}
    </h2>
  );
}

/** Small caps label that sits above a DisplayHeading. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-ink">
      {children}
    </p>
  );
}
