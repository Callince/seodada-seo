import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { api } from "@/api/client";
import { useAuth } from "@/store/auth";
import type { AuthResponse } from "@/types";

export function useLogin() {
  const setAuth = useAuth((s) => s.setAuth);
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (body: { email: string; password: string }) => {
      const { data } = await api.post<AuthResponse>("/auth/login", body);
      return data;
    },
    onSuccess: (data) => {
      setAuth(data.access_token, data.refresh_token, data.user);
      navigate("/dashboard");
    },
  });
}

type RegisterResult = { verification: true; email: string } | ({ verification: false } & AuthResponse);

export function useRegister() {
  return useMutation({
    mutationFn: async (body: { email: string; password: string; full_name: string }) => {
      const { data } = await api.post<RegisterResult>("/auth/register", body);
      return data;
    },
  });
}

export function useSignupVerify() {
  const setAuth = useAuth((s) => s.setAuth);
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (body: { email: string; code: string }) => {
      const { data } = await api.post<AuthResponse>("/auth/signup/verify", body);
      return data;
    },
    onSuccess: (data) => {
      setAuth(data.access_token, data.refresh_token, data.user);
      navigate("/dashboard");
    },
  });
}
