import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";

/** Shared mutation for billed module endpoints — refreshes the usage summary
 *  after every call so admin spend stays current. */
export function useMeteredMutation<TInput, TData>(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TInput) => {
      const { data } = await api.post<TData>(path, input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usage", "summary"] }),
  });
}
