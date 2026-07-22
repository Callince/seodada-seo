import { Bot, Check, Minus, Quote, Search, Sparkles, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import { apiErrorMessage } from "@/api/client";
import {
  useAiVisibilityStatus, useAiVolume, useDomainKeywords, useLlmMentions, useStartAiVisibility,
} from "@/api/hooks/useAiVisibility";
import { LocationLanguagePicker } from "@/components/shared/LocationLanguagePicker";
import { CacheBadge } from "@/components/shared/CacheBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { ExcelButton } from "@/components/shared/ExcelButton";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { AreaChart } from "@/components/public/landingKit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { DomainKeywordsCard } from "@/routes/ai/DomainKeywordsCard";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { fmtInt } from "@/lib/format";
import { dfsLocationName } from "@/lib/regionNames";
import type { AiCitation, AiKeywordRow, AiVolumeRow, MentionDimensionRow } from "@/types";

const languageNames = new Intl.DisplayNames(["en"], { type: "language" });

function locationLabel(key: number | string | null): string {
  return dfsLocationName(key);
}

function languageLabel(key: number | string | null): string {
  if (key === null || key === undefined) return "—";
  try {
    return languageNames.of(String(key)) ?? String(key);
  } catch {
    return String(key);
  }
}

const PLATFORM_NAMES: Record<string, string> = { google: "Google AI", chat_gpt: "ChatGPT" };

function platformLabel(key: number | string | null): string {
  if (key === null || key === undefined) return "—";
  const k = String(key);
  return PLATFORM_NAMES[k] ?? k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Last 6 monthly volumes, oldest first, for the tiny trend sparkline. */
function trendValues(row: AiVolumeRow): number[] {
  return [...row.monthly]
    .sort((a, b) => (a.year ?? 0) * 100 + (a.month ?? 0) - ((b.year ?? 0) * 100 + (b.month ?? 0)))
    .slice(-6)
    .map((p) => p.volume ?? 0);
}

/**
 * One bento cell. `hint` is the point of this component: every number on this
 * page is meaningless without a sentence saying what it counts, and the old
 * layout showed bare figures under three-word labels.
 */
function Stat({
  icon: Icon, label, value, hint, accent, className,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string | number;
  hint: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardBody className="flex h-full flex-col">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
          <Icon size={13} /> {label}
        </p>
        <p
          className={cn(
            "mt-1.5 font-mono text-3xl leading-none",
            accent ? "text-[color:var(--section-ink)]" : "text-text",
          )}
        >
          {typeof value === "number" ? fmtInt(value) : value}
        </p>
        <p className="mt-auto pt-2 text-xs leading-snug text-text-muted">{hint}</p>
      </CardBody>
    </Card>
  );
}

/** Cited badge with the source URL + rank, or a muted dash when absent. */
function CiteCell({ present, cite }: { present: boolean; cite: AiCitation }) {
  if (!present) return <span className="text-text-muted" title="No AI answer appeared for this keyword">—</span>;
  if (!cite.cited)
    return (
      <Badge tone="neutral" title="An AI answer showed, but your domain was not cited">
        not cited
      </Badge>
    );
  return (
    <a href={cite.url ?? "#"} target="_blank" rel="noreferrer" title={cite.url ?? ""}>
      <Badge tone="success">
        <Check size={12} /> cited{cite.position ? ` · #${cite.position}` : ""}
      </Badge>
    </a>
  );
}

/** One LLM-mentions dimension as a compact ranked list. */
function DimList({
  title, rows, label, hint, max = 5,
}: {
  title: string;
  rows: MentionDimensionRow[];
  label: (k: number | string | null) => string;
  hint: string;
  max?: number;
}) {
  if (!rows.length) return null;
  const top = rows.slice(0, max);
  const peak = Math.max(...top.map((r) => r.mentions), 1);
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</p>
      <p className="mb-2 text-xs text-text-muted">{hint}</p>
      <ul className="space-y-1.5">
        {top.map((row) => (
          <li key={String(row.key)} className="flex items-center gap-2">
            <span className="w-32 shrink-0 truncate text-sm text-text" title={label(row.key)}>
              {label(row.key)}
            </span>
            {/* A bar beats a number column here: the question is "which of these
                dominates", which is a comparison, not a readout. */}
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <span
                className="block h-full rounded-full bg-[color:var(--section)]"
                style={{ width: `${Math.max(4, (row.mentions / peak) * 100)}%` }}
              />
            </span>
            <span className="w-12 shrink-0 text-right font-mono text-xs text-text-muted">
              {fmtInt(row.mentions)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AiVisibility() {
  const [domain, setDomain] = useState("");
  const [raw, setRaw] = useState("");
  const [loc, setLoc] = useState({ location_code: 2356, language_code: "en" });
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [aiMode, setAiMode] = useState(true);
  const [live, setLive] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);

  const start = useStartAiVisibility();
  const status = useAiVisibilityStatus(taskId);
  const mentions = useLlmMentions();
  const aiVolume = useAiVolume();
  // Owned here rather than inside DomainKeywordsCard so the single Excel export
  // below can include the discovered keywords.
  const domainKeywords = useDomainKeywords();

  const keywords = useMemo(
    () => Array.from(new Set(raw.split(/[\n,]+/).map((k) => k.trim().toLowerCase()).filter(Boolean))).slice(0, 20),
    [raw],
  );

  /**
   * One button runs the whole page.
   *
   * Previously each panel had its own "Run", so a full picture took four
   * separate clicks and it was not obvious that the lower panels were even
   * connected to the domain above them.
   */
  const run = () => {
    const d = domain.trim();
    if (!d || keywords.length === 0) return;
    setTaskId(null);
    start.mutate(
      { domain: d, keywords, ...loc, device, include_ai_mode: aiMode, force_live: live },
      { onSuccess: (r) => setTaskId(r.task_id) },
    );
    if (!mentions.isPending) mentions.mutate({ domain: d, force_live: live });
    if (!aiVolume.isPending) aiVolume.mutate({ keywords, force_live: live });
  };

  const s = status.data;
  const failed = s?.progress === "error" || s?.progress === "unknown";
  const running = !!taskId && !failed && (!s || s.progress !== "finished");
  const done = s?.progress === "finished";

  // Cited rows first, then keywords that showed an AI answer, then the rest.
  const rows = useMemo(() => {
    const list = s?.rows ?? [];
    const rank = (r: AiKeywordRow) =>
      (r.ai_overview.cited || r.ai_mode.cited ? 0 : r.ai_overview_present || r.ai_mode_present ? 1 : 2);
    return [...list].sort((a, b) => rank(a) - rank(b));
  }, [s?.rows]);

  // The headline number. Share of *answered* keywords that cite you is the
  // honest denominator: keywords where no AI answer appeared at all were never
  // an opportunity to be cited, and counting them just dilutes the figure.
  const answered = s ? s.summary.ai_overview_present : 0;
  const citedCount = s ? s.summary.ai_overview_cited + s.summary.ai_mode_cited : 0;
  const citeRate = answered > 0 ? Math.round((s!.summary.ai_overview_cited / answered) * 100) : null;

  const verdict = (() => {
    if (citeRate === null) return "No AI answers appeared for these keywords yet.";
    if (citeRate === 0) return "AI answers appear, but never cite you. Those are your gaps.";
    if (citeRate < 25) return "You are cited occasionally — most AI answers use other sources.";
    if (citeRate < 60) return "A solid share of AI answers cite you. Room to grow.";
    return "You are a primary source for these AI answers.";
  })();

  const anyData = done || !!mentions.data || !!aiVolume.data || !!domainKeywords.data;

  /** Everything on the page, in one workbook. */
  const buildExcel = () => {
    const yn = (v: boolean) => (v ? "yes" : "no");
    const dims = mentions.data?.dimensions ?? {};
    const dimRows = [
      ...(dims.platform ?? []).map((r) => ({ dimension: "Platform", key: platformLabel(r.key), mentions: r.mentions, ai_search_volume: r.ai_search_volume })),
      ...(dims.language ?? []).map((r) => ({ dimension: "Language", key: languageLabel(r.key), mentions: r.mentions, ai_search_volume: r.ai_search_volume })),
      ...(dims.location ?? []).map((r) => ({ dimension: "Location", key: locationLabel(r.key), mentions: r.mentions, ai_search_volume: r.ai_search_volume })),
      ...(dims.sources_domain ?? []).map((r) => ({ dimension: "Top source", key: String(r.key ?? "—"), mentions: r.mentions, ai_search_volume: r.ai_search_volume })),
    ];
    return {
      summary: {
        Report: "AI Visibility",
        Domain: domain.trim(),
        Market: locationLabel(loc.location_code),
        Device: device,
        "Keywords checked": s?.summary.keywords ?? keywords.length,
        "AI Overviews shown": s?.summary.ai_overview_present ?? 0,
        "Cited in AI Overview": s?.summary.ai_overview_cited ?? 0,
        "Cited in AI Mode": s?.summary.ai_mode_cited ?? 0,
        "Citation rate": citeRate === null ? "—" : `${citeRate}%`,
        "LLM mentions": mentions.data?.mentions ?? 0,
        "AI search volume": mentions.data?.ai_search_volume ?? 0,
        Generated: new Date().toLocaleString(),
      },
      sheets: [
        {
          name: "Keyword AI citations",
          columns: [
            { header: "Keyword", key: "keyword", width: 40 },
            { header: "AI Overview shown", key: "ai_overview_present", width: 16 },
            { header: "AI Overview cited", key: "ai_overview_cited", width: 16 },
            { header: "AI Overview position", key: "ai_overview_position", width: 18 },
            { header: "AI Overview URL", key: "ai_overview_url", width: 50 },
            { header: "AI Mode shown", key: "ai_mode_present", width: 14 },
            { header: "AI Mode cited", key: "ai_mode_cited", width: 14 },
            { header: "AI Mode position", key: "ai_mode_position", width: 16 },
            { header: "AI Mode URL", key: "ai_mode_url", width: 50 },
            { header: "Cited domains", key: "cited_domains", width: 60 },
          ],
          rows: rows.map((r) => ({
            keyword: r.keyword,
            ai_overview_present: yn(r.ai_overview_present),
            ai_overview_cited: yn(r.ai_overview.cited),
            ai_overview_position: r.ai_overview.position,
            ai_overview_url: r.ai_overview.url,
            ai_mode_present: yn(r.ai_mode_present),
            ai_mode_cited: yn(r.ai_mode.cited),
            ai_mode_position: r.ai_mode.position,
            ai_mode_url: r.ai_mode.url,
            cited_domains: r.cited_domains.join("; "),
          })) as unknown as Record<string, unknown>[],
        },
        {
          name: "LLM mentions",
          columns: [
            { header: "Dimension", key: "dimension", width: 14 },
            { header: "Value", key: "key", width: 28 },
            { header: "Mentions", key: "mentions", width: 12 },
            { header: "AI volume", key: "ai_search_volume", width: 12 },
          ],
          rows: dimRows as unknown as Record<string, unknown>[],
        },
        {
          name: "AI search volume",
          columns: [
            { header: "Keyword", key: "keyword", width: 40 },
            { header: "AI volume/mo", key: "ai_search_volume", width: 14 },
          ],
          rows: (aiVolume.data?.rows ?? []).map((r) => ({
            keyword: r.keyword,
            ai_search_volume: r.ai_search_volume,
          })) as unknown as Record<string, unknown>[],
        },
        {
          // The dataset the old export missed entirely — it lived in a child
          // component that owned its own state.
          name: "Discovered AI keywords",
          columns: [
            { header: "Question asked", key: "question", width: 60 },
            { header: "AI volume", key: "ai_search_volume", width: 12 },
            { header: "Seen on", key: "platforms", width: 24 },
            { header: "Sources", key: "source_count", width: 10 },
            { header: "Answer snippet", key: "answer_snippet", width: 80 },
          ],
          rows: (domainKeywords.data?.rows ?? []).map((r) => ({
            question: r.question,
            ai_search_volume: r.ai_search_volume,
            platforms: (r.platforms.length ? r.platforms : [r.platform]).filter(Boolean).join("; "),
            source_count: r.source_count,
            answer_snippet: r.answer_snippet,
          })) as unknown as Record<string, unknown>[],
        },
      ],
    };
  };

  const citationCols: Column<AiKeywordRow>[] = [
    {
      key: "keyword", header: "Keyword",
      sortValue: (r) => r.keyword,
      render: (r) => <span className="font-medium text-text">{r.keyword}</span>,
    },
    {
      key: "ai_overview", header: "AI Overview",
      sortValue: (r) => (r.ai_overview.cited ? 0 : r.ai_overview_present ? 1 : 2),
      render: (r) => <CiteCell present={r.ai_overview_present} cite={r.ai_overview} />,
      csvValue: (r) => (r.ai_overview.cited ? `cited #${r.ai_overview.position ?? ""}` : r.ai_overview_present ? "not cited" : "no answer"),
    },
    {
      key: "ai_mode", header: "AI Mode",
      sortValue: (r) => (r.ai_mode.cited ? 0 : r.ai_mode_present ? 1 : 2),
      render: (r) =>
        s?.include_ai_mode
          ? <CiteCell present={r.ai_mode_present} cite={r.ai_mode} />
          : <span className="inline-flex items-center text-text-muted" title="AI Mode was not included in this run"><Minus size={13} /></span>,
      csvValue: (r) => (r.ai_mode.cited ? `cited #${r.ai_mode.position ?? ""}` : r.ai_mode_present ? "not cited" : "no answer"),
    },
    {
      key: "cited_domains", header: "Who AI cited instead",
      sortValue: (r) => r.cited_domains.length,
      render: (r) =>
        r.cited_domains.length === 0 ? (
          <span className="text-text-muted">—</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {r.cited_domains.slice(0, 6).map((d) => (
              <span key={d} className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[11px] text-text-muted">{d}</span>
            ))}
            {r.cited_domains.length > 6 && (
              <span className="text-[11px] text-text-muted">+{r.cited_domains.length - 6}</span>
            )}
          </span>
        ),
      csvValue: (r) => r.cited_domains.join("; "),
    },
  ];

  const volumeCols: Column<AiVolumeRow>[] = [
    {
      key: "keyword", header: "Prompt",
      sortValue: (r) => r.keyword ?? "",
      render: (r) => <span className="font-medium text-text">{r.keyword ?? "—"}</span>,
    },
    {
      key: "ai_search_volume", header: "Asked / mo", align: "right", mono: true,
      sortValue: (r) => r.ai_search_volume,
      render: (r) => (r.ai_search_volume === null ? "—" : fmtInt(r.ai_search_volume)),
    },
    {
      key: "trend", header: "Trend",
      render: (r) => (
        <div className="h-6 w-24">
          {r.monthly.length > 1 && (
            <AreaChart values={trendValues(r)} tone="violet" height={24} id={`aivol-${r.keyword}`} />
          )}
        </div>
      ),
      csvValue: (r) => trendValues(r).join(" "),
    },
  ];

  return (
    <div>
      {/* Compact hero — the old one ran 8rem tall before any control appeared. */}
      <div
        className="relative mb-4 overflow-hidden rounded-2xl p-5 text-white sm:p-6"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--section) 38%, #000), color-mix(in srgb, var(--section) 50%, #000) 48%, var(--section))",
        }}
      >
        <div className="cyber-grid pointer-events-none absolute inset-0 opacity-[0.15]" aria-hidden />
        <div className="relative z-10 flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 backdrop-blur">
            <Sparkles size={20} />
          </span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">AI Visibility</h1>
            <p className="mt-0.5 max-w-2xl text-sm text-white/80">
              When someone asks Google or an LLM about your topic, does the answer cite you? This
              checks each keyword and shows who gets cited instead.
            </p>
          </div>
        </div>
      </div>

      {/* ── Setup ─────────────────────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardBody className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row">
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="Your domain — e.g. komaki.in"
              aria-label="Domain"
              className="md:flex-1"
            />
            <LocationLanguagePicker value={loc} onChange={setLoc} className="md:w-56" />
            <Select value={device} onChange={(e) => setDevice(e.target.value as "desktop" | "mobile")} aria-label="Device">
              <option value="desktop">Desktop</option>
              <option value="mobile">Mobile</option>
            </Select>
          </div>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={3}
            aria-label="Keywords"
            placeholder={"One keyword per line (or comma-separated) — up to 20.\nbest electric scooter in india\nelectric scooter under 50000"}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--section)]"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <p className="text-xs text-text-muted">{keywords.length} unique keyword{keywords.length === 1 ? "" : "s"} (max 20)</p>
              <label className="flex items-center gap-1.5 text-sm text-text-muted" title="Also query Google's dedicated AI Mode answer (extra billed call per keyword)">
                <input type="checkbox" checked={aiMode} onChange={(e) => setAiMode(e.target.checked)} className="h-4 w-4 accent-[var(--section)]" />
                Include AI Mode
              </label>
              <label className="flex items-center gap-1.5 text-sm text-text-muted" title="Bypass the cache and fetch fresh (billed) data">
                <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} className="h-4 w-4 accent-[var(--section)]" />
                Live
              </label>
            </div>
            <div className="flex items-center gap-2">
              <ExcelButton
                filename={`ai-visibility-${domain.trim() || "report"}`}
                build={buildExcel}
                disabled={!anyData}
              />
              <Button onClick={run} loading={start.isPending} disabled={!domain.trim() || keywords.length === 0 || running}>
                {!start.isPending && <Sparkles size={16} />} Check AI visibility
              </Button>
            </div>
          </div>
          <p className="text-xs text-text-muted">
            One run fetches citations, LLM mentions and AI prompt volume together — the Excel export
            carries every table on this page in a single workbook.
          </p>
        </CardBody>
      </Card>

      {!taskId && !start.isPending && !start.isError && !anyData && (
        <EmptyState
          title="Check your AI search visibility"
          hint="Enter your domain and the keywords you care about. We ask Google's AI Overview and AI Mode for each one and show where your site is cited."
        />
      )}

      {start.isError && <ErrorState message={apiErrorMessage(start.error)} onRetry={run} />}
      {failed && taskId && <ErrorState message={s?.error || "The check could not be completed."} onRetry={run} />}

      {running && taskId && (
        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
            <Bot size={32} className="animate-pulse text-[color:var(--section)]" />
            <p className="text-sm font-medium text-text">Querying Google AI for {domain.trim()}…</p>
            <p className="text-sm text-text-muted">{s ? `${s.checked} / ${s.total} keywords checked` : "Starting…"}</p>
            <div className="h-2 w-64 overflow-hidden rounded-full bg-surface-2">
              <div
                className="section-gradient h-full rounded-full transition-all duration-500"
                style={{ width: s && s.total ? `${Math.min(100, (s.checked / s.total) * 100)}%` : "8%" }}
              />
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── Bento: headline + supporting stats ────────────────────────────── */}
      {done && (
        <div className="animate-fade-rise mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="md:col-span-2 xl:row-span-2">
            <CardBody className="flex h-full flex-col justify-center py-6">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Citation rate</p>
              <p className="mt-1 font-mono text-6xl leading-none text-[color:var(--section-ink)]">
                {citeRate === null ? "—" : `${citeRate}%`}
              </p>
              <p className="mt-3 max-w-md text-sm text-text">{verdict}</p>
              <p className="mt-1.5 text-xs text-text-muted">
                {answered === 0
                  ? "No AI Overview appeared for any of these keywords."
                  : `${fmtInt(s!.summary.ai_overview_cited)} of ${fmtInt(answered)} keywords that produced an AI Overview cite ${domain.trim()}. Keywords with no AI answer are excluded — they were never a chance to be cited.`}
              </p>
            </CardBody>
          </Card>

          <Stat
            icon={Search} label="Keywords checked" value={s!.summary.keywords}
            hint="Every keyword we asked Google AI about."
          />
          <Stat
            icon={Sparkles} label="AI answers shown" value={s!.summary.ai_overview_present}
            hint="Keywords where an AI Overview actually appeared."
          />
          <Stat
            icon={Quote} label="Times you were cited" value={citedCount} accent
            hint="Across AI Overview and AI Mode combined."
          />
          <Stat
            icon={Bot} label="LLM mentions" value={mentions.data ? mentions.data.mentions : "—"}
            hint={mentions.data ? "Answers naming your domain across LLM platforms." : "Runs with the main check."}
          />
        </div>
      )}

      {/* ── Bento: the two detail panels ───────────────────────────────────
          `min-w-0` on the grid children below is load-bearing: a grid item
          defaults to `min-width: auto`, so a DataTable's min-content width
          forces the column wider than the viewport and the table's own
          `overflow-x:auto` never engages. Without it this row measured 1161px
          wide on a 375px screen. */}
      {done && (
        <div className="mb-4 grid gap-4 xl:grid-cols-3">
          <Card className="min-w-0 xl:col-span-2">
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Keyword by keyword</CardTitle>
                <p className="mt-0.5 text-xs text-text-muted">
                  Cited first. “—” means no AI answer appeared at all.
                </p>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              <DataTable columns={citationCols} rows={rows} csvName={`ai-citations-${domain.trim()}`} />
            </CardBody>
          </Card>

          <Card className="min-w-0">
            <CardHeader className="flex items-center justify-between gap-2">
              <CardTitle>Where AI sees you</CardTitle>
              {mentions.data && <CacheBadge meta={mentions.data.meta} />}
            </CardHeader>
            <CardBody className="space-y-4">
              {mentions.isPending && <><Skeleton className="h-20" /><Skeleton className="h-20" /></>}
              {mentions.isError && <p className="text-sm text-danger">{apiErrorMessage(mentions.error)}</p>}
              {!mentions.isPending && !mentions.data && (
                <p className="text-sm text-text-muted">Runs automatically with the main check.</p>
              )}
              {!mentions.isPending && mentions.data && (
                <>
                  <DimList
                    title="Platforms" rows={mentions.data.dimensions.platform ?? []}
                    label={platformLabel} hint="Which AI engines mention you."
                  />
                  <DimList
                    title="Top sources" rows={mentions.data.dimensions.sources_domain ?? []}
                    label={(k) => String(k ?? "—")}
                    hint="Sites AI cites alongside you — earn a mention on these."
                  />
                  <DimList
                    title="Locations" rows={mentions.data.dimensions.location ?? []}
                    label={locationLabel} hint="Markets where you come up."
                  />
                </>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* ── Bento: demand + discovery ─────────────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>How often these are asked</CardTitle>
              <p className="mt-0.5 text-xs text-text-muted">
                Monthly prompt volume to LLMs — the AI-era counterpart to search volume.
              </p>
            </div>
            {aiVolume.data && <CacheBadge meta={aiVolume.data.meta} />}
          </CardHeader>
          <CardBody className={aiVolume.data ? "p-0" : undefined}>
            {aiVolume.isPending && <div className="space-y-2 p-5"><Skeleton className="h-8" /><Skeleton className="h-8" /></div>}
            {aiVolume.isError && <p className="p-5 text-sm text-danger">{apiErrorMessage(aiVolume.error)}</p>}
            {!aiVolume.isPending && !aiVolume.data && (
              <p className="text-sm text-text-muted">Runs automatically with the main check.</p>
            )}
            {!aiVolume.isPending && aiVolume.data && (
              <DataTable columns={volumeCols} rows={aiVolume.data.rows} csvName={`ai-volume-${domain.trim()}`} />
            )}
          </CardBody>
        </Card>

        {/* Deliberately outside the results gate: this is the tool for when you
            do NOT yet have keywords, so locking it behind a finished run would
            mean guessing keywords and paying for a check first. */}
        <div className="min-w-0">
          <DomainKeywordsCard domain={domain} live={live} dk={domainKeywords} />
        </div>
      </div>

      {done && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-text-muted">
          <TrendingUp size={13} />
          Being cited is the AI-era equivalent of ranking. Target the keywords showing “not cited” —
          an AI answer already exists there, it just uses someone else as the source.
        </p>
      )}
    </div>
  );
}
