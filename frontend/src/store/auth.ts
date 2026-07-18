import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { User } from "@/types";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setAuth: (access: string, refresh: string, user: User) => void;
  setAccess: (access: string) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setAuth: (accessToken, refreshToken, user) => set({ accessToken, refreshToken, user }),
      setAccess: (accessToken) => set({ accessToken }),
      logout: () => {
        // Fire-and-forget server-side revocation of the refresh token.
        const refreshToken = get().refreshToken;
        if (refreshToken) {
          void fetch("/api/v1/auth/logout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
          }).catch(() => {});
        }
        set({ accessToken: null, refreshToken: null, user: null });
      },
    }),
    { name: "seo-auth" },
  ),
);
