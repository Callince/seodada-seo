import { Bot, Check, Minus, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { apiErrorMessage } from "@/api/client";
import { useAiVisibilityStatus, useAiVolume, useAskLlm, useLlmMentions, useStartAiVisibility } from "@/api/hooks/useAiVisibility";
import { LocationLanguagePicker } from "@/components/shared/LocationLanguagePicker";
import { CacheBadge } from "@/components/shared/CacheBadge";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared/states";
import { AreaChart } from "@/components/public/landingKit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtInt } from "@/lib/format";
import type { AiCitation, AiKeywordRow, AiVolumeRow } from "@/types";

/** DataForSEO location codes we can name; anything else falls back to the raw code. */
const LOCATION_NAMES: Record<string, string> = { "2356": "India", "2840": "United States" };

function locationLabel(key: number | string | null): string {
  if (key === null || key === undefined) return "—";
  return LOCATION_NAMES[String(key)] ?? String(key);
}

/** Last 6 monthly volumes, oldest first, for the tiny trend sparkline. */
function trendValues(row: AiVolumeRow): number[] {
  return [...row.monthly]
    .sort((a, b) => (a.year ?? 0) * 100 + (a.month ?? 0) - ((b.year ?? 0) * 100 + (b.month ?? 0)))
    .slice(-6)
    .map((p) => p.volume ?? 0);
}

function Tile({ label, value, accent }: { label: string; value: number; accent?: "primary" | "default" }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
        <p className={`mt-1 font-mono text-2xl ${accent === "primary" ? "text-primary" : "text-text"}`}>
          {fmtInt(value)}
        </p>
      </CardBody>
    </Card>
  );
}

/** Cited badge with the source URL + rank, or a muted dash when absent. */
function CiteCell({ present, cite }: { present: boolean; cite: AiCitation }) {
  if (!present) return <span className="text-text-muted">—</span>;
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

  // AI Optimization API (GEO/AEO) sections
  const mentions = useLlmMentions();
  const aiVolume = useAiVolume();
  const ask = useAskLlm();
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");

  const runMentions = () => {
    const d = domain.trim();
    if (!d || mentions.isPending) return;
    mentions.mutate({ domain: d, force_live: live });
  };

  const runAiVolume = () => {
    if (keywords.length === 0 || aiVolume.isPending) return;
    aiVolume.mutate({ keywords, force_live: live });
  };

  const runAsk = () => {
    const p = prompt.trim();
    if (!p || ask.isPending) return;
    ask.mutate({ prompt: p, model_name: model, force_live: live });
  };

  const keywords = useMemo(
    () => Array.from(new Set(raw.split(/[\n,]+/).map((k) => k.trim().toLowerCase()).filter(Boolean))).slice(0, 20),
    [raw],
  );

  const run = () => {
    const d = domain.trim();
    if (!d || keywords.length === 0) return;
    setTaskId(null);
    start.mutate(
      { domain: d, keywords, ...loc, device, include_ai_mode: aiMode, force_live: live },
      { onSuccess: (r) => setTaskId(r.task_id) },
    );
    // Piggyback the LLM-mentions lookup on the main check — same domain, no extra click.
    if (!mentions.isPending) mentions.mutate({ domain: d, force_live: live });
  };

  const s = status.data;
  const failed = s?.progress === "error" || s?.progress === "unknown";
  const running = !!taskId && !failed && (!s || s.progress !== "finished");

  // Cited rows first, then keywords that showed an AI answer, then the rest.
  const rows = useMemo(() => {
    const list = s?.rows ?? [];
    const rank = (r: AiKeywordRow) =>
      (r.ai_overview.cited || r.ai_mode.cited ? 0 : r.ai_overview_present || r.ai_mode_present ? 1 : 2);
    return [...list].sort((a, b) => rank(a) - rank(b));
  }, [s?.rows]);

  return (
    <div>
      <PageHeader
        title="AI Visibility"
        subtitle="See which of your keywords trigger a Google AI Overview or AI Mode answer — and whether your site is cited as a source. The keywords you 'rank' for in AI."
      />

      <Card className="mb-5">
        <CardBody className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row">
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="Your domain — e.g. komaki.in"
              className="md:flex-1"
            />
            <LocationLanguagePicker value={loc} onChange={setLoc} />
            <Select value={device} onChange={(e) => setDevice(e.target.value as "desktop" | "mobile")} aria-label="Device">
              <option value="desktop">Desktop</option>
              <option value="mobile">Mobile</option>
            </Select>
          </div>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={4}
            placeholder={"One keyword per line (or comma-separated) — up to 20.\nbest electric scooter in india\nelectric scooter under 50000\nelectric scooter price in india"}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <p className="text-xs text-text-muted">{keywords.length} unique keyword{keywords.length === 1 ? "" : "s"} (max 20)</p>
              <label className="flex items-center gap-1.5 text-sm text-text-muted" title="Also query Google's dedicated AI Mode answer (extra billed call per keyword)">
                <input type="checkbox" checked={aiMode} onChange={(e) => setAiMode(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
                Include AI Mode
              </label>
              <label className="flex items-center gap-1.5 text-sm text-text-muted" title="Bypass the cache and fetch fresh (billed) data">
                <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
                Live
              </label>
            </div>
            <Button onClick={run} loading={start.isPending} disabled={!domain.trim() || keywords.length === 0 || running}>
              {!start.isPending && <Sparkles size={16} />} Check AI visibility
            </Button>
          </div>
        </CardBody>
      </Card>

      {!taskId && !start.isPending && !start.isError && (
        <EmptyState
          title="Check your AI search visibility"
          hint="Enter your domain and the keywords you care about. We ask Google's AI Overview and AI Mode for each one and show where your site is cited."
        />
      )}

      {start.isError && <ErrorState message={apiErrorMessage(start.error)} onRetry={run} />}
      {failed && taskId && (
        <ErrorState message={s?.error || "The check could not be completed."} onRetry={run} />
      )}

      {running && taskId && (
        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
            <Bot size={32} className="animate-pulse text-primary" />
            <p className="text-sm font-medium text-text">Querying Google AI for {domain.trim()}…</p>
            <p className="text-sm text-text-muted">
              {s ? `${s.checked} / ${s.total} keywords checked` : "Starting…"}
            </p>
            <div className="h-2 w-64 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: s && s.total ? `${Math.min(100, (s.checked / s.total) * 100)}%` : "8%" }}
              />
            </div>
          </CardBody>
        </Card>
      )}

      {s && s.progress === "finished" && (
        <div className="animate-fade-rise space-y-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Tile label="Keywords" value={s.summary.keywords} />
            <Tile label="AI Overviews shown" value={s.summary.ai_overview_present} />
            <Tile label="Cited in AI Overview" value={s.summary.ai_overview_cited} accent="primary" />
            <Tile label="Cited in AI Mode" value={s.summary.ai_mode_cited} accent="primary" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Keyword AI citations — cited first</CardTitle>
            </CardHeader>
            <CardBody className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Keyword</th>
                    <th className="px-4 py-2.5 font-medium">AI Overview</th>
                    <th className="px-4 py-2.5 font-medium">AI Mode</th>
                    <th className="px-4 py-2.5 font-medium">Also cited by Google AI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.keyword} className="hover:bg-surface-2">
                      <td className="px-4 py-2.5 font-medium text-text">{r.keyword}</td>
                      <td className="px-4 py-2.5"><CiteCell present={r.ai_overview_present} cite={r.ai_overview} /></td>
                      <td className="px-4 py-2.5">
                        {s.include_ai_mode ? <CiteCell present={r.ai_mode_present} cite={r.ai_mode} /> : <span className="inline-flex items-center text-text-muted"><Minus size={13} /></span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {r.cited_domains.length === 0 ? (
                          <span className="text-text-muted">—</span>
                        ) : (
                          <span className="flex flex-wrap gap-1">
                            {r.cited_domains.slice(0, 8).map((d) => (
                              <span key={d} className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[11px] text-text-muted">{d}</span>
                            ))}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </div>
      )}

      <div className="mt-5 space-y-5">
        {/* 1 — LLM mentions of the domain across AI answers */}
        <Card>
          <CardHeader className="flex items-center justify-between gap-3">
            <CardTitle>LLM mentions</CardTitle>
            <div className="flex items-center gap-2">
              {mentions.data && <CacheBadge meta={mentions.data.meta} />}
              <Button
                variant="secondary"
                size="sm"
                onClick={runMentions}
                loading={mentions.isPending}
                disabled={!domain.trim()}
              >
                Run
              </Button>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-text-muted">
              How often LLMs mention {domain.trim() || "your domain"} in their answers, and the AI search volume behind those prompts.
            </p>
            {mentions.isPending && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                </div>
                <Skeleton className="h-24" />
              </div>
            )}
            {mentions.isError && <p className="text-sm text-danger">{apiErrorMessage(mentions.error)}</p>}
            {!mentions.isPending && mentions.data && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-md bg-surface-2 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Mentions</p>
                    <p className="mt-1 font-mono text-2xl text-primary">{fmtInt(mentions.data.mentions)}</p>
                  </div>
                  <div className="rounded-md bg-surface-2 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-text-muted">AI search volume</p>
                    <p className="mt-1 font-mono text-2xl text-text">{fmtInt(mentions.data.ai_search_volume)}</p>
                  </div>
                </div>
                {(mentions.data.dimensions.location ?? []).length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                        <tr>
                          <th className="px-3 py-2 font-medium">Location</th>
                          <th className="px-3 py-2 font-medium">Mentions</th>
                          <th className="px-3 py-2 font-medium">AI volume</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(mentions.data.dimensions.location ?? []).map((row) => (
                          <tr key={String(row.key)} className="hover:bg-surface-2">
                            <td className="px-3 py-2 font-medium text-text">{locationLabel(row.key)}</td>
                            <td className="px-3 py-2 font-mono text-text">{fmtInt(row.mentions)}</td>
                            <td className="px-3 py-2 font-mono text-text">{fmtInt(row.ai_search_volume)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>

        {/* 2 — AI (LLM prompt) search volume for the entered keywords */}
        <Card>
          <CardHeader className="flex items-center justify-between gap-3">
            <CardTitle>AI search volume</CardTitle>
            <div className="flex items-center gap-2">
              {aiVolume.data && <CacheBadge meta={aiVolume.data.meta} />}
              <Button
                variant="secondary"
                size="sm"
                onClick={runAiVolume}
                loading={aiVolume.isPending}
                disabled={keywords.length === 0}
              >
                Run
              </Button>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-text-muted">
              How often your keywords are asked to LLMs each month — the AI-era counterpart to Google search volume.
            </p>
            {aiVolume.isPending && (
              <div className="space-y-2">
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
              </div>
            )}
            {aiVolume.isError && <p className="text-sm text-danger">{apiErrorMessage(aiVolume.error)}</p>}
            {!aiVolume.isPending && aiVolume.data && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">Keyword</th>
                      <th className="px-3 py-2 font-medium">AI volume/mo</th>
                      <th className="px-3 py-2 font-medium">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {aiVolume.data.rows.map((row, i) => (
                      <tr key={row.keyword ?? i} className="hover:bg-surface-2">
                        <td className="px-3 py-2 font-medium text-text">{row.keyword ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-text">
                          {row.ai_search_volume === null ? "—" : fmtInt(row.ai_search_volume)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="h-6 w-24">
                            {row.monthly.length > 1 && (
                              <AreaChart values={trendValues(row)} tone="violet" height={24} id={`aivol-${i}`} />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        {/* 3 — Ask a live LLM and see whether the domain shows up in the answer */}
        <Card>
          <CardHeader className="flex items-center justify-between gap-3">
            <CardTitle>Ask an LLM</CardTitle>
            {ask.data && (
              <div className="flex items-center gap-2">
                {ask.data.model && <Badge tone="neutral">{ask.data.model}</Badge>}
                <CacheBadge meta={ask.data.meta} />
              </div>
            )}
          </CardHeader>
          <CardBody className="space-y-3">
            <p className="text-sm text-text-muted">
              Send a real prompt to an LLM and read the raw answer — the fastest way to see if your brand comes up.
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="e.g. best electric scooter brands in India"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Select value={model} onChange={(e) => setModel(e.target.value)} aria-label="Model">
                <option value="gpt-4o-mini">gpt-4o-mini</option>
                <option value="gpt-4o">gpt-4o</option>
              </Select>
              <Button onClick={runAsk} loading={ask.isPending} disabled={!prompt.trim()}>
                {!ask.isPending && <Bot size={16} />} Ask
              </Button>
            </div>
            {ask.isPending && (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            )}
            {ask.isError && <p className="text-sm text-danger">{apiErrorMessage(ask.error)}</p>}
            {!ask.isPending && ask.data && (
              <div className="space-y-2">
                {domain.trim() &&
                  (ask.data.answer.toLowerCase().includes(domain.trim().toLowerCase()) ? (
                    <Badge tone="success">
                      <Check size={12} /> your domain is mentioned
                    </Badge>
                  ) : (
                    <Badge tone="neutral">not mentioned in this answer</Badge>
                  ))}
                <div className="whitespace-pre-wrap rounded-md bg-surface-2 p-4 text-sm text-text">
                  {ask.data.answer}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
