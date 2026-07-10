import {
  color as d3color,
  drag as d3drag,
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceRadial,
  forceSimulation,
  hierarchy,
  type HierarchyNode,
  pack as d3pack,
  select,
  tree as d3tree,
  zoom as d3zoom,
  zoomIdentity,
} from "d3";
import { Circle, Expand, Minus, Network, Plus, Table2, Tag, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

const ROOT_COLOR = "#273879";
const PALETTE = [
  "#0f74b2", "#22c3ee", "#059669", "#f59e0b", "#8b5cf6", "#ef4444",
  "#14b8a6", "#ec4899", "#6366f1", "#84cc16", "#f97316", "#06b6d4",
];

type Raw = { name: string; url: string | null; seg: string; children: Raw[] };
type Datum = Raw & { section: string };
type Node = HierarchyNode<Datum> & { x: number; y: number; r?: number; fx?: number | null; fy?: number | null; polar?: { angle: number; radius: number } | null };

/** Build a path hierarchy from a flat list of sitemap URLs. */
function buildTree(urls: string[], domain: string): Raw {
  const root: Raw & { _c: Record<string, Raw & { _c: Record<string, unknown> }> } =
    { name: domain || "site", url: null, seg: "", children: [], _c: {} } as never;
  for (const raw of urls) {
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      continue;
    }
    const segs = u.pathname.split("/").filter(Boolean);
    if (!segs.length) {
      root.url = raw;
      continue;
    }
    let node = root as never as { _c: Record<string, Raw & { _c: Record<string, unknown> }>; url: string | null };
    segs.forEach((seg, i) => {
      const key = seg.toLowerCase();
      if (!node._c[key]) {
        node._c[key] = { name: decodeURIComponent(seg), seg, url: null, children: [], _c: {} } as never;
      }
      node = node._c[key] as never;
      if (i === segs.length - 1) node.url = raw;
    });
  }
  const toArr = (n: Raw & { _c?: Record<string, unknown> }): Raw => ({
    name: n.name,
    url: n.url,
    seg: n.seg,
    children: Object.values(n._c ?? {}).map((c) => toArr(c as Raw & { _c?: Record<string, unknown> })),
  });
  return toArr(root as never);
}

interface FlatNode { id: number; name: string; url: string | null; section: string; depth: number; childCount: number; descendants: number }

export function SitemapGraph({ urls, domain, total }: { urls: string[]; domain: string; total?: number }) {
  const truncated = typeof total === "number" && total > urls.length;
  const graphRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const ctrl = useRef<ReturnType<typeof makeController> | null>(null);

  const [layout, setLayout] = useState<"radial" | "force" | "pack">("radial");
  const [view, setView] = useState<"graph" | "table">("graph");
  const [showLabels, setShowLabels] = useState(true);
  const [q, setQ] = useState("");
  const [section, setSection] = useState("all");
  const [selected, setSelected] = useState<FlatNode | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string; url: string; color: string } | null>(null);
  const [flat, setFlat] = useState<FlatNode[]>([]);
  const [sort, setSort] = useState<{ key: "url" | "depth" | "children"; dir: 1 | -1 }>({ key: "depth", dir: 1 });

  // Section colour map (built once per data set).
  const sections = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of flat) counts.set(f.section, (counts.get(f.section) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [flat]);
  const colorFor = useMemo(() => {
    const order = sections.map(([s]) => s);
    return (s: string) => (s === "root" ? ROOT_COLOR : PALETTE[Math.max(0, order.indexOf(s)) % PALETTE.length]);
  }, [sections]);

  // Build / rebuild the d3 graph when the URL set changes.
  useEffect(() => {
    if (!svgRef.current || !graphRef.current) return;
    const tree = buildTree(urls, domain);
    const root = hierarchy<Datum>(tree as Datum);
    root.descendants().forEach((d, i) => {
      (d as Node).x = 0;
      (d as Node).y = 0;
      d.data.section = d.depth === 0 ? "root" : (d.ancestors().find((a) => a.depth === 1)?.data.seg || d.data.seg);
      (d as unknown as { id: number }).id = i;
    });
    setFlat(
      root.descendants().map((d) => ({
        id: (d as unknown as { id: number }).id,
        name: d.data.name,
        url: d.data.url,
        section: d.data.section,
        depth: d.depth,
        childCount: d.children?.length ?? 0,
        descendants: d.descendants().length - 1,
      })),
    );
    const c = makeController(svgRef.current, graphRef.current, root as Node, {
      colorFor: (s: string) => (s === "root" ? ROOT_COLOR : PALETTE[0]), // replaced below
      onSelect: (n) => setSelected(n),
      onTooltip: (t) => setTooltip(t),
    });
    ctrl.current = c;
    return () => c.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls, domain]);

  // Keep the controller's colour function fresh, then (re)render on layout change.
  useEffect(() => {
    if (!ctrl.current) return;
    ctrl.current.setColor(colorFor);
    ctrl.current.render(layout, showLabels);
    const t = setTimeout(() => ctrl.current?.fit(), 120);
    return () => clearTimeout(t);
  }, [layout, showLabels, colorFor, flat]);

  useEffect(() => {
    ctrl.current?.filter(q.trim().toLowerCase(), section);
  }, [q, section]);

  // Returning to the graph after Table view: the container was display:none (0
  // size), so re-measure, redraw and fit now that it's visible again.
  useEffect(() => {
    if (view !== "graph" || !ctrl.current) return;
    ctrl.current.render(layout, showLabels);
    ctrl.current.filter(q.trim().toLowerCase(), section);
    const t = setTimeout(() => ctrl.current?.fit(), 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const tableRows = useMemo(() => {
    let rows = flat.filter((f) => f.depth > 0);
    if (section !== "all") rows = rows.filter((f) => f.section === section);
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      rows = rows.filter((f) => f.name.toLowerCase().includes(t) || (f.url ?? "").toLowerCase().includes(t));
    }
    return [...rows].sort((a, b) => {
      const va = sort.key === "url" ? a.url ?? a.name : sort.key === "depth" ? a.depth : a.childCount;
      const vb = sort.key === "url" ? b.url ?? b.name : sort.key === "depth" ? b.depth : b.childCount;
      return va < vb ? -sort.dir : va > vb ? sort.dir : 0;
    });
  }, [flat, section, q, sort]);

  const pill = (active: boolean) =>
    `flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
      active ? "bg-surface text-primary shadow-sm" : "text-text-muted hover:text-text"
    }`;

  return (
    <Card>
      <CardBody className="p-0">
        {/* Insights — section filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <span className="mr-auto flex items-center gap-2 text-sm font-semibold text-text">
            <Network size={15} className="text-primary" /> Site structure
            <span className="max-w-[220px] truncate font-normal text-text-muted">{domain}</span>
            {truncated && (
              <span className="font-normal text-text-muted">· showing {urls.length.toLocaleString()} of {total!.toLocaleString()}</span>
            )}
          </span>
          <button onClick={() => setSection("all")} className={`rounded-full px-3 py-1 text-xs font-semibold ${section === "all" ? "ring-2 ring-primary/40" : ""}`} style={{ background: "var(--app-bg)", color: "var(--text)" }}>
            {flat.length} pages
          </button>
          {sections.filter(([s]) => s !== "root").slice(0, 6).map(([s, n]) => (
            <button
              key={s}
              onClick={() => setSection(section === s ? "all" : s)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${section === s ? "ring-2 ring-primary/40" : ""}`}
              style={{ background: `${colorFor(s)}22`, color: colorFor(s) }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: colorFor(s) }} />
              /{s} <span className="tabular-nums opacity-70">{n}</span>
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search URLs…"
            className="min-w-[160px] flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
          <div className="inline-flex rounded-full bg-app-bg p-0.5">
            <button className={pill(layout === "radial")} onClick={() => setLayout("radial")}><Circle size={12} /> Radial</button>
            <button
              className={`${pill(layout === "force")} disabled:cursor-not-allowed disabled:opacity-40`}
              disabled={flat.length > 2500}
              title={flat.length > 2500 ? "Force layout is disabled for very large maps — use Radial or Pack" : "Physics layout — drag nodes"}
              onClick={() => setLayout("force")}
            >
              <Network size={12} /> Force
            </button>
            <button className={pill(layout === "pack")} onClick={() => setLayout("pack")}><Circle size={12} /> Pack</button>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowLabels((s) => !s)}><Tag size={13} /> Labels</Button>
          <Button variant="secondary" size="sm" onClick={() => ctrl.current?.fit()}><Expand size={13} /> Fit</Button>
          <Button variant="secondary" size="sm" onClick={() => setView((v) => (v === "graph" ? "table" : "graph"))}>
            {view === "graph" ? <><Table2 size={13} /> Table</> : <><Network size={13} /> Graph</>}
          </Button>
        </div>

        {/* Workspace */}
        <div className="relative flex" style={{ height: 520 }}>
          {/* Graph stays mounted (hidden in table view) so its d3 controller keeps a
              valid SVG ref — remounting would leave the controller drawing nowhere. */}
          <div ref={graphRef} className={`relative min-w-0 flex-1 overflow-hidden bg-app-bg/40 ${view === "table" ? "hidden" : ""}`}>
            <svg ref={svgRef} className="block h-full w-full cursor-grab active:cursor-grabbing" role="img" aria-label="Site structure graph" />
            <div className="absolute bottom-3 right-3 flex flex-col gap-1 rounded-lg border border-border bg-surface p-1 shadow-sm">
              <button className="grid h-8 w-8 place-items-center rounded text-text-muted hover:bg-app-bg hover:text-primary" onClick={() => ctrl.current?.zoomBy(1.4)} aria-label="Zoom in"><Plus size={15} /></button>
              <button className="grid h-8 w-8 place-items-center rounded text-text-muted hover:bg-app-bg hover:text-primary" onClick={() => ctrl.current?.zoomBy(0.7)} aria-label="Zoom out"><Minus size={15} /></button>
              <button className="grid h-8 w-8 place-items-center rounded text-text-muted hover:bg-app-bg hover:text-primary" onClick={() => ctrl.current?.resetZoom()} aria-label="Reset"><Expand size={15} /></button>
            </div>
          </div>
          {view === "table" && (
            <div className="min-w-0 flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-app-bg">
                  <tr className="text-left text-xs uppercase tracking-wider text-text-muted">
                    {([["url", "URL"], ["depth", "Depth"], ["children", "Children"]] as const).map(([k, label]) => (
                      <th key={k} className="cursor-pointer px-4 py-2 hover:text-primary"
                        onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : 1 }))}>
                        {label}{sort.key === k ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r) => (
                    <tr key={r.id} className="cursor-pointer border-b border-border/60 hover:bg-app-bg" onClick={() => setSelected(r)}>
                      <td className="max-w-[420px] truncate px-4 py-2 font-mono text-xs text-primary">{r.url || r.name}</td>
                      <td className="px-4 py-2 text-center tabular-nums text-text-muted">{r.depth}</td>
                      <td className="px-4 py-2 text-center tabular-nums text-text-muted">{r.childCount}</td>
                    </tr>
                  ))}
                  {!tableRows.length && <tr><td colSpan={3} className="py-8 text-center text-text-muted">No URLs match.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* Side panel */}
          {selected && (
            <aside className="flex w-full max-w-[340px] flex-col border-l border-border bg-surface">
              <div className="flex items-center justify-between gap-2 gradient-fill px-4 py-3 text-white">
                <h3 className="truncate text-sm font-semibold">{selected.name || "Page"}</h3>
                <button onClick={() => setSelected(null)} className="grid h-7 w-7 place-items-center rounded bg-white/15 hover:bg-white/30" aria-label="Close"><X size={14} /></button>
              </div>
              <div className="space-y-0.5 overflow-y-auto p-4 text-sm">
                <PanelRow label="URL" value={selected.url ? <a href={selected.url} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">{selected.url}</a> : "— (grouping node)"} />
                <PanelRow label="Section" value={<span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: colorFor(selected.section) }} />/{selected.section}</span>} />
                <PanelRow label="Depth" value={selected.depth} />
                <PanelRow label="Children" value={selected.childCount} />
                <PanelRow label="Total descendants" value={selected.descendants} />
                {selected.url && (
                  <a href={selected.url} target="_blank" rel="noreferrer" className="mt-3 block rounded-lg gradient-fill py-2 text-center text-xs font-semibold text-white">Open page ↗</a>
                )}
              </div>
            </aside>
          )}

          {/* Tooltip */}
          {tooltip && (
            <div className="pointer-events-none fixed z-50 max-w-[280px] rounded-md bg-[#0f172a] px-2.5 py-1.5 text-xs text-white shadow-lg" style={{ left: tooltip.x + 14, top: tooltip.y + 12 }}>
              <div className="flex items-center gap-1.5 font-semibold"><span className="h-2 w-2 rounded-full" style={{ background: tooltip.color }} />{tooltip.name}</div>
              {tooltip.url && <div className="truncate text-white/60">{tooltip.url}</div>}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function PanelRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <span className="shrink-0 text-text-muted">{label}</span>
      <span className="break-all text-right text-text">{value}</span>
    </div>
  );
}

/** Imperative d3 controller — owns the SVG graph (layouts, zoom, drag, filter). */
function makeController(
  svgEl: SVGSVGElement,
  graphEl: HTMLElement,
  root: Node,
  opts: {
    colorFor: (s: string) => string;
    onSelect: (n: FlatNode) => void;
    onTooltip: (t: { x: number; y: number; name: string; url: string; color: string } | null) => void;
  },
) {
  const svg = select(svgEl);
  svg.selectAll("*").remove();
  const g = svg.append("g");
  const nodes = root.descendants() as Node[];
  const size = { w: 1, h: 1 };
  let colorFor = opts.colorFor;
  let layout: "radial" | "force" | "pack" = "radial";
  let showLabels = true;
  let sim: ReturnType<typeof forceSimulation> | null = null;
  let center = { x: 0, y: 0 };
  let maxDepth = 0;

  const zoomB = d3zoom<SVGSVGElement, unknown>().scaleExtent([0.04, 8]).on("zoom", (e) => g.attr("transform", e.transform.toString()));
  svg.call(zoomB as never);

  const nodeR = (d: Node) => {
    if (layout === "pack" && d.r) return d.r;
    return Math.max(4, 9 - d.depth) + Math.min(6, Math.sqrt(d.data ? (d.descendants().length - 1) : 0));
  };
  const nodeColor = (d: Node) => (d.depth === 0 ? ROOT_COLOR : colorFor(d.data.section));

  function measure() {
    const rect = graphEl.getBoundingClientRect();
    size.w = Math.max(1, Math.floor(rect.width));
    size.h = Math.max(1, Math.floor(rect.height));
    svg.attr("viewBox", `0 0 ${size.w} ${size.h}`);
  }

  function layoutRadial() {
    const radius = Math.max(140, Math.min(size.w, size.h) / 2 - 60);
    d3tree<Datum>().size([2 * Math.PI, radius]).separation((a, b) => (a.parent === b.parent ? 1 : 2) / Math.max(1, a.depth))(root);
    root.descendants().forEach((d) => {
      const nd = d as Node;
      nd.polar = { angle: (d as Node).x, radius: (d as Node).y };
      const a = (d as Node).x - Math.PI / 2;
      nd.x = (d as Node).y * Math.cos(a) + size.w / 2;
      nd.y = (d as Node).y * Math.sin(a) + size.h / 2;
    });
  }
  function layoutForce() {
    const step = Math.min(size.w, size.h) / (2 * Math.max(2, maxDepth + 1));
    root.descendants().forEach((d) => {
      const nd = d as Node;
      if (d.depth === 0) { nd.x = size.w / 2; nd.y = size.h / 2; nd.fx = nd.x; nd.fy = nd.y; }
      else if (nd.x == null || !isFinite(nd.x)) {
        const sibs = d.parent?.children?.length ?? 1;
        const idx = d.parent?.children?.indexOf(d) ?? 0;
        const a = (idx / sibs) * 2 * Math.PI + d.depth * 0.6;
        nd.x = size.w / 2 + step * d.depth * Math.cos(a);
        nd.y = size.h / 2 + step * d.depth * Math.sin(a);
        nd.fx = null; nd.fy = null;
      }
    });
  }
  function layoutPack() {
    const packed = d3pack<Datum>().size([size.w - 40, size.h - 40]).padding((d) => Math.max(2, 10 - d.depth * 2))(root.copy().sum(() => 1));
    const pn = packed.descendants();
    root.descendants().forEach((d, i) => {
      const p = pn[i];
      if (p) { (d as Node).x = p.x + 20; (d as Node).y = p.y + 20; (d as Node).r = p.r; }
    });
  }

  function render(l = layout, labels = showLabels) {
    layout = l; showLabels = labels;
    if (sim) { sim.stop(); sim = null; }
    measure();
    maxDepth = nodes.reduce((m, d) => Math.max(m, d.depth), 0);
    root.descendants().forEach((d) => { (d as Node).polar = null; });
    if (l === "radial") layoutRadial();
    else if (l === "force") layoutForce();
    else layoutPack();
    center = { x: size.w / 2, y: size.h / 2 };
    const links = l === "pack" ? [] : root.links();

    // links
    g.selectAll(".depth-ring").remove();
    const linkSel = g.selectAll<SVGPathElement, (typeof links)[number]>(".link").data(links, (d) => (d.target as unknown as { id: number }).id);
    linkSel.exit().remove();
    const linkPath = (d: { source: Node; target: Node }) => `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`;
    linkSel.enter().append("path").attr("class", "link").attr("fill", "none")
      .merge(linkSel as never)
      .attr("d", linkPath as never)
      .attr("stroke", (d) => nodeColor((d as { target: Node }).target))
      .attr("stroke-opacity", 0.35)
      .attr("stroke-width", (d) => Math.max(1, 2.5 - (d as { target: Node }).target.depth * 0.4));

    // nodes
    const nodeSel = g.selectAll<SVGGElement, Node>(".node").data(nodes, (d) => (d as unknown as { id: number }).id);
    nodeSel.exit().remove();
    const enter = nodeSel.enter().append("g").attr("class", "node").style("cursor", "pointer")
      .on("click", (e, d) => { e.stopPropagation(); select(g.node() as never).selectAll(".node").classed("sel", (n) => n === d); opts.onSelect(toFlat(d)); })
      .on("mousemove", (e, d) => opts.onTooltip({ x: e.clientX, y: e.clientY, name: d.data.name, url: d.data.url || "", color: nodeColor(d) }))
      .on("mouseleave", () => opts.onTooltip(null))
      .call(dragBehavior() as never);
    enter.append("circle").attr("class", "node-circle").attr("stroke", "#fff").attr("stroke-width", 1.5);
    const merged = nodeSel.merge(enter as never);
    merged.attr("transform", (d) => `translate(${d.x},${d.y})`);
    merged.select<SVGCircleElement>(".node-circle")
      .attr("r", (d) => nodeR(d))
      .attr("fill", (d) => {
        if (l === "pack" && d.children) { const c = d3color(nodeColor(d)); if (c) { c.opacity = 0.15; return c.formatRgb(); } }
        return nodeColor(d);
      })
      .attr("stroke", (d) => (l === "pack" && d.children ? nodeColor(d) : "#fff"));

    drawLabels(labels);
  }

  function drawLabels(labels: boolean) {
    g.selectAll(".node-label").remove();
    if (!labels) return;
    const N = nodes.length;
    const pick = nodes.filter((d) => (layout === "pack" ? (d.children ? d.depth <= 1 && (d.r ?? 0) > 22 : (d.r ?? 0) > 18) : d.depth <= 1 || N < 120));
    g.selectAll(".node-label").data(pick, (d) => (d as unknown as { id: number }).id).enter().append("text")
      .attr("class", "node-label")
      .attr("x", (d) => d.x + (layout === "pack" ? 0 : nodeR(d) + 5))
      .attr("y", (d) => d.y + (layout === "pack" ? 4 : 4))
      .attr("text-anchor", layout === "pack" ? "middle" : "start")
      .attr("font-size", "11px").attr("font-weight", "500")
      .attr("fill", "var(--text)").attr("stroke", "var(--surface)").attr("stroke-width", "3px")
      .attr("paint-order", "stroke").attr("stroke-linejoin", "round")
      .style("pointer-events", "none")
      .text((d) => (d.data.name.length > 22 ? d.data.name.slice(0, 21) + "…" : d.data.name));
  }

  function startForce() {
    const links = root.links();
    const step = Math.min(size.w, size.h) / (2 * Math.max(2, maxDepth + 1));
    sim = forceSimulation(nodes as never)
      .force("link", forceLink(links as never).id((d) => (d as unknown as { id: number }).id).distance((d) => 50 + (d as unknown as { target: Node }).target.depth * 25).strength(0.7))
      .force("charge", forceManyBody().strength((d) => -110 - (d as Node).descendants().length * 3).distanceMax(450))
      .force("radial", forceRadial((d) => (d as Node).depth * step, center.x, center.y).strength(0.35))
      .force("center", forceCenter(center.x, center.y).strength(0.05))
      .force("collide", forceCollide().radius((d) => nodeR(d as Node) + 6).strength(0.9))
      .alpha(1).alphaDecay(0.035).alphaMin(0.02)
      .on("tick", () => {
        g.selectAll<SVGGElement, Node>(".node").attr("transform", (d) => `translate(${d.x},${d.y})`);
        g.selectAll<SVGPathElement, { source: Node; target: Node }>(".link").attr("d", (d) => `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`);
        if (showLabels) g.selectAll<SVGTextElement, Node>(".node-label").attr("x", (d) => d.x + nodeR(d) + 5).attr("y", (d) => d.y + 4);
      });
  }

  function dragBehavior() {
    return d3drag<SVGGElement, Node>()
      .on("start", (_e, d) => { if (layout === "force" && sim) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", (e, d) => {
        d.fx = e.x; d.fy = e.y; d.x = e.x; d.y = e.y;
        if (layout !== "force") {
          g.selectAll<SVGGElement, Node>(".node").filter((n) => n === d).attr("transform", `translate(${d.x},${d.y})`);
          g.selectAll<SVGPathElement, { source: Node; target: Node }>(".link").filter((l) => l.source === d || l.target === d)
            .attr("d", (l) => `M${l.source.x},${l.source.y}L${l.target.x},${l.target.y}`);
        }
      })
      .on("end", (e, d) => { if (layout === "force") { if (!e.active && sim) sim.alphaTarget(0); } else { d.fx = null; d.fy = null; } });
  }

  function fit() {
    if (!nodes.length || size.w < 50) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const r = nodeR(n);
      minX = Math.min(minX, n.x - r); minY = Math.min(minY, n.y - r);
      maxX = Math.max(maxX, n.x + r); maxY = Math.max(maxY, n.y + r);
    }
    const w = maxX - minX || 1, h = maxY - minY || 1;
    const pad = layout === "pack" ? 24 : 70;
    const k = Math.min((size.w - pad) / w, (size.h - pad) / h, 2.5);
    const tx = size.w / 2 - (minX + w / 2) * k;
    const ty = size.h / 2 - (minY + h / 2) * k;
    svg.transition().duration(450).call(zoomB.transform as never, zoomIdentity.translate(tx, ty).scale(k));
  }

  function filter(term: string, sectionKey: string) {
    const matches = (d: Node) => {
      if (sectionKey !== "all" && d.depth !== 0 && d.data.section !== sectionKey) return false;
      if (!term) return true;
      return d.data.name.toLowerCase().includes(term) || (d.data.url ?? "").toLowerCase().includes(term);
    };
    const visible = new Set<number>();
    for (const n of nodes) {
      if (matches(n)) { let cur: Node | null = n; while (cur) { visible.add((cur as unknown as { id: number }).id); cur = cur.parent as Node | null; } }
    }
    g.selectAll<SVGGElement, Node>(".node").style("opacity", (d) => (visible.has((d as unknown as { id: number }).id) ? 1 : 0.12));
    g.selectAll<SVGPathElement, { source: Node; target: Node }>(".link").style("opacity", (d) =>
      visible.has((d.source as unknown as { id: number }).id) && visible.has((d.target as unknown as { id: number }).id) ? 1 : 0.05);
    g.selectAll<SVGTextElement, Node>(".node-label").style("opacity", (d) => (visible.has((d as unknown as { id: number }).id) ? 1 : 0.12));
  }

  function toFlat(d: Node): FlatNode {
    return { id: (d as unknown as { id: number }).id, name: d.data.name, url: d.data.url, section: d.data.section, depth: d.depth, childCount: d.children?.length ?? 0, descendants: d.descendants().length - 1 };
  }

  // Render once, then start force sim if needed via the render() path.
  const origRender = render;
  const renderWithSim = (l = layout, labels = showLabels) => { origRender(l, labels); if (l === "force") startForce(); };

  return {
    render: renderWithSim,
    setColor: (fn: (s: string) => string) => { colorFor = fn; g.selectAll<SVGCircleElement, Node>(".node-circle").attr("fill", (d) => nodeColor(d)); },
    filter,
    fit,
    zoomBy: (k: number) => svg.transition().duration(200).call(zoomB.scaleBy as never, k),
    resetZoom: () => svg.transition().duration(350).call(zoomB.transform as never, zoomIdentity),
    destroy: () => { if (sim) sim.stop(); svg.on(".zoom", null); svg.selectAll("*").remove(); },
  };
}
