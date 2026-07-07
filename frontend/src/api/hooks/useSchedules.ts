import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, apiErrorMessage } from "@/api/client";
import { toast } from "@/store/toast";
import type { ScheduleListResponse, ScheduleOut } from "@/types";

export interface CreateScheduleInput {
  frequency: "daily" | "weekly" | "monthly";
  params: Record<string, unknown>;
}

export function useSchedules() {
  return useQuery({
    queryKey: ["schedules"],
    queryFn: async () => (await api.get<ScheduleListResponse>("/schedules")).data.items,
    staleTime: 30_000,
  });
}

export function useCreateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateScheduleInput) =>
      (await api.post<ScheduleOut>("/schedules", input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Schedule created — it will run automatically.");
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
}

export function useUpdateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; active?: boolean; frequency?: "daily" | "weekly" | "monthly" }) =>
      (await api.patch<ScheduleOut>(`/schedules/${input.id}`, {
        active: input.active,
        frequency: input.frequency,
      })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
  });
}

export function useDeleteSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/schedules/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
      toast.info("Schedule deleted.");
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
}

export function useRunSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<ScheduleOut>(`/schedules/${id}/run`)).data,
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["usage", "summary"] });
      toast.success(s.last_status?.includes("emailed") ? "Report generated and emailed." : "Report generated and saved.");
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
}
