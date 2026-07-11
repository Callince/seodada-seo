import { ArrowRight, FileSearch, RefreshCw, Sparkles } from "lucide-react";
import { useRef } from "react";
import { Link } from "react-router-dom";

import { apiErrorMessage } from "@/api/client";
import {
  useAnalyzePage,
  useAnalyzeSitemap,
  type PageAnalysis,
  type SitemapAnalysis,
} from "@/api/hooks/useAnalyze";
import { TONES } from "@/components/public/landingKit";
import { ScoreGauge } from "@/components/shared/ScoreGauge";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { usePersistedState } from "@/lib/persist";
import { PageResult, SitemapResult, TOOL_META, type Tool } from "@/routes/Tools/AnalyzeTool";

/** One aggregated, actionable fix derived from the analysis. */
type Suggestion = { severity: "danger" | "warning"; tool: Tool; text: string };

/** Every signal we score/suggest on, in one pass over the result. */
function buildSuggestions(p: PageAnalysis, s: SitemapAnalysis | null): Suggestion[] {
  const out: Suggestion[] = [];

  for (const c of p.url.checks) {
    if (c.status !== "ok") out.push({ severity: c.status, tool: "url", text: `${c.label} — ${c.detail}` });
  }

  const m = p.meta;
  if (m.title_check !== "ok")
    out.push({
      severity: m.title_check === "missing" ? "danger" : "warning",
      tool: "meta",
      text: `Meta title is ${m.title_check.replace(/_/g, " ")} (${m.title_length} chars) — aim for 50–60 characters.`,
    });
  if (m.description_check !== "ok")
    out.push({
      severity: m.description_check === "missing" ? "danger" : "warning",
      tool: "meta",
      text: `Meta description is ${m.description_check.replace(/_/g, " ")} (${m.description_length} chars) — aim for 120–160 characters.`,
    });
  if (!m.viewport)
    out.push({ severity: "danger", tool: "meta", text: "No viewport meta tag — the page won't scale properly on mobile." });
  if (!m.canonical)
    out.push({ severity: "warning", tool: "meta", text: "No canonical URL — duplicate-content signals may split ranking value." });
  if (Object.keys(m.open_graph).length === 0)
    out.push({ severity: "warning", tool: "meta", text: "No Open Graph tags — shares on social render without a title/image preview." });
  if ((m.schema_types ?? []).length === 0)
    out.push({ severity: "warning", tool: "meta", text: "No Schema.org structured data — rich results (stars, FAQs, breadcrumbs) need JSON-LD." });

  const h1 = p.headings.counts["h1"] ?? 0;
  if (h1 === 0) out.push({ severity: "danger", tool: "heading", text: "No H1 tag — every page needs exactly one main heading." });
  if (h1 > 1) out.push({ severity: "warning", tool: "heading", text: `${h1} H1 tags — keep exactly one main heading per page.` });
  for (const issue of p.headings.issues) out.push({ severity: "warning", tool: "heading", text: issue });

  if (p.images.total > 0 && p.images.missing_alt > 0)
    out.push({
      severity: "warning",
      tool: "image",
      text: `${p.images.missing_alt} of ${p.images.total} images missing alt text — screen readers and image search can't understand them.`,
    });

  if (p.keywords.word_count < 300)
    out.push({
      severity: "warning",
      tool: "keyword",
      text: `Thin content — ${p.keywords.word_count} words. Pages under ~300 words rarely rank; expand the copy.`,
    });

  if (p.links.internal_count === 0)
    out.push({ severity: "warning", tool: "url", text: "No internal links — link to related pages so crawlers and users can move deeper." });

  if (s && s.sitemaps_found.length === 0)
    out.push({ severity: "warning", tool: "sitemap", text: "No XML sitemap found — add one so search engines can discover every page." });

  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "danger" ? -1 : 1));
}

/** 0–100 health score: dangers cost a full point, warnings half, over ~a dozen signals. */
function healthScore(p: PageAnalysis, suggestions: Suggestion[]): number {
  const totalSignals =
    p.url.checks.length + 8; /* meta title/desc/viewport/canonical/og/schema + h1 + images-or-content */
  const penalty = suggestions.reduce((acc, s) => acc + (s.severity === "danger" ? 1 : 0.5), 0);
  return Math.max(0, Math.round(100 * (1 - penalty / Math.max(totalSignals, 1))));
}

const ORDER: Tool[] = ["url", "meta", "heading", "keyword", "image", "sitemap"];

/** The 2–3 headline facts each tool card shows at a glance. */
function summaryStats(tool: Tool, p: PageAnalysis, s: SitemapAnalysis | null): { label: string; value: string; bad?: boolean }[] {
  switch (tool) {
    case "url": {
      const passed = p.url.checks.filter((c) => c.status === "ok").length;
      return [
        { label: "Status", value: String(p.url.status_code), bad: p.url.status_code >= 400 },
        { label: "Checks", value: `${passed}/${p.url.checks.length}`, bad: passed < p.url.checks.length },
        { label: "Links", value: String(p.links.total) },
      ];
    }
    case "meta":
      return [
        { label: "Title", value: p.meta.title_check.replace(/_/g, " "), bad: p.meta.title_check !== "ok" },
        { label: "Description", value: p.meta.description_check.replace(/_/g, " "), bad: p.meta.description_check !== "ok" },
        { label: "Schema", value: String((p.meta.schema_types ?? []).length), bad: (p.meta.schema_types ?? []).length === 0 },
      ];
    case "heading": {
      const h1 = p.headings.counts["h1"] ?? 0;
      const total = Object.values(p.headings.counts).reduce((a, b) => a + b, 0);
      return [
        { label: "H1", value: String(h1), bad: h1 !== 1 },
        { label: "Headings", value: String(total) },
        { label: "Issues", value: String(p.headings.issues.length), bad: p.headings.issues.length > 0 },
      ];
    }
    case "keyword":
      return [
        { label: "Words", value: p.keywords.word_count.toLocaleString(), bad: p.keywords.word_count < 300 },
        { label: "Unique", value: p.keywords.unique_words.toLocaleString() },
        { label: "Read time", value: `${p.keywords.reading_time_min} min` },
      ];
    case "image":
      return [
        { label: "Images", value: String(p.images.total) },
        { label: "Missing alt", value: String(p.images.missing_alt), bad: p.images.missing_alt > 0 },
        { label: "Lazy", value: String(p.images.lazy_count) },
      ];
    case "sitemap":
      return s
        ? [
            { label: "Sitemaps", value: String(s.sitemaps_found.length), bad: s.sitemaps_found.length === 0 },
            { label: "URLs", value: s.total_urls.toLocaleString() },
            { label: "Index", value: s.is_index ? "Yes" : "No" },
          ]
        : [{ label: "Sitemap", value: "pending…" }];
  }
}

export default function AllInOne() {
  const [url, setUrl] = usePersistedState<string>("aio.url", "");
  const [page, setPage] = usePersistedState<PageAnalysis | null>("aio.page", null);
  const [sitemap, setSitemap] = usePersistedState<SitemapAnalysis | null>("aio.sitemap", null);
  const [active, setActive] = usePersistedState<Tool>("aio.active", "url");
  const detailRef = useRef<HTMLDivElement>(null);
  const pageMut = useAnalyzePage();
  const sitemapMut = useAnalyzeSitemap();

  const analyze = (refresh = false) => {
    const u = url.trim();
    if (!u) return;
    pageMut.mutate({ url: u, refresh }, { onSuccess: setPage });
    // Sitemap discovery is best-effort enrichment — failures just hide its section.
    sitemapMut.mutate({ url: u, refresh }, { onSuccess: setSitemap, onError: () => setSitemap(null) });
  };

  const openDetail = (t: Tool) => {
    setActive(t);
    // Let the detail swap in, then bring it into view.
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const suggestions = page ? buildSuggestions(page, sitemap) : [];
  const issuesByTool = suggestions.reduce<Record<string, number>>((acc, s) => {
    acc[s.tool] = (acc[s.tool] ?? 0) + 1;
    return acc;
  }, {});
  const score = page ? healthScore(page, suggestions) : null;
  const verdict =
    score == null
      ? null
      : score >= 90
        ? { t: "Excellent", c: "success" as const }
        : score >= 70
          ? { t: "Good", c: "success" as const }
          : score >= 50
            ? { t: "Fair", c: "warning" as const }
            : { t: "Needs work", c: "danger" as const };

  const activeMeta = TOOL_META[active];
  const [ac1, ac2] = TONES[activeMeta.tone];
  const ActiveIcon = activeMeta.icon;

  return (
    <div>
      <PageHeader
        title="All-in-One Analysis"
        subtitle="Every free on-page check — URL, meta, headings, keywords, images and sitemap — in a single pass, with prioritized suggestions."
      />

      <Card className="mb-6">
        <CardBody>
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              analyze(false);
            }}
          >
            <span className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3">
              <FileSearch size={16} className="text-text-muted" />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter a URL — e.g. example.com/page"
                className="w-full bg-transparent py-2 text-sm text-text placeholder:text-text-muted focus:outline-none"
              />
            </span>
            <Button type="submit" disabled={pageMut.isPending || !url.trim()}>
              <Sparkles size={15} /> {pageMut.isPending ? "Analyzing…" : "Analyze everything"}
            </Button>
            {page && (
              <Button
                type="button"
                variant="secondary"
                title="Bypass the cache and fetch the page live"
                disabled={pageMut.isPending || !url.trim()}
                onClick={() => analyze(true)}
              >
                <RefreshCw size={15} className={pageMut.isPending ? "animate-spin" : ""} /> Refresh
              </Button>
            )}
          </form>
          {pageMut.isError && <p className="mt-3 text-sm text-danger">{apiErrorMessage(pageMut.error)}</p>}
        </CardBody>
      </Card>

      {!page && !pageMut.isPending && (
        <EmptyState
          title="Analyze a page end to end"
          hint="One URL runs all six free tools at once — you get a health score, prioritized fixes, and a card per tool you can open for the full report."
        />
      )}

      {page && !pageMut.isPending && (
        <div className="animate-fade-rise space-y-6">
          {/* ===== Row 1 — health score + prioritized suggestions ===== */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="bg-gradient-to-br from-[color:var(--section-soft)] to-surface">
              <CardBody className="flex h-full flex-col items-center justify-center gap-3 py-6">
                <ScoreGauge score={score} label="page health" size={150} />
                {verdict && <Badge tone={verdict.c}>{verdict.t}</Badge>}
                <p className="text-center text-xs text-text-muted">
                  {suggestions.length === 0
                    ? "Every check passed."
                    : `${suggestions.filter((s) => s.severity === "danger").length} critical · ${suggestions.filter((s) => s.severity === "warning").length} improvements`}
                </p>
              </CardBody>
            </Card>

            <Card className="lg:col-span-2">
              <CardBody>
                <p className="mb-2 text-sm font-semibold text-text">
                  Suggestions{" "}
                  <span className="font-normal text-text-muted">— what to fix, most important first</span>
                </p>
                {suggestions.length === 0 ? (
                  <p className="text-sm text-success">All checks passed — nothing to fix on this page. 🎉</p>
                ) : (
                  <div className="max-h-64 space-y-0.5 overflow-y-auto pr-1">
                    {suggestions.map((s, i) => {
                      const t = TOOL_META[s.tool];
                      const [c1] = TONES[t.tone];
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => openDetail(s.tool)}
                          className="flex w-full items-start gap-3 rounded-lg border-b border-border/60 px-1 py-2 text-left text-sm last:border-0 hover:bg-surface-2"
                        >
                          <Badge tone={s.severity === "danger" ? "danger" : "warning"}>
                            {s.severity === "danger" ? "✕" : "!"}
                          </Badge>
                          <span className="min-w-0">
                            <span
                              className="mr-2 inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold"
                              style={{ color: c1 }}
                            >
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: c1 }} />
                              {t.title.replace(" Analysis", "")}
                            </span>
                            <span className="text-text">{s.text}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* ===== Row 2 — one compact card per tool; click to open its report ===== */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {ORDER.map((t) => {
              const m = TOOL_META[t];
              const [c1, c2] = TONES[m.tone];
              const Icon = m.icon;
              const issues = issuesByTool[t] ?? 0;
              const isActive = active === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => openDetail(t)}
                  aria-pressed={isActive}
                  className={`rounded-2xl border bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 ${
                    isActive ? "shadow-md ring-2" : "border-border"
                  }`}
                  style={
                    isActive
                      ? { borderColor: c1, ["--tw-ring-color" as string]: `color-mix(in srgb, ${c1} 45%, transparent)` }
                      : undefined
                  }
                >
                  <div className="flex items-start justify-between">
                    <span
                      className="grid h-9 w-9 place-items-center rounded-xl text-white shadow-sm"
                      style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
                    >
                      <Icon size={16} />
                    </span>
                    {issues > 0 ? (
                      <Badge tone="warning">{issues}</Badge>
                    ) : (
                      <Badge tone="success">✓</Badge>
                    )}
                  </div>
                  <p className="mt-2.5 text-sm font-bold text-text">{m.title.replace(" Analysis", "")}</p>
                  <div className="mt-1.5 space-y-0.5">
                    {summaryStats(t, page, sitemap).map((st) => (
                      <div key={st.label} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-text-muted">{st.label}</span>
                        <span className={`font-mono font-semibold ${st.bad ? "text-warning" : "text-text"}`}>
                          {st.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {/* ===== Row 3 — the selected tool's full report ===== */}
          <div
            ref={detailRef}
            className="scroll-mt-4 rounded-3xl border-2 bg-surface/60 p-4 sm:p-6"
            style={{ borderColor: `color-mix(in srgb, ${ac1} 35%, transparent)` }}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span
                  className="grid h-10 w-10 place-items-center rounded-xl text-white shadow-md"
                  style={{ background: `linear-gradient(135deg, ${ac1}, ${ac2})` }}
                >
                  <ActiveIcon size={18} />
                </span>
                <div>
                  <h2 className="text-base font-bold tracking-tight text-text">{activeMeta.title}</h2>
                  <p className="text-xs text-text-muted">{activeMeta.subtitle}</p>
                </div>
              </div>
              <Link
                to={`/tools/${active}`}
                className="inline-flex items-center gap-1 text-sm font-medium"
                style={{ color: ac1 }}
              >
                Open full tool <ArrowRight size={14} />
              </Link>
            </div>
            {active === "sitemap" ? (
              sitemap ? (
                <SitemapResult data={sitemap} />
              ) : (
                <p className="py-6 text-center text-sm text-text-muted">
                  {sitemapMut.isPending
                    ? "Discovering the sitemap…"
                    : "No sitemap analysis for this URL — run the full Sitemap tool for a deeper look."}
                </p>
              )
            ) : (
              <PageResult tool={active} data={page} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
