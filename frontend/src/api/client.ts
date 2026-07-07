import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

import { useAuth } from "@/store/auth";

export const api = axios.create({ baseURL: "/api/v1" });

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuth.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setAccess, logout } = useAuth.getState();
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post("/api/v1/auth/refresh", { refresh_token: refreshToken });
    setAccess(data.access_token);
    return data.access_token;
  } catch {
    logout();
    return null;
  }
}

api.interceptors.response.use(
  (resp) => resp,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      refreshing = refreshing ?? refreshAccessToken();
      const newToken = await refreshing;
      refreshing = null;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    // RFC 7807 problem+json carries `detail` (and `title` as a fallback).
    const data = error.response?.data as { detail?: unknown; title?: unknown } | undefined;
    if (typeof data?.detail === "string") return data.detail;
    if (error.response?.status === 402) return "Monthly API budget exhausted.";
    if (typeof data?.title === "string") return data.title;
    return error.message;
  }
  return "Something went wrong.";
}
