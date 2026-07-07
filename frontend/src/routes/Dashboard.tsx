import { ArrowRight, FileBarChart, Folder, LayoutGrid, Search } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useProjects } from "@/api/hooks/useProjects";
import { useUsage } from "@/api/hooks/useUsage";
import { PageHeader } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/store/auth";

const PROVIDER_LABELS: Record<string, string> = {
  serp: "SERP Ranking",
  keywords: "Keyword Volume",
  trends: "Trends",
  domains: "Domain Analytics",
  onpage: "On-Page",
  content: "Content Analysis",
};

const SOURCE_BADGE: Record<string, { label: string; free: boolean }> = {
  dataforseo: { label: "Premium", free: false },
  brave: { label: "Brave (free)", free: true },
  google: { label: "Google Trends (free)", free: true },
  local: { label: "Local (free)", free: true },
};

function DataSources({ providers }: { providers?: Record<string, string> }) {
  if (!providers) return null;
  const order = ["serp", "keywords", "trends", "domains", "onpage", "content"];
  return (
    <div className="space-y-2">
      {order
        .filter((k) => providers[k])
        .map((k) => {
          const badge = SOURCE_BADGE[providers[k]] ?? { label: providers[k], free: false };
          return (
            <div key={k} className="flex items-center justify-between text-sm">
              <span className="text-text-muted">{PROVIDER_LABELS[k] ?? k}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  badge.free
                    ? "bg-primary-soft text-primary"
                    : "bg-surface-2 text-text-muted"
                }`}
              >
                {badge.label}
              </span>
            </div>
          );
        })}
    </div>
  );
}

export default function Dashboard() {
  const user = useAuth((s) => s.user);
  const { data } = useUsage();
  const { data: projects } = useProjects();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const quickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const kw = q.trim();
    if (kw) navigate(`/serp?q=${encodeURIComponent(kw)}`);
  };

  const recent = (projects ?? []).slice(0, 5);

  return (
    <div>
      <PageHeader
        title={`Welcome${user?.full_name ? `, ${user.full_name}` : ""}`}
        subtitle="Your SEO intelligence workspace"
      />

      {/* Bento mosaic — hero search tile + quick-action tiles + info tiles. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Card className="row-span-2 bg-gradient-to-br from-primary-soft/70 to-surface transition-shadow hover:shadow-md sm:col-span-2 lg:col-span-4">
          <CardBody className="flex h-full flex-col justify-center gap-4 py-8">
            <div>
              <h2 className="text-xl font-semibold text-text">Check any keyword's SERP</h2>
              <p className="mt-1 text-sm text-text-muted">
                See the top 100 ranking pages, brands, and People Also Ask in seconds.
              </p>
            </div>
            <form onSubmit={quickSearch} className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Quick SERP search — enter a keyword…"
                className="bg-surface sm:flex-1"
              />
              <Button type="submit" disabled={!q.trim()}>
                <Search size={16} /> Search
              </Button>
            </form>
          </CardBody>
        </Card>

        <Link to="/workspace" className="lg:col-span-2">
          <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
            <CardBody className="flex h-full items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-soft text-primary">
                  <LayoutGrid size={19} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-text">All-in-One analysis</p>
                  <p className="text-xs text-text-muted">Every tool, one page</p>
                </div>
              </div>
              <ArrowRight size={16} className="shrink-0 text-text-muted" />
            </CardBody>
          </Card>
        </Link>

        <Link to="/report" className="lg:col-span-2">
          <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
            <CardBody className="flex h-full items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-soft text-primary">
                  <FileBarChart size={19} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-text">Site Report</p>
                  <p className="text-xs text-text-muted">Full audit + AI advisor</p>
                </div>
              </div>
              <ArrowRight size={16} className="shrink-0 text-text-muted" />
            </CardBody>
          </Card>
        </Link>

        <Card className="transition-shadow hover:shadow-md sm:col-span-1 lg:col-span-3">
          <CardHeader>
            <CardTitle>Data sources</CardTitle>
          </CardHeader>
          <CardBody>
            <DataSources providers={data?.providers} />
          </CardBody>
        </Card>

        <Card className="transition-shadow hover:shadow-md sm:col-span-1 lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent projects</CardTitle>
          </CardHeader>
          <CardBody className="space-y-1">
            {recent.length ? (
              recent.map((p) => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-surface-2"
                >
                  <span className="flex items-center gap-2 text-text">
                    <Folder size={15} className="text-primary" />
                    {p.name}
                  </span>
                  <span className="font-mono text-xs text-text-muted">
                    {p.run_count} {p.run_count === 1 ? "run" : "runs"}
                  </span>
                </Link>
              ))
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-text-muted">No saved projects yet.</p>
                <Link to="/projects">
                  <Button variant="ghost" size="sm">
                    Create one <ArrowRight size={14} />
                  </Button>
                </Link>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
