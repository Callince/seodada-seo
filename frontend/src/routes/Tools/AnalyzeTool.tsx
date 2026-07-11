import {
  FileSearch,
  Heading,
  Image as ImageIcon,
  Link2,
  Network,
  RefreshCw,
  Search,
  Tags,
  type LucideIcon,
} from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { apiErrorMessage } from "@/api/client";
import {
  useAnalyzePage,
  useAnalyzeSitemap,
  type Check,
  type PageAnalysis,
  type SitemapAnalysis,
} from "@/api/hooks/useAnalyze";
import { type Tone } from "@/components/public/landingKit";
import { PageHeader } from "@/components/shared/states";
import { usePersistedState } from "@/lib/persist";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

export type Tool = "url" | "keyword" | "heading" | "image" | "meta" | "sitemap";

// d3 graph is heavy + only used by the sitemap tool — load its chunk on demand.
const SitemapGraph = lazy(() => import("./SitemapGraph").then((m) => ({ default: m.SitemapGraph })));

function sitemapDomain(data: SitemapAnalysis): string {
  const src = data.sitemaps_found[0] || data.sample_urls[0] || "";
  try {
    return new URL(src).hostname;
  } catch {
    return "site";
  }
}

export const TOOL_META: Record<Tool, { title: string; subtitle: string; icon: LucideIcon; tone: Tone }> = {
  url: { title: "URL Analysis", subtitle: "Structure, status, redirects, links, canonical & robots.", icon: Link2, tone: "blue" },
  keyword: { title: "Keyword Analysis", subtitle: "Word count and keyword density of the page's content.", icon: Search, tone: "teal" },
  heading: { title: "Heading Analysis", subtitle: "H1–H6 hierarchy, counts, and structure issues.", icon: Heading, tone: "emerald" },
  image: { title: "Image Analysis", subtitle: "Every image and whether it has descriptive alt text.", icon: ImageIcon, tone: "amber" },
  meta: { title: "Meta Analysis", subtitle: "Title, description, canonical, viewport, Open Graph & Twitter.", icon: Tags, tone: "cyan" },
  sitemap: { title: "Sitemap Analysis", subtitle: "Discover the XML sitemap(s) and count indexed URLs.", icon: Network, tone: "violet" },
};

const CHECK_TONE: Record<string, "success" | "warning" | "danger"> = {
  ok: "success",
  too_short: "warning",
  too_long: "warning",
  missing: "danger",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-text-muted">{label}</span>
      <span className="text-right font-medium text-text">{value}</span>
    </div>
  );
}

const yn = (b: boolean) => (b ? "Yes" : "No");

function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardBody className="text-center">
        <div className="text-2xl font-extrabold text-text">{value}</div>
        <div className="text-xs text-text-muted">{label}</div>
      </CardBody>
    </Card>
  );
}

const STATUS_TONE = { ok: "success", warning: "warning", danger: "danger" } as const;
const STATUS_MARK = { ok: "✓", warning: "!", danger: "✕" } as const;

/** SEO check list — each row a pass/warn/fail verdict + explanation. */
function ChecksCard({ checks }: { checks: Check[] }) {
  const fails = checks.filter((c) => c.status !== "ok").length;
  return (
    <Card>
      <CardBody className="space-y-0.5">
        <p className="mb-1 text-sm font-semibold text-text">
          SEO checks{" "}
          <span className="font-normal text-text-muted">
            ({checks.length - fails}/{checks.length} passed)
          </span>
        </p>
        {checks.map((c) => (
          <div key={c.label} className="flex items-start gap-3 border-b border-border/60 py-2 text-sm last:border-0">
            <Badge tone={STATUS_TONE[c.status]}>{STATUS_MARK[c.status]}</Badge>
            <div className="min-w-0">
              <span className="font-medium text-text">{c.label}</span>
              <span className="ml-2 text-text-muted">{c.detail}</span>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

/** A clickable stat card — tap to filter the list below to that subset. */
function FilterTile({ label, value, active, onClick }: { label: string; value: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl border bg-surface p-3 text-center transition-all hover:-translate-y-0.5 hover:border-[color:var(--section)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--section)] ${active ? "border-[color:var(--section)] ring-2 ring-[color:var(--section)]" : "border-border"}`}
    >
      <div className="text-2xl font-extrabold text-text">{value}</div>
      <div className="text-xs text-text-muted">{label}</div>
    </button>
  );
}

type LinkFilter = "all" | "internal" | "external" | "nofollow";

/** Internal/external/nofollow counts as clickable filters + the link table. */
function LinksCard({ links }: { links: PageAnalysis["links"] }) {
  const [filter, setFilter] = useState<LinkFilter>("all");
  const preds: Record<LinkFilter, (l: PageAnalysis["links"]["samples"][number]) => boolean> = {
    all: () => true,
    internal: (l) => l.internal,
    external: (l) => !l.internal,
    nofollow: (l) => l.nofollow,
  };
  const tiles: { key: LinkFilter; label: string; value: number }[] = [
    { key: "all", label: "Total links", value: links.total },
    { key: "internal", label: "Internal", value: links.internal_count },
    { key: "external", label: "External", value: links.external_count },
    { key: "nofollow", label: "Nofollow", value: links.nofollow_count },
  ];
  const samples = links.samples.filter(preds[filter]);
  const toggle = (k: LinkFilter) => setFilter((f) => (f === k ? "all" : k));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <FilterTile key={t.key} label={t.label} value={t.value} active={filter === t.key} onClick={() => toggle(t.key)} />
        ))}
      </div>
      {samples.length > 0 ? (
        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
                  <th className="py-2 pl-4 pr-3">Anchor</th>
                  <th className="py-2 pr-3">URL</th>
                  <th className="py-2 pr-4">Type</th>
                </tr>
              </thead>
              <tbody>
                {samples.map((l, i) => (
                  <tr key={i} className="border-b border-border/60">
                    <td className="max-w-[10rem] truncate py-2 pl-4 pr-3 text-text">
                      {l.anchor || <span className="text-text-muted">—</span>}
                    </td>
                    <td className="max-w-xs truncate py-2 pr-3">
                      <a href={l.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{l.url}</a>
                    </td>
                    <td className="py-2 pr-4">
                      <span className="flex gap-1">
                        <Badge tone={l.internal ? "info" : "neutral"}>{l.internal ? "internal" : "external"}</Badge>
                        {l.nofollow && <Badge tone="warning">nofollow</Badge>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ) : (
        <p className="text-sm text-text-muted">No links match this filter.</p>
      )}
    </div>
  );
}

type DensityRow = { phrase: string; count: number; density: number };

/** Keyword/phrase density with a relative bar per row. */
function DensityTable({ title, rows }: { title: string; rows: DensityRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.density));
  return (
    <Card>
      <CardBody>
        <p className="mb-3 text-sm font-semibold text-text">{title}</p>
        {rows.length ? (
          <div className="space-y-2.5">
            {rows.map((r) => (
              <div key={r.phrase} className="text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-text">{r.phrase}</span>
                  <span className="shrink-0 font-mono text-xs text-text-muted">{r.count}× · {r.density.toFixed(2)}%</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-app-bg">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(r.density / max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">Not enough page content to analyze.</p>
        )}
      </CardBody>
    </Card>
  );
}

/** Heading audit — the H1–H6 count chips are clickable; tapping one filters the
 *  document outline to just that level. */
function HeadingResult({ h }: { h: PageAnalysis["headings"] }) {
  const [level, setLevel] = useState(0); // 0 = all levels
  const items = level === 0 ? h.items : h.items.filter((i) => i.level === level);
  const toggle = (lvl: number) => setLevel((cur) => (cur === lvl ? 0 : lvl));

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">H1</p>
          {h.h1_text ? <p className="text-text">{h.h1_text}</p> : <p className="text-danger">No H1 tag on the page.</p>}
        </CardBody>
      </Card>
      <Card>
        <CardBody className="flex flex-wrap gap-2">
          {Object.entries(h.counts).map(([lvl, n]) => {
            const num = Number(lvl.slice(1));
            const active = level === num;
            return (
              <button
                key={lvl}
                type="button"
                disabled={n === 0}
                aria-pressed={active}
                onClick={() => toggle(num)}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "section-gradient text-white"
                    : lvl === "h1" && n !== 1
                      ? "bg-danger/10 text-danger hover:bg-danger/20"
                      : "bg-app-bg hover:bg-[color:var(--section-soft)]"
                } ${n === 0 ? "cursor-default opacity-40" : ""}`}
              >
                <span className={`font-semibold uppercase ${active ? "text-white" : "text-[color:var(--section)]"}`}>{lvl}</span> {n}
              </button>
            );
          })}
        </CardBody>
      </Card>
      {h.issues.length > 0 && (
        <Card>
          <CardBody className="space-y-1.5">
            {h.issues.map((i) => (
              <p key={i} className="text-sm text-warning">⚠ {i}</p>
            ))}
          </CardBody>
        </Card>
      )}
      <Card>
        <CardBody className="space-y-1">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-text">
            Document outline
            {level > 0 && (
              <span className="font-normal text-text-muted">
                — H{level} only ·{" "}
                <button type="button" className="text-primary hover:underline" onClick={() => setLevel(0)}>show all</button>
              </span>
            )}
          </p>
          {items.map((item, idx) => (
            <div key={idx} className="flex gap-3 text-sm" style={{ paddingLeft: `${(item.level - 1) * 16}px` }}>
              <span className="w-6 shrink-0 font-mono text-xs uppercase text-primary">H{item.level}</span>
              <span className="text-text">{item.text}</span>
            </div>
          ))}
          {!items.length && <p className="text-sm text-text-muted">No H{level} headings on this page.</p>}
        </CardBody>
      </Card>
    </div>
  );
}

type ImgFilter = "all" | "with_alt" | "missing_alt" | "lazy" | "sized";

/** Image audit — clickable stat cards filter the per-image list below. */
function ImageResult({ im }: { im: PageAnalysis["images"] }) {
  const [filter, setFilter] = useState<ImgFilter>("all");
  const preds: Record<ImgFilter, (i: PageAnalysis["images"]["items"][number]) => boolean> = {
    all: () => true,
    with_alt: (i) => i.has_alt,
    missing_alt: (i) => !i.has_alt,
    lazy: (i) => i.lazy,
    sized: (i) => i.has_dimensions,
  };
  const tiles: { key: ImgFilter; label: string; value: number }[] = [
    { key: "all", label: "Total", value: im.total },
    { key: "with_alt", label: "With alt", value: im.with_alt },
    { key: "missing_alt", label: "Missing alt", value: im.missing_alt },
    { key: "lazy", label: "Lazy-loaded", value: im.lazy_count },
    { key: "sized", label: "With size", value: im.dimensioned_count },
  ];
  const items = im.items.filter(preds[filter]);
  const toggle = (k: ImgFilter) => setFilter((f) => (f === k ? "all" : k));
  const activeLabel = tiles.find((t) => t.key === filter)?.label.toLowerCase();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((t) => (
          <FilterTile key={t.key} label={t.label} value={t.value} active={filter === t.key} onClick={() => toggle(t.key)} />
        ))}
      </div>
      <p className="text-sm text-text-muted">
        {filter === "all" ? (
          `Showing all ${items.length} images — tap a card to filter.`
        ) : (
          <>
            Showing {items.length} “{activeLabel}” ·{" "}
            <button type="button" className="text-primary hover:underline" onClick={() => setFilter("all")}>show all</button>
          </>
        )}
      </p>
      <Card>
        <CardBody className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-start gap-3 border-b border-border/60 pb-3 text-sm last:border-0 last:pb-0">
              <img src={item.src} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded border border-border bg-app-bg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-text-muted">{item.src}</p>
                <p className="mt-0.5 break-words text-text">
                  {item.has_alt ? item.alt : <span className="text-danger">missing alt text</span>}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge tone={item.has_alt ? "success" : "danger"}>{item.has_alt ? "alt" : "no alt"}</Badge>
                <span className="text-xs text-text-muted">
                  {item.has_dimensions ? `${item.width}×${item.height}` : "no size"}
                </span>
                {item.lazy && <span className="text-xs text-text-muted">lazy</span>}
              </div>
            </div>
          ))}
          {!items.length && <p className="text-sm text-text-muted">No images to show.</p>}
        </CardBody>
      </Card>
    </div>
  );
}

/** A meta title/description field: label + length/check badge + full (wrapped) text. */
function MetaField({ label, text, length, check }: { label: string; text: string; length: number; check: string }) {
  return (
    <div className="border-b border-border/60 pb-3 last:border-0 last:pb-0">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-sm text-text-muted">{label}</span>
        <Badge tone={CHECK_TONE[check] ?? "success"}>{length} chars · {check.replace(/_/g, " ")}</Badge>
      </div>
      <p className="break-words text-sm text-text">{text || <span className="text-text-muted">— none —</span>}</p>
    </div>
  );
}

function schemaLabel(block: unknown): string {
  if (block && typeof block === "object") {
    const t = (block as Record<string, unknown>)["@type"];
    if (typeof t === "string") return t;
    if (Array.isArray(t)) return t.filter((x) => typeof x === "string").join(", ");
    if ((block as Record<string, unknown>)["@graph"]) return "@graph";
  }
  return "";
}

/** Renders the page's Schema.org structured data (JSON-LD): type badges + raw blocks. */
function SchemaCard({ types = [], blocks = [] }: { types?: string[]; blocks?: unknown[] }) {
  return (
    <Card>
      <CardBody>
        <p className="mb-3 text-sm font-semibold text-text">
          Schema.org structured data{" "}
          <span className="font-normal text-text-muted">({types.length} type{types.length === 1 ? "" : "s"})</span>
        </p>
        {blocks.length ? (
          <>
            {types.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {types.map((t) => <Badge key={t} tone="info">{t}</Badge>)}
              </div>
            )}
            <div className="space-y-2">
              {blocks.map((b, i) => (
                <details key={i} className="rounded-lg border border-border">
                  <summary className="cursor-pointer px-3 py-2 text-sm text-text">
                    Block {i + 1}
                    {schemaLabel(b) && <span className="text-text-muted"> · {schemaLabel(b)}</span>}
                  </summary>
                  <pre className="max-h-80 overflow-auto border-t border-border bg-app-bg px-3 py-2 text-xs text-text-muted">
                    {JSON.stringify(b, null, 2)}
                  </pre>
                </details>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-text-muted">No JSON-LD structured data found on this page.</p>
        )}
      </CardBody>
    </Card>
  );
}

/** Renders the actual Open Graph / Twitter tags (key → value), with image previews. */
function TagCard({ title, prefix, tags }: { title: string; prefix: string; tags: [string, string][] }) {
  return (
    <Card>
      <CardBody>
        <p className="mb-3 text-sm font-semibold text-text">
          {title} <span className="font-normal text-text-muted">({tags.length})</span>
        </p>
        {tags.length ? (
          <div className="space-y-2.5">
            {tags.map(([k, v]) => (
              <div key={k} className="flex flex-col gap-1 border-b border-border/60 pb-2.5 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:gap-3">
                <span className="shrink-0 font-mono text-xs text-primary sm:w-44">{prefix}{k}</span>
                {/image/i.test(k) && /^https?:\/\//i.test(v) ? (
                  <img src={v} alt="" className="h-20 max-w-full rounded border border-border object-cover" loading="lazy" />
                ) : (
                  <span className="break-all text-sm text-text">{v}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">No {title} tags found on this page.</p>
        )}
      </CardBody>
    </Card>
  );
}

function PageResult({ tool, data }: { tool: Tool; data: PageAnalysis }) {
  if (tool === "url") {
    const u = data.url;
    return (
      <div className="space-y-4">
        <ChecksCard checks={u.checks} />
        <Card>
          <CardBody>
            <Row label="Final URL" value={<a href={u.final_url} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">{u.final_url}</a>} />
            <Row label="Status code" value={<Badge tone={u.status_code < 400 ? "success" : "danger"}>{u.status_code}</Badge>} />
            <Row label="HTTPS" value={<Badge tone={u.https ? "success" : "danger"}>{yn(u.https)}</Badge>} />
            <Row label="Redirected" value={yn(u.redirected)} />
            <Row label="Slug" value={u.slug || "—"} />
            <Row label="URL length" value={`${u.length} chars`} />
            <Row label="Path depth" value={u.path_depth} />
            <Row label="Query string" value={yn(u.has_query)} />
            <Row label="Canonical" value={u.canonical ? <a href={u.canonical} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">{u.canonical}</a> : "—"} />
            <Row label="Robots meta" value={u.robots_meta || "—"} />
          </CardBody>
        </Card>
        <LinksCard links={data.links} />
      </div>
    );
  }
  if (tool === "keyword") {
    const k = data.keywords;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Words" value={k.word_count} />
          <StatTile label="Unique words" value={k.unique_words} />
          <StatTile label="Reading time" value={`${k.reading_time_min} min`} />
        </div>
        <DensityTable title="Top keywords" rows={k.top_keywords} />
        {k.top_phrases.length > 0 && <DensityTable title="Top phrases (2–3 words)" rows={k.top_phrases} />}
      </div>
    );
  }
  if (tool === "heading") {
    return <HeadingResult h={data.headings} />;
  }
  if (tool === "image") {
    return <ImageResult im={data.images} />;
  }
  // meta
  const m = data.meta;
  const og = Object.entries(m.open_graph) as [string, string][];
  const tw = Object.entries(m.twitter) as [string, string][];
  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-3">
          <MetaField label="Title" text={m.title} length={m.title_length} check={m.title_check} />
          <MetaField label="Description" text={m.description} length={m.description_length} check={m.description_check} />
          <Row
            label="Canonical"
            value={
              m.canonical ? (
                <a href={m.canonical} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">
                  {m.canonical}
                </a>
              ) : "—"
            }
          />
          <Row label="Viewport" value={m.viewport ? <span className="break-all">{m.viewport}</span> : <Badge tone="danger">missing</Badge>} />
          <Row label="Robots" value={m.robots || "—"} />
          <Row label="Charset" value={m.charset || "—"} />
          <Row label="Language" value={m.language || "—"} />
        </CardBody>
      </Card>
      <TagCard title="Open Graph" prefix="og:" tags={og} />
      <TagCard title="Twitter Card" prefix="twitter:" tags={tw} />
      <SchemaCard types={m.schema_types ?? []} blocks={m.schema_blocks ?? []} />
    </div>
  );
}

function SitemapResult({ data }: { data: SitemapAnalysis }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Sitemaps" value={data.sitemaps_found.length} />
        <StatTile label="Total URLs" value={data.total_urls.toLocaleString()} />
        <StatTile label="Index" value={data.is_index ? "Yes" : "No"} />
      </div>
      <Card>
        <CardBody className="space-y-1">
          <p className="mb-2 text-sm font-semibold text-text">Sitemaps found</p>
          {data.sitemaps_found.map((u) => (
            <a key={u} href={u} target="_blank" rel="noreferrer" className="block truncate text-sm text-primary hover:underline">{u}</a>
          ))}
        </CardBody>
      </Card>
      {data.child_sitemaps.length > 0 && (
        <Card>
          <CardBody className="space-y-1">
            <p className="mb-2 text-sm font-semibold text-text">Child sitemaps ({data.child_sitemaps.length})</p>
            {data.child_sitemaps.map((u) => (
              <a key={u} href={u} target="_blank" rel="noreferrer" className="block truncate text-sm text-text-muted hover:text-primary">{u}</a>
            ))}
          </CardBody>
        </Card>
      )}
      {data.sample_urls.length > 1 && (
        <Suspense fallback={<Card><CardBody className="py-16 text-center text-sm text-text-muted">Loading structure graph…</CardBody></Card>}>
          <SitemapGraph urls={data.sample_urls} domain={sitemapDomain(data)} total={data.total_urls} />
        </Suspense>
      )}
      <Card>
        <CardBody className="space-y-1">
          <p className="mb-2 text-sm font-semibold text-text">Sample URLs ({Math.min(data.sample_urls.length, 50)})</p>
          {data.sample_urls.slice(0, 50).map((u) => (
            <p key={u} className="truncate text-sm text-text-muted">{u}</p>
          ))}
          {!data.sample_urls.length && <p className="text-sm text-text-muted">No URLs found in the sitemap(s).</p>}
        </CardBody>
      </Card>
    </div>
  );
}

export default function AnalyzeTool({ tool }: { tool: Tool }) {
  const meta = TOOL_META[tool];
  // Persisted so results survive navigating away and back (per tool).
  const [url, setUrl] = usePersistedState<string>(`analyze.${tool}.url`, "");
  const [pageResult, setPageResult] = usePersistedState<PageAnalysis | null>(`analyze.${tool}.page`, null);
  const [sitemapResult, setSitemapResult] = usePersistedState<SitemapAnalysis | null>(`analyze.${tool}.sitemap`, null);
  const page = useAnalyzePage();
  const sitemap = useAnalyzeSitemap();
  const run = tool === "sitemap" ? sitemap : page;

  const analyze = (refresh = false) => {
    const u = url.trim();
    if (!u) return;
    if (tool === "sitemap") sitemap.mutate({ url: u, refresh }, { onSuccess: setSitemapResult });
    else page.mutate({ url: u, refresh }, { onSuccess: setPageResult });
  };
  const hasResult = tool === "sitemap" ? !!sitemapResult : !!pageResult;

  return (
    <div>
      <PageHeader title={meta.title} subtitle={meta.subtitle} />
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
            <Button type="submit" disabled={run.isPending || !url.trim()}>
              {run.isPending ? "Analyzing…" : "Analyze"}
            </Button>
            {hasResult && (
              <Button
                type="button"
                variant="secondary"
                title="Bypass the cache and fetch the page live"
                disabled={run.isPending || !url.trim()}
                onClick={() => analyze(true)}
              >
                <RefreshCw size={15} className={run.isPending ? "animate-spin" : ""} /> Refresh
              </Button>
            )}
          </form>
          {run.isError && <p className="mt-3 text-sm text-danger">{apiErrorMessage(run.error)}</p>}
          {tool !== "sitemap" && pageResult?.fetch && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-text-muted">
              <Badge tone={pageResult.fetch.from_cache ? "success" : "info"}>
                {pageResult.fetch.from_cache ? "cached" : "live"}
              </Badge>
              {pageResult.fetch.from_cache
                ? "Served from cache (revalidated) — hit Refresh to force a live fetch."
                : "Freshly fetched."}
            </p>
          )}
        </CardBody>
      </Card>

      {tool === "sitemap"
        ? sitemapResult && <SitemapResult data={sitemapResult} />
        : pageResult && <PageResult tool={tool} data={pageResult} />}
    </div>
  );
}
