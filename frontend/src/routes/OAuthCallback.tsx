import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "@/api/client";
import { useAuth } from "@/store/auth";
import type { User } from "@/types";

export default function OAuthCallback() {
  const navigate = useNavigate();
  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = p.get("access_token");
    const refreshToken = p.get("refresh_token");
    if (!accessToken || !refreshToken) {
      navigate("/login?error=google_failed", { replace: true });
      return;
    }
    useAuth.setState({ accessToken, refreshToken });
    api
      .get<{ user: User }>("/auth/me")
      .then(({ data }) => {
        useAuth.getState().setAuth(accessToken, refreshToken, data.user);
        navigate("/dashboard", { replace: true });
      })
      .catch(() => {
        useAuth.getState().logout();
        navigate("/login?error=google_failed", { replace: true });
      });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-bg">
      <p className="text-sm text-text-muted">Signing you in…</p>
    </div>
  );
}
