import {
  ArrowRight,
  BarChart3,
  Briefcase,
  CalendarDays,
  ExternalLink,
  FileBarChart,
  Folder,
  Heading,
  Image as ImageIcon,
  Link2,
  MessageSquareText,
  Network,
  Rocket,
  Search,
  ShieldCheck,
  Star,
  Tags,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useProjects } from "@/api/hooks/useProjects";
import { useDashboardStats } from "@/api/hooks/useUsage";
import { AreaChart, ScoreRing, TONES, type Tone } from "@/components/public/landingKit";
import { LocationLanguagePicker } from "@/components/shared/LocationLanguagePicker";
import { MetricCard } from "@/components/shared/MetricCard";
import { PageHeader } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtInt } from "@/lib/format";
import { usePersistedState } from "@/lib/persist";
import { moduleForPath, sectionVars } from "@/lib/sections";
import { useAuth } from "@/store/auth";

/** The SEO workflow — mirrors the sidebar so the journey is consistent. */
const WORKFLOW: { n: number; title: string; desc: string; to: string; icon: LucideIcon }[] = [
  { n: 1, title: "Research", desc: "Find the right keywords and competitors", to: "/keywords", icon: Search },
  { n: 2, title: "Audit", desc: "Analyze technical SEO and content issues", to: "/audit", icon: ShieldCheck },
  { n: 3, title: "Optimize", desc: "Optimize content and on-page elements", to: "/content", icon: Rocket },
  { n: 4, title: "Track", desc: "Track rankings and monitor performance", to: "/rank", icon: BarChart3 },
  { n: 5, title: "Manage", desc: "Manage projects, reports and schedules", to: "/projects", icon: Briefcase },
];

/** The six instant analysis tools, each with its own on-brand tone. */
const TOOLS: { to: string; label: string; desc: string; icon: LucideIcon; tone: Tone }[] = [
  { to: "/tools/url", label: "URL Analysis", desc: "Structure, status, redirects, links & robots.", icon: Link2, tone: "blue" },
  { to: "/tools/meta", label: "Meta Analysis", desc: "Title, description, OG, Twitter & schema.", icon: Tags, tone: "cyan" },
  { to: "/tools/sitemap", label: "Sitemap Analysis", desc: "Discover sitemaps and explore site structure.", icon: Network, tone: "violet" },
  { to: "/tools/heading", label: "Heading Analysis", desc: "H1–H6 hierarchy, counts and structure issues.", icon: Heading, tone: "emerald" },
  { to: "/tools/image", label: "Image Analysis", desc: "Every image and its alt text, size & loading.", icon: ImageIcon, tone: "amber" },
  { to: "/tools/keyword", label: "Keyword Analysis", desc: "Word count and keyword density of a page.", icon: Search, tone: "teal" },
];

const TOOL_LABELS: Record<string, string> = Object.fromEntries(
  TOOLS.map((t) => [t.to.split("/").pop() as string, t.label]),
);

function chipStyle(tone: Tone) {
  const [light, deep] = TONES[tone];
  return { background: `linear-gradient(135deg, ${deep}, ${light})` };
}

/** Compact relative time for the projects table. */
function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} hours ago`;
  return `${Math.round(s / 86400)} days ago`;
}

export default function Dashboard() {
  const user = useAuth((s) => s.user);
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  // Shares the SERP page's persisted location so the chosen country carries over.
  const [loc, setLoc] = usePersistedState("serp.loc", { location_code: 2840, language_code: "en" });

  const recent = (projects ?? []).slice(0, 6);
  const used = stats?.today_used ?? 0;
  const limit = stats?.daily_limit ?? 0;
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const favKey = stats?.favorite_tool?.split(".").pop() ?? "";
  const favLabel = TOOL_LABELS[favKey] || (stats?.favorite_tool ? favKey : "—");
  const series = stats?.usage_series ?? [];

  const hasSeries = series && series.length > 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back${user?.full_name ? `, ${user.full_name}` : ""}! 👋`}
        subtitle="Here's what's happening with your SEO journey today."
        actions={
          limit ? (
            <div className="hidden text-right sm:block">
              <div className="flex items-center justify-end gap-2 text-sm">
                <span className="text-text-muted">Usage today</span>
                <span className="font-bold text-primary">{pct}%</span>
                <span className="h-2 w-36 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full rounded-full gradient-fill" style={{ width: `${pct}%` }} />
                </span>
              </div>
              <p className="mt-1 text-xs text-text-muted">
                {fmtInt(used)} / {fmtInt(limit)} analyses
              </p>
            </div>
          ) : undefined
        }
      />

      {/* ===== SEO Workflow — horizontal connected journey ===== */}
      <Card>
        <CardBody className="relative px-4 py-6 sm:px-8">
          {/* connector line behind the icon row (desktop only) */}
          <div
            className="pointer-events-none absolute left-[10%] right-[10%] top-[52px] hidden h-0.5 bg-border md:block"
            aria-hidden
          />
          <div className="grid grid-cols-2 gap-y-7 sm:grid-cols-3 md:grid-cols-5">
            {WORKFLOW.map((s) => (
              <Link
                key={s.n}
                to={s.to}
                style={sectionVars(moduleForPath(s.to))}
                className="group relative z-10 flex flex-col items-center px-2 text-center focus-visible:outline-none"
              >
                <span className="section-gradient grid h-14 w-14 place-items-center rounded-2xl text-white shadow-glow ring-4 ring-surface transition-transform duration-300 group-hover:scale-110 group-focus-visible:ring-[color:var(--section)]">
                  <s.icon size={22} />
                </span>
                <h3 className="mt-3 text-sm font-bold text-text transition-colors group-hover:text-[color:var(--section-ink)]">
                  {s.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">{s.desc}</p>
              </Link>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* ===== Stat cards ===== */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Skeletons on first load — no zero-flash before stats land. */}
        {statsLoading ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="min-h-[148px]">
                <CardBody className="flex h-full flex-col justify-center gap-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-3 w-40" />
                </CardBody>
              </Card>
            ))}
          </>
        ) : (
        <>
        {/* Usage ring */}
        <Card className="min-h-[148px]">
          <CardBody className="flex h-full items-center gap-4">
            <ScoreRing value={limit ? pct : 0} size={90} label={limit ? "used" : "no cap"} />
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Usage Today</p>
              <p className="mt-1 text-2xl font-extrabold text-text font-mono">{fmtInt(used)}</p>
              <p className="text-[11px] text-text-muted mt-0.5">
                {limit ? `of ${fmtInt(limit)} daily runs` : "Unlimited tier"}
              </p>
            </div>
          </CardBody>
        </Card>

        {/* Plan */}
        <Card className="min-h-[148px]">
          <CardBody className="flex h-full flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Active Plan</p>
                <p className="mt-1 text-2xl font-extrabold text-primary tracking-tight">
                  {stats?.plan_name ?? "Free Tier"}
                </p>
              </div>
              <CalendarDays size={18} className="text-primary/70 bg-primary-soft p-1 rounded-lg h-7 w-7" />
            </div>
            <div className="pt-2">
              <Link to="/billing" className="block">
                <Button variant="secondary" size="sm" className="w-full text-xs font-semibold hover:border-primary/30 border border-transparent transition-all">
                  Upgrade & Settings
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>

        {/* Total analyses — KPI with sparkline */}
        <MetricCard
          icon={BarChart3}
          label="Total Analyses"
          value={fmtInt(stats?.total_analyses ?? 0)}
          series={hasSeries ? series : undefined}
          sparkId="dash-usage"
          tone="blue"
          sub={hasSeries ? undefined : "No activity yet"}
        />

        {/* Favorite tool */}
        <MetricCard
          icon={Star}
          label="Favorite Tool"
          value={favLabel}
          sub={
            stats?.favorite_tool_count
              ? `Used ${fmtInt(stats.favorite_tool_count)} times this cycle`
              : "No run history yet — try a tool below."
          }
        />
        </>
        )}
      </div>

      {/* ===== Quick SERP lookup — Glassmorphic Search Hub ===== */}
      <div className="gradient-fill relative overflow-hidden rounded-2xl p-6 shadow-xl sm:p-8 border border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />
        
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="lg:w-80 lg:shrink-0">
            <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Rocket size={18} /> Quick SERP Lookup
            </h2>
            <p className="mt-1 text-sm text-white/80 leading-relaxed">
              Analyze real-time top-100 organic search rankings, brand performance metrics, and People Also Ask questions.
            </p>
          </div>
          
          <div className="flex-1">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (q.trim()) navigate(`/serp?q=${encodeURIComponent(q.trim())}`);
              }}
              className="flex flex-col gap-3 sm:flex-row"
            >
              <div className="relative flex-1">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Quick SERP search"
                  placeholder="Enter a keyword or domain (e.g. best ai tools)…"
                  className="h-11 rounded-xl border-white/20 bg-white/95 pl-11 pr-4 text-text placeholder-text-muted/60 shadow-inner focus:bg-white"
                />
              </div>
              <LocationLanguagePicker
                value={loc}
                onChange={setLoc}
                className="h-11 shrink-0 rounded-xl border-white/20 bg-white/95 text-text sm:w-56"
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={!q.trim()}
                className="shimmer h-11 shrink-0 bg-white px-6 text-xs font-bold uppercase tracking-wider text-primary shadow-md transition-all hover:bg-white/90"
              >
                Search SERP
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* ===== Instant SEO tools ===== */}
      <div>
        <div className="flex flex-col">
          <h2 className="text-xl font-extrabold tracking-tight text-text">Instant SEO Tools</h2>
          <p className="text-sm text-text-muted">Run localized, immediate audits on any URL with no configuration.</p>
        </div>
        
        <div className="mt-4 grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="group flex flex-col justify-between rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-glow relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--section)] focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg"
            >
              <div>
                <div className="flex items-start justify-between">
                  <span
                    className="grid h-12 w-12 place-items-center rounded-2xl text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
                    style={chipStyle(t.tone)}
                  >
                    <t.icon size={22} />
                  </span>
                  <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-[10px] font-bold text-success-ink border border-success/20 uppercase tracking-wider">
                    Free
                  </span>
                </div>
                <h3 className="mt-4 text-base font-bold text-text tracking-tight group-hover:text-primary transition-colors">
                  {t.label}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-text-muted">
                  {t.desc}
                </p>
              </div>
              <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-primary group-hover:underline">
                Launch tool <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* ===== Recent projects ===== */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-text">Saved Workspaces</h2>
            <p className="text-sm text-text-muted">Reopen, compare, and audit cached project results.</p>
          </div>
          <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline group">
            All Projects <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <Card className="overflow-hidden border-border/70">
          {projectsLoading ? (
            <CardBody className="space-y-3 py-6">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </CardBody>
          ) : recent.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-border bg-surface-2/40 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    <th className="px-5 py-3.5">Project Name</th>
                    <th className="hidden px-5 py-3.5 md:table-cell">Target Website</th>
                    <th className="hidden px-5 py-3.5 text-right sm:table-cell">Last Audited</th>
                    <th className="px-5 py-3.5 text-right">Run Count</th>
                    <th className="hidden px-5 py-3.5 lg:table-cell">Trend</th>
                    <th className="w-12 px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {recent.map((p) => (
                    <tr key={p.id} className="transition-colors hover:bg-surface-2/30">
                      <td className="px-5 py-4 font-semibold text-text">
                        <Link to={`/projects/${p.id}`} className="flex items-center gap-2.5 hover:text-primary transition-colors">
                          <Folder size={16} className="text-primary shrink-0" />
                          <span className="truncate max-w-[200px]">{p.name}</span>
                        </Link>
                      </td>
                      <td className="hidden px-5 py-4 text-text-muted md:table-cell max-w-xs truncate font-mono text-xs">
                        {p.target ?? <span className="text-text-muted/50">—</span>}
                      </td>
                      <td className="hidden px-5 py-4 text-right text-text-muted sm:table-cell text-xs">
                        {p.last_run_at ? ago(p.last_run_at) : <span className="text-text-muted/50">—</span>}
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-xs font-semibold text-text">
                        {p.run_count}
                      </td>
                      <td className="hidden px-5 py-4 lg:table-cell">
                        {p.runs_series?.some((v) => v > 0) ? (
                          <div className="h-6 w-24">
                            <AreaChart values={p.runs_series} id={`proj-${p.id}`} height={24} tone="blue" />
                          </div>
                        ) : (
                          <div className="h-6 w-24 opacity-25">
                            <svg viewBox="0 0 100 10" className="h-full w-full">
                              <line x1="0" y1="5" x2="100" y2="5" stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3,3" />
                            </svg>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link to={`/projects/${p.id}`} aria-label={`Open ${p.name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-primary-soft text-text-muted hover:text-primary transition-all">
                          <ExternalLink size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <CardBody className="flex flex-col items-center justify-center py-12 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-primary mb-4 shadow-sm">
                <Briefcase size={24} />
              </span>
              <h3 className="text-lg font-bold text-text">No saved projects</h3>
              <p className="max-w-md text-sm text-text-muted mt-1 leading-relaxed">
                Workspaces allow you to group related tools, track organic rankings over time, and schedule automatic SEO email audits.
              </p>
              <div className="mt-5">
                <Link to="/projects">
                  <Button variant="primary" size="sm" className="font-semibold shadow-md px-5">
                    Create your first workspace <ArrowRight size={14} />
                  </Button>
                </Link>
              </div>
            </CardBody>
          )}
        </Card>
      </div>

      {/* ===== AI Advisor Banner & Quick Shortcuts ===== */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* All-in-One Shortcut */}
        <Link to="/workspace" className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--section)] focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg">
          <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-glow">
            <CardBody className="flex flex-col justify-between h-full p-6">
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary transition-all group-hover:scale-110 group-hover:gradient-fill group-hover:text-white">
                  <MessageSquareText size={20} />
                </span>
                <div>
                  <h3 className="text-base font-bold text-text tracking-tight">All-in-One workspace</h3>
                  <p className="mt-1 text-xs text-text-muted leading-relaxed">
                    Analyze a domain across keyword research, SERP rankings, speed, backlinks, and on-page optimization simultaneously.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-end text-primary text-xs font-bold gap-1 group-hover:underline">
                Enter workspace <ArrowRight size={13} />
              </div>
            </CardBody>
          </Card>
        </Link>

        {/* Site Report Shortcut */}
        <Link to="/report" className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--section)] focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg">
          <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-glow">
            <CardBody className="flex flex-col justify-between h-full p-6">
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary transition-all group-hover:scale-110 group-hover:gradient-fill group-hover:text-white">
                  <FileBarChart size={20} />
                </span>
                <div>
                  <h3 className="text-base font-bold text-text tracking-tight">Composite site report</h3>
                  <p className="mt-1 text-xs text-text-muted leading-relaxed">
                    Generate an executive summary audit containing a domain's core findings, top keywords, and detailed recommendations.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-end text-primary text-xs font-bold gap-1 group-hover:underline">
                Create report <ArrowRight size={13} />
              </div>
            </CardBody>
          </Card>
        </Link>

        {/* AI Advisor Panel */}
        <Card className="border-gradient relative overflow-hidden bg-gradient-to-br from-surface to-primary-soft/30">
          <CardBody className="flex flex-col justify-between h-full p-6 relative z-10">
            <div>
              <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider">
                <Sparkles size={16} className="text-primary" />
                <span>AI SEO Advisor</span>
              </div>
              <p className="mt-2.5 text-xs text-text-muted leading-relaxed">
                Connect your workspace to activate the Google Gemini SEO Engine. Get prioritized, technical recommendations from your audit and keyword datasets.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-border/60">
              <Link to="/audit">
                <Button variant="outline" size="sm" className="w-full text-xs font-bold bg-surface hover:bg-primary-soft transition-all">
                  Trigger Audit to Start
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
