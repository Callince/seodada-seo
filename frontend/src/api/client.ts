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

/**
 * Human-readable message for any API failure.
 *
 * The API's OWN message wins whenever it sends one — problem+json `detail`,
 * then `title`. Everything else maps by status, and the raw axios string is
 * never shown: `error.message` is developer text, and it leaked to users on
 * every failure that isn't problem+json. A stopped backend put "Request failed
 * with status code 502" under the password field of the login form, which
 * tells the person nothing they can act on and reads as the site being broken
 * rather than briefly unavailable. Gateways emit HTML error pages, and network
 * failures have no response at all, so both fell straight through.
 */
export function apiErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return "Something went wrong. Please try again.";

  const data = error.response?.data as { detail?: unknown; title?: unknown } | undefined;
  if (typeof data?.detail === "string" && data.detail.trim()) return data.detail;
  if (typeof data?.title === "string" && data.title.trim()) return data.title;

  const status = error.response?.status;

  // No response: request never reached a server (offline, DNS, connection
  // refused, CORS) or it timed out.
  if (!error.response) {
    return error.code === "ECONNABORTED"
      ? "That took too long to respond. Please try again."
      : "Can't reach the server. Check your connection and try again.";
  }

  switch (status) {
    case 400:
      return "That request wasn't valid. Please check the details and try again.";
    case 401:
      return "Your email or password is incorrect.";
    case 403:
      return "You don't have access to that.";
    case 404:
      return "We couldn't find that.";
    case 402:
      return "Monthly API budget exhausted.";
    case 409:
      return "That conflicts with something that already exists.";
    case 413:
      return "That file is too large.";
    case 429:
      return "Too many requests in a row. Please wait a moment and try again.";
    case 502:
    case 503:
    case 504:
      // The gateway is up but the app behind it is not — temporary, and worth
      // saying so rather than implying the user did something wrong.
      return "The service is temporarily unavailable. Please try again in a moment.";
    default:
      if (status && status >= 500) return "Something went wrong on our end. Please try again.";
      return "Something went wrong. Please try again.";
  }
}
