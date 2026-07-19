import { Quote, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { Reveal } from "@/components/public/landingKit";

/** Share of AI answers that cite you, per engine. 0–1. */
const ENGINES = [
  { name: "Google AI Overview", you: 0.42, rival: 0.71 },
  { name: "ChatGPT", you: 0.28, rival: 0.64 },
  { name: "Perplexity", you: 0.55, rival: 0.49 },
  { name: "Copilot", you: 0.17, rival: 0.58 },
];

/** Map a 0–1 visibility value onto the Signal Spectrum (DESIGN_SYSTEM §1.2).
 *  Brightness IS the metric — a dim bar reads as "buried" before it's read.
 *  Full L range 0.30–0.88; for FILLS and bars only (UI components, 3:1). */
const signal = (v: number) =>
  `oklch(${(0.3 + 0.58 * v).toFixed(3)} 0.13 ${(268 - 78 * v).toFixed(1)})`;

/** Text-safe cut of the same ramp for the numeral beside each bar.
 *  Compressed to L 0.30–0.45 so every value clears 4.5:1 on white — at full
 *  range a 55% score lands at L=0.62 (~3.9:1) and fails as small text. The
 *  bar still carries the full-brightness signal; the label just has to be
 *  readable (DESIGN_SYSTEM §1.3). */
const signalInk = (v: number) =>
  `oklch(${(0.3 + 0.15 * v).toFixed(3)} 0.13 ${(268 - 78 * v).toFixed(1)})`;

/**
 * The differentiator block (UI_DESIGN_PROMPTS §8, item 5).
 *
 * Classic rank tracking answers "where am I on the page?". This answers
 * "am I in the answer at all?" — which is the question the whole category is
 * moving toward and the one competitors don't cover.
 */
export function AiVisibility() {
  return (
    <section className="relative overflow-hidden border-t border-border py-20 sm:py-28">
      {/* Aurora wash, keyed to the AI-visibility module accent. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          background:
            "radial-gradient(60% 50% at 75% 20%, var(--sec-aivis), transparent 70%), radial-gradient(50% 40% at 15% 80%, var(--signal-3), transparent 70%)",
        }}
      />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
        {/* ---------------------------------------------------- copy */}
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--sec-aivis-ink)]">
            <Sparkles size={13} aria-hidden /> GEO &amp; AEO
          </span>
          <h2 className="mt-5 text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">
            Ranking #1 means nothing
            <span className="gradient-text"> if the answer never cites you.</span>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-text-muted">
            More searches now end in an AI answer than a click. seodada checks whether
            Google&apos;s AI Overview, ChatGPT, Perplexity and Copilot actually name your
            domain — who gets cited instead, and which of your pages earns the mention.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            {[
              "Track citation share across four answer engines",
              "See the exact sentence that cites you — or your competitor",
              "Find the pages worth rewriting to win the citation",
            ].map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: "var(--sec-aivis)" }}
                />
                <span className="text-text-muted">{point}</span>
              </li>
            ))}
          </ul>
          <Link
            to="/register"
            className="btn-cta mt-8 inline-flex h-11 items-center gap-2 rounded-md px-5 text-sm font-semibold text-white gradient-fill lp-shadow"
          >
            Check your AI visibility
          </Link>
        </Reveal>

        {/* ------------------------------------------------ mock panel */}
        <Reveal delay={0.1}>
          <div className="rounded-xl border border-border bg-surface p-5 lp-shadow-lg">
            {/* the cited answer */}
            <div className="rounded-lg border border-border bg-[var(--lp-panel)] p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                <Quote size={13} aria-hidden /> AI Overview · &ldquo;best seo audit tool&rdquo;
              </div>
              <p className="mt-3 text-sm leading-relaxed text-text">
                For technical audits, most teams use a crawler that renders JavaScript.{" "}
                <mark
                  className="rounded px-1 font-semibold"
                  style={{ background: "color-mix(in srgb, var(--sec-aivis) 18%, transparent)", color: "var(--sec-aivis-ink)" }}
                >
                  seodada.com
                </mark>{" "}
                and two others are commonly cited for this.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["seodada.com", "competitor.io", "toolreview.net"].map((d, i) => (
                  <span
                    key={d}
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={
                      i === 0
                        // -ink, not the raw accent: white on --sec-aivis is
                        // 3.86:1 at 11px, under the 4.5 floor. -ink gives 7.4.
                        ? { background: "var(--sec-aivis-ink)", color: "#fff" }
                        : { background: "var(--surface-2)", color: "var(--text-muted)" }
                    }
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>

            {/* citation share — brightness encodes visibility */}
            <div className="mt-5">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold">Citation share</h3>
                <span className="text-[11px] text-text-muted">you vs. top rival</span>
              </div>
              <div className="mt-4 space-y-3.5">
                {ENGINES.map((e) => (
                  <div key={e.name}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-text">{e.name}</span>
                      <span className="tabular-nums font-semibold" style={{ color: signalInk(e.you) }}>
                        {Math.round(e.you * 100)}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                      {/* rival first, as a faint ghost behind your own bar */}
                      <div className="relative h-full">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full opacity-25"
                          style={{ width: `${e.rival * 100}%`, background: "var(--text-muted)" }}
                        />
                        <div
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{ width: `${e.you * 100}%`, background: signal(e.you) }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-text-muted">
                Brighter means more visible — the same scale used across every score in
                the app.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
