import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useRegister, useSignupVerify } from "@/api/hooks/useAuth";
import { apiErrorMessage } from "@/api/client";
import { useAuth } from "@/store/auth";
import { AuthLayout, GoogleButton, OrDivider } from "@/routes/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Register() {
  const register = useRegister();
  const verify = useSignupVerify();
  const setAuth = useAuth((s) => s.setAuth);
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <AuthLayout
      title={sent ? "Check your email" : "Create your account"}
      subtitle={
        sent
          ? `We emailed a 6-digit code to ${form.email}`
          : "Start analysing, tracking, and publishing in one place"
      }
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {!sent ? (
        <>
          <GoogleButton label="Sign up with Google" />
          <OrDivider />
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              register.mutate(form, {
                onSuccess: (data) => {
                  if (data.verification) setSent(true);
                  else {
                    setAuth(data.access_token, data.refresh_token, data.user);
                    navigate("/dashboard");
                  }
                },
              });
            }}
          >
            <Input placeholder="Full name" value={form.full_name} onChange={set("full_name")} />
            <Input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={set("email")}
              required
            />
            <Input
              type="password"
              placeholder="Password (8+ chars, letter + number)"
              value={form.password}
              onChange={set("password")}
              minLength={8}
              required
            />
            {register.isError && (
              <p className="text-sm text-danger">{apiErrorMessage(register.error)}</p>
            )}
            <Button
              type="submit"
              className="w-full gradient-fill text-white shadow-glow hover:opacity-95"
              disabled={register.isPending}
            >
              {register.isPending ? "Please wait…" : "Create account"}
            </Button>
          </form>
        </>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            verify.mutate({ email: form.email, code });
          }}
        >
          <Input
            inputMode="numeric"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
            required
          />
          {verify.isError && (
            <p className="text-sm text-danger">{apiErrorMessage(verify.error)}</p>
          )}
          <Button
            type="submit"
            className="w-full gradient-fill text-white shadow-glow hover:opacity-95"
            disabled={verify.isPending || code.length !== 6}
          >
            {verify.isPending ? "Verifying…" : "Verify & create account"}
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm text-text-muted hover:text-primary"
            onClick={() => {
              setSent(false);
              setCode("");
            }}
          >
            Change details
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
