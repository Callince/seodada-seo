import { ShieldCheck } from "lucide-react";
import { useState } from "react";

import { useAdminLogin } from "@/api/hooks/useAuth";
import { apiErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminLogin() {
  const login = useAdminLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05091a] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl gradient-fill text-white shadow-glow">
            <ShieldCheck size={22} />
          </span>
          <h1 className="text-xl font-bold text-white">Admin Console</h1>
          <p className="text-sm text-white/50">Restricted — platform administrators only.</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-7 backdrop-blur">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              login.mutate({ email, password });
            }}
          >
            <Input
              type="email"
              placeholder="Admin email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-white/15 bg-white/5 text-white placeholder:text-white/40"
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-white/15 bg-white/5 text-white placeholder:text-white/40"
              required
            />
            {login.isError && <p className="text-sm text-danger">{apiErrorMessage(login.error)}</p>}
            <Button
              type="submit"
              className="w-full"
              disabled={login.isPending}
            >
              {login.isPending ? "Signing in…" : "Sign in to admin"}
            </Button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-white/40">
          <a href="/" className="hover:text-white/70">
            ← Back to site
          </a>
        </p>
      </div>
    </div>
  );
}
