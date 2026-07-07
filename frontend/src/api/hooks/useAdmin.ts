import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { AdminUser, AdminUsersResponse } from "@/types";

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const { data } = await api.get<AdminUsersResponse>("/admin/users");
      return data;
    },
    staleTime: 15_000,
  });
}

export interface AdminUpdateUserInput {
  id: string;
  full_name?: string;
  role?: "member" | "owner";
  password?: string;
  is_active?: boolean;
  org_name?: string;
}

export function useAdminUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: AdminUpdateUserInput) => {
      const { data } = await api.patch<AdminUser>(`/admin/users/${id}`, patch);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}
