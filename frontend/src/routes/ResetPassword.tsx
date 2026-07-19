import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useResetPassword } from "@/api/hooks/useAuth";
import { apiErrorMessage } from "@/api/client";
import { AuthLayout } from "@/routes/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const reset = useResetPassword();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const mismatch = confirm.length > 0 && password !== confirm;

  if (!token) {
    return (
      <AuthLayout
        title="Invalid reset link"
        subtitle="This link is missing its token or has already been used."
        footer={
          <Link to="/forgot-password" className="font-medium text-primary hover:underline">
            Request a new link
          </Link>
        }
      >
        <Link to="/forgot-password">
          <Button className="w-full">
            Request a new link
          </Button>
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Pick a strong password you don't use elsewhere"
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          ← Back to sign in
        </Link>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!mismatch) reset.mutate({ token, password });
        }}
      >
        <Input
          type="password"
          placeholder="New password (8+ chars, letter + number)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        <Input
          type="password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        {mismatch && <p className="text-sm text-danger">Passwords don't match.</p>}
        {reset.isError && <p className="text-sm text-danger">{apiErrorMessage(reset.error)}</p>}
        <Button
          type="submit"
          className="w-full"
          disabled={reset.isPending || mismatch || !password}
        >
          {reset.isPending ? "Updating…" : "Reset password & sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}
