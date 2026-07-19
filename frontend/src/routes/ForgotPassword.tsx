import { useState } from "react";
import { Link } from "react-router-dom";

import { useForgotPassword } from "@/api/hooks/useAuth";
import { AuthLayout } from "@/routes/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPassword() {
  const forgot = useForgotPassword();
  const [email, setEmail] = useState("");

  return (
    <AuthLayout
      title="Reset your password"
      subtitle={
        forgot.isSuccess
          ? "If that email is registered, a reset link is on its way."
          : "Enter your email and we'll send you a reset link"
      }
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          ← Back to sign in
        </Link>
      }
    >
      {forgot.isSuccess ? (
        <p className="rounded-lg bg-primary-soft px-4 py-3 text-center text-sm text-primary">
          Check your inbox — the link expires in 30 minutes.
        </p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            forgot.mutate({ email });
          }}
        >
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button
            type="submit"
            className="w-full"
            disabled={forgot.isPending}
          >
            {forgot.isPending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
