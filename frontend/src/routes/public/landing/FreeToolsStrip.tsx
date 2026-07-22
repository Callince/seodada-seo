import { ArrowRight, FileText, Search, Sparkles } from "lucide-react";
import { DisplayHeading } from "@/components/public/display";
import { Link } from "react-router-dom";

/**
 * The three tools a visitor can use before signing up.
 *
 * Placed on the landing page deliberately: everything else there is a promise,
 * and these are the only three things a stranger can actually *do*. Each links
 * to a public page — no login, nothing billed, all three run client-side or on
 * our own crawler.
 */
/**
 * `tint` is the soft gradient panel each card sits on — one hue per tool so the
 * three read as a set rather than three copies. Mixed against `--surface` (not
 * a fixed pastel) so the wash inverts with the theme instead of staying pale on
 * the dark canvas.
 */
const TOOLS = [
  {
    to: "/free-tools",
    icon: Search,
    title: "SEO Page Analyser",
    desc: "Paste any URL — meta tags, headings, keywords, images and links, broken down in seconds.",
    tag: "6 checks in one",
    tint: "var(--lp-violet)",
  },
  {
    to: "/content-checker",
    icon: FileText,
    title: "Content Checker",
    desc: "Score a draft as you type: keyword density, readability, passive voice and heading structure.",
    tag: "Nothing leaves your browser",
    tint: "var(--lp-cyan)",
  },
  {
    to: "/blog-title-generator",
    icon: Sparkles,
    title: "Blog Title Generator",
    desc: "Title ideas built around the phrase your outline actually repeats — not a generic template.",
    tag: "Instant, no AI wait",
    tint: "var(--lp-emerald)",
  },
];

export function FreeToolsStrip() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-ink">
            Free · no account
          </p>
          <DisplayHeading className="mt-2">
            Try it before you sign up
          </DisplayHeading>
          <p className="mt-3 text-text-muted">
            Three tools that work right now, with no card and no login. They are the same checks the
            platform runs — just scoped to one page at a time.
          </p>
        </div>
        <Link
          to="/free-tools"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-ink hover:underline"
        >
          All free tools <ArrowRight size={15} />
        </Link>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="group flex flex-col rounded-2xl border border-border p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-glow"
            style={{
              background: `linear-gradient(155deg, color-mix(in srgb, ${t.tint} 16%, var(--surface)) 0%, var(--surface) 62%)`,
            }}
          >
            <span
              className="grid h-11 w-11 place-items-center rounded-xl text-primary-ink transition-colors group-hover:gradient-fill group-hover:text-white"
              style={{ background: `color-mix(in srgb, ${t.tint} 22%, transparent)` }}
            >
              <t.icon size={20} />
            </span>
            <h3 className="mt-4 flex items-center gap-1 text-base font-semibold text-text">
              {t.title}
              <ArrowRight size={14} className="opacity-0 transition-opacity group-hover:opacity-100" />
            </h3>
            <p className="mt-2 flex-1 text-sm text-text-muted">{t.desc}</p>
            <span className="mt-4 inline-flex w-fit items-center rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-success">
              {t.tag}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
