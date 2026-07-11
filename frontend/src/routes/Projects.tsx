import { Database, Folder, FolderOpen, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { apiErrorMessage } from "@/api/client";
import { useCreateProject, useDeleteProject, useProjects } from "@/api/hooks/useProjects";
import { MetricCard } from "@/components/shared/MetricCard";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export default function Projects() {
  const { data, isLoading, isError, error, refetch } = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const [name, setName] = useState("");

  const create = async () => {
    const n = name.trim();
    if (!n) return;
    await createProject.mutateAsync({ name: n });
    setName("");
  };

  const remove = async (id: string, projectName: string) => {
    if (!confirm(`Delete project “${projectName}” and its saved runs?`)) return;
    await deleteProject.mutateAsync(id);
  };

  return (
    <div>
      <PageHeader title="Projects" subtitle="Saved workspaces — reopen any result for $0, straight from cache." />

      <Card className="mb-5">
        <CardBody>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New project name, e.g. Q3 Brand Audit"
              className="sm:flex-1"
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
            <Button onClick={create} disabled={createProject.isPending || !name.trim()}>
              <Plus size={16} /> Create project
            </Button>
          </div>
        </CardBody>
      </Card>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      )}

      {isError && <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />}

      {data && data.length === 0 && (
        <EmptyState title="No projects yet" hint="Create a project above, then save results to it from any module." />
      )}

      {data && data.length > 0 && (
        <div className="animate-fade-rise space-y-5">
        <div className="grid grid-cols-2 gap-4 sm:max-w-md">
          <MetricCard icon={FolderOpen} label="Projects" value={String(data.length)} />
          <MetricCard icon={Database} label="Saved runs" value={String(data.reduce((s, p) => s + p.run_count, 0))} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((p) => (
            <Card key={p.id} className="group relative transition-colors hover:border-[color:var(--section)]">
              <Link to={`/projects/${p.id}`} className="block">
                <CardBody>
                  <div className="flex items-center gap-2">
                    <Folder className="text-[color:var(--section)]" size={18} />
                    <span className="truncate font-medium text-text">{p.name}</span>
                  </div>
                  <p className="mt-3 text-sm text-text-muted">
                    {p.run_count} saved {p.run_count === 1 ? "run" : "runs"}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    Updated {new Date(p.updated_at).toLocaleDateString()}
                  </p>
                </CardBody>
              </Link>
              <button
                onClick={() => remove(p.id, p.name)}
                title="Delete project"
                className="absolute right-3 top-3 rounded-md p-1.5 text-text-muted opacity-0 transition-opacity hover:bg-surface-2 hover:text-danger group-hover:opacity-100"
              >
                <Trash2 size={15} />
              </button>
            </Card>
          ))}
        </div>
        </div>
      )}
    </div>
  );
}
