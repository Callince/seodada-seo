import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useLogin } from "@/api/hooks/useAuth";
import { apiErrorMessage } from "@/api/client";
import { AuthLayout, GoogleButton, OrDivider } from "@/routes/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Login() {
  const login = useLogin();
  const [params] = useSearchParams();
  const oauthError = params.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your seodada workspace"
      footer={
        <>
          No account?{" "}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </>
      }
    >
      {oauthError && (
        <p className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-center text-sm text-danger">
          Google sign-in failed. Please try again.
        </p>
      )}

      <GoogleButton />
      <OrDivider />

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate({ email, password });
        }}
      >
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-xs text-text-muted hover:text-primary">
            Forgot password?
          </Link>
        </div>
        {login.isError && (
          <p className="text-sm text-danger">{apiErrorMessage(login.error)}</p>
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={login.isPending}
        >
          {login.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}
