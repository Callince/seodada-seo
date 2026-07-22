import { ChevronDown } from "lucide-react";

import { DisplayHeading } from "@/components/public/display";
import type { ToolFaq, ToolSection } from "@/content/toolContent";

/**
 * The explanatory copy under a free tool.
 *
 * The tool itself is a handful of inputs; without this the page is ~1 KB of
 * text and has nothing to rank for. This content is lifted verbatim from the
 * seodada originals, so the pages keep the wording they already earned rankings
 * with rather than being rewritten from scratch.
 */
/** Stable anchor id so the contents rail can link to a heading. */
const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function ToolProse({ sections }: { sections: ToolSection[] }) {
  if (!sections.length) return null;

  const tops = sections.filter((s) => s.level === 2);

  return (
    <section className="border-t border-border bg-[var(--lp-tint)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-14">
        {/* Contents rail. Hidden below lg — on a phone it would just be a
            second copy of the headings the reader is about to scroll past. */}
        {tops.length > 1 && (
          <nav aria-label="On this page" className="hidden lg:block">
            <div className="sticky top-24">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                On this page
              </p>
              <ul className="mt-3 space-y-2 border-l border-border">
                {tops.map((s) => (
                  <li key={s.title}>
                    <a
                      href={`#${slug(s.title)}`}
                      className="-ml-px block border-l-2 border-transparent pl-3 text-sm leading-snug text-text-muted transition-colors hover:border-[color:var(--primary)] hover:text-text"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        )}

        <div className="min-w-0 space-y-6">
          {sections.map((s, i) => {
            // h2 opens a topic and gets its own card; h3/h4 are sub-points, so
            // they stay flush inside the flow with a rule instead of a box —
            // nesting boxes inside boxes reads as noise on a phone.
            if (s.level !== 2) {
              return (
                <div key={`${s.title}-${i}`} className="border-l-2 border-[color:var(--primary)] pl-4 sm:pl-5">
                  <h3 className="text-lg font-semibold text-text">{s.title}</h3>
                  {s.paras.map((p, j) => (
                    <p key={j} className="mt-2 leading-relaxed text-text-muted">{p}</p>
                  ))}
                </div>
              );
            }

            const n = tops.indexOf(s) + 1;
            return (
              <article
                key={`${s.title}-${i}`}
                id={slug(s.title)}
                className="scroll-mt-24 rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8"
              >
                <div className="flex items-baseline gap-3">
                  <span
                    aria-hidden
                    className="font-mono text-sm font-semibold tabular-nums text-primary-ink"
                  >
                    {String(n).padStart(2, "0")}
                  </span>
                  {/* Deliberately NOT the uppercase DisplayHeading treatment:
                      these titles are full sentences ("Why real-time content
                      analysis is important for SEO"), and setting a sentence in
                      caps costs real readability. The weight matches the new
                      display voice; the casing stays sentence. */}
                  <h2 className="text-2xl font-black tracking-tight text-text sm:text-3xl">
                    {s.title}
                  </h2>
                </div>
                {s.paras.map((p, j) => (
                  <p
                    key={j}
                    /* The opening paragraph carries the section's point, so it
                       gets lead sizing; the rest settle back to body. */
                    className={
                      j === 0
                        ? "mt-4 text-[17px] leading-relaxed text-text"
                        : "mt-4 leading-relaxed text-text-muted"
                    }
                  >
                    {p}
                  </p>
                ))}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/**
 * FAQ list.
 *
 * `<details>`/`<summary>` rather than a button + state: it is open/closed by
 * the browser, keyboard-operable and findable by in-page search (Ctrl+F opens
 * a matching section) with no JavaScript at all — which also means it renders
 * fully in the prerendered HTML.
 */
export function ToolFaqs({ faqs, subtitle }: { faqs: ToolFaq[]; subtitle?: string }) {
  if (!faqs.length) return null;
  return (
    // Same 6xl grid as ToolProse so the two blocks read as one column of
    // content rather than two differently-sized slabs.
    <section className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-14">
      <div className="lg:pt-1">
        <DisplayHeading>Frequently asked questions</DisplayHeading>
        {subtitle && <p className="mt-2 text-sm text-text-muted">{subtitle}</p>}
      </div>

      <div className="min-w-0 space-y-3">
        {faqs.map((f) => (
          <details
            key={f.q}
            className="group rounded-xl border border-border bg-surface transition-colors open:border-[color:var(--primary)]/40 open:shadow-sm hover:border-[color:var(--primary)]/40"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-semibold text-text marker:content-['']">
              {f.q}
              <ChevronDown
                size={16}
                className="shrink-0 text-text-muted transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <p className="border-t border-border px-4 py-4 text-sm leading-relaxed text-text-muted">
              {f.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
