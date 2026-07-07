import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { Page, Project, ProjectDetail, ProjectRun, ProjectRunResult } from "@/types";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    // Cursor-paginated envelope; the UI shows the first page (default limit 50).
    queryFn: async () => (await api.get<Page<Project>>("/projects")).data.data,
    staleTime: 30_000,
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ["projects", id],
    enabled: !!id,
    queryFn: async () => (await api.get<ProjectDetail>(`/projects/${id}`)).data,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; type?: string }) =>
      (await api.post<Project>("/projects", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/projects/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useSaveRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      module: string;
      params: Record<string, unknown>;
      result: Record<string, unknown>;
    }) =>
      (
        await api.post<ProjectRun>(`/projects/${input.projectId}/runs`, {
          module: input.module,
          params: input.params,
          result: input.result,
        })
      ).data,
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["projects", v.projectId] });
    },
  });
}

export async function fetchRun(projectId: string, runId: string): Promise<ProjectRunResult> {
  return (await api.get<ProjectRunResult>(`/projects/${projectId}/runs/${runId}`)).data;
}
