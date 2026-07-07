import { Bot, Check, Minus, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { apiErrorMessage } from "@/api/client";
import { useAiVisibilityStatus, useStartAiVisibility } from "@/api/hooks/useAiVisibility";
import { LocationLanguagePicker } from "@/components/shared/LocationLanguagePicker";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { fmtInt } from "@/lib/format";
import type { AiCitation, AiKeywordRow } from "@/types";

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
    </div>
  );
}
