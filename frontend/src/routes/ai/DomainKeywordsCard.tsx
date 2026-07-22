import { Search } from "lucide-react";
import { useState } from "react";

import { apiErrorMessage } from "@/api/client";
import { type useDomainKeywords, type DomainKeywordRow } from "@/api/hooks/useAiVisibility";
import { CacheBadge } from "@/components/shared/CacheBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtInt } from "@/lib/format";

/** google_ai_overview -> "AI Overview". The raw model names are API-shaped. */
const PLATFORM_LABEL: Record<string, string> = {
  google_ai_overview: "AI Overview",
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  gemini: "Gemini",
  copilot: "Copilot",
  claude: "Claude",
};
const label = (p: string) => PLATFORM_LABEL[p] ?? p.replace(/_/g, " ");

const columns: Column<DomainKeywordRow>[] = [
  {
    key: "question",
    header: "Question asked",
    sortValue: (r) => r.question,
    render: (r) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-text">{r.question}</p>
        {r.answer_snippet && (
          <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">{r.answer_snippet}</p>
        )}
      </div>
    ),
    csvValue: (r) => r.question,
  },
  {
    key: "ai_search_volume",
    header: "AI volume",
    align: "right",
    mono: true,
    sortValue: (r) => r.ai_search_volume,
    render: (r) => fmtInt(r.ai_search_volume),
  },
  {
    key: "platforms",
    header: "Seen on",
    sortValue: (r) => r.platforms.join(","),
    render: (r) => (
      <div className="flex flex-wrap gap-1">
        {(r.platforms.length ? r.platforms : [r.platform]).filter(Boolean).map((p) => (
          <Badge key={p} tone="info">{label(p)}</Badge>
        ))}
      </div>
    ),
    csvValue: (r) => r.platforms.join("; "),
  },
  {
    key: "source_count",
    header: "Sources",
    align: "right",
    mono: true,
    sortValue: (r) => r.source_count,
    render: (r) => (r.source_count ? String(r.source_count) : "—"),
  },
];

/**
 * Reverse keyword discovery: which questions surface this domain in AI answers.
 *
 * The opposite of the citation check above it — that tests keywords you already
 * suspect, this finds the ones you would never think to test. Against
 * ahrefs.com it returns questions like "9xmovies into", which no brainstorm
 * produces.
 *
 * Never fires automatically. The call is ~11c, roughly ten times a keyword
 * lookup, so it stays behind an explicit click even though every other section
 * on this page piggybacks on the main run.
 */
export function DomainKeywordsCard({
  domain, live, dk,
}: {
  domain: string;
  live: boolean;
  /** Owned by the page, not this card, so the page-level Excel export can
   *  include these rows — they are otherwise the one dataset the workbook
   *  would silently miss. */
  dk: ReturnType<typeof useDomainKeywords>;
}) {
  const [ran, setRan] = useState(false);

  const run = () => {
    const d = domain.trim();
    if (!d || dk.isPending) return;
    setRan(true);
    dk.mutate({ domain: d, limit: 100, force_live: live });
  };

  const data = dk.data;
  // Upstream nearly always has far more than one call returns, and saying "16
  // results" when there are 15,941 would misrepresent the domain's footprint.
  const truncated = data && data.total_count > data.returned;

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>Questions that surface this domain</CardTitle>
        <div className="flex items-center gap-2">
          {data && <CacheBadge meta={data.meta} />}
          <Button variant="secondary" size="sm" onClick={run} loading={dk.isPending} disabled={!domain.trim()}>
            {!dk.isPending && <Search size={14} />} Find keywords
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm text-text-muted">
          Prompts people actually ask AI engines where{" "}
          <span className="font-medium text-text">{domain.trim() || "your domain"}</span> appears in
          the answer — discovered, not guessed. Uses one billed lookup per run.
        </p>

        {dk.isError && <p className="text-sm text-danger">{apiErrorMessage(dk.error)}</p>}
        {dk.isPending && <Skeleton className="h-64 w-full" />}

        {!dk.isPending && data && (
          data.rows.length === 0 ? (
            <EmptyState
              title="No AI mentions found"
              hint="This domain doesn't appear in the AI answers indexed for it yet. Larger, more-cited domains return the most."
            />
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                <span className="font-semibold text-text">
                  {fmtInt(data.rows.length)} question{data.rows.length === 1 ? "" : "s"}
                </span>
                {truncated && (
                  <span className="text-text-muted">
                    of {fmtInt(data.total_count)} found upstream — showing the first {fmtInt(data.returned)}
                  </span>
                )}
                {data.returned > data.rows.length && (
                  <span className="text-text-muted">
                    · {data.returned - data.rows.length} near-duplicate
                    {data.returned - data.rows.length === 1 ? "" : "s"} merged
                  </span>
                )}
              </div>
              <DataTable columns={columns} rows={data.rows} csvName={`ai-keywords-${data.domain}`} />
            </>
          )
        )}

        {!dk.isPending && !data && !dk.isError && (
          <p className="text-xs text-text-muted">
            {ran ? "" : "Enter a domain above, then run this to see what it already ranks for in AI answers."}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
