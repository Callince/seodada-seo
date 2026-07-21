import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";

export interface UserSettings {
  display_currency: string;
  full_name: string;
}

export function useUserSettings() {
  return useQuery<UserSettings>({
    queryKey: ["settings", "me"],
    queryFn: async () => (await api.get("/settings/me")).data,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateUserSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<UserSettings>) =>
      (await api.patch("/settings/me", patch)).data as UserSettings,
    onSuccess: (data) => {
      qc.setQueryData(["settings", "me"], data);
      // Every price on screen is derived from this, so anything already
      // rendered has to re-read it rather than wait for its own staleTime.
      qc.invalidateQueries({ queryKey: ["currencies"] });
    },
  });
}
