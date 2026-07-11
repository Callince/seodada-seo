import { useQuery } from "@tanstack/react-query";
import { FileClock } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { apiErrorMessage } from "@/api/client";
import { fetchRun, useProject } from "@/api/hooks/useProjects";
import { MODULE_LABELS, SavedRunView } from "@/components/shared/SavedRunView";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared/states";
import { Card, CardBody } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading, isError, error, refetch } = useProject(id);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (project && project.runs.length && !selected) setSelected(project.runs[0].id);
  }, [project, selected]);

  const run = useQuery({
    queryKey: ["projects", id, "run", selected],
    enabled: !!id && !!selected,
    queryFn: () => fetchRun(id!, selected!),
  });

  return (
    <div>
      {isLoading && <Skeleton className="h-64" />}
      {isError && <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />}

      {project && (
        <>
          <PageHeader
            title={project.name}
            subtitle={`${project.runs.length} saved runs · reopen any for $0`}
            breadcrumbs={[{ label: "Projects", to: "/projects" }, { label: project.name }]}
          />

          {project.runs.length === 0 ? (
            <EmptyState title="No saved runs" hint="Run a search in any module and click “Save to project”." />
          ) : (
            <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
              <div className="space-y-1.5">
                {project.runs.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r.id)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 rounded-md border px-3 py-2 text-left transition-colors",
                      selected === r.id
                        ? "border-[color:var(--section)] bg-[color:var(--section-soft)]"
                        : "border-border hover:bg-surface-2",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium text-text">
                      <FileClock size={14} className="text-text-muted" />
                      {MODULE_LABELS[r.module] ?? r.module}
                    </span>
                    <span className="truncate text-xs text-text-muted">
                      {Object.values(r.params).filter(Boolean).join(" · ") || "—"}
                    </span>
                    <span className="text-xs text-text-muted">
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>

              <div className="animate-fade-rise">
                {run.isLoading && <Skeleton className="h-64" />}
                {run.isError && <ErrorState message={apiErrorMessage(run.error)} onRetry={run.refetch} />}
                {run.data && <SavedRunView module={run.data.module} result={run.data.result} />}
                {!selected && (
                  <Card>
                    <CardBody>
                      <EmptyState title="Select a run" hint="Pick a saved run to view its results." />
                    </CardBody>
                  </Card>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
