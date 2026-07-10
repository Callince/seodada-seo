import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/** Shared branded shell for the auth pages (login, register, forgot/reset).
 *  Centered card over the aurora brand backdrop — consistent with the public
 *  site so sign-in doesn't feel like a different product. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="aurora-bg relative flex min-h-screen items-center justify-center overflow-hidden bg-app-bg p-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl gradient-fill text-white shadow-glow">
            <Search size={17} />
          </span>
          <span className="text-xl font-extrabold lowercase tracking-tight">
            <span className="gradient-text">seo</span>
            <span className="text-text">dada</span>
          </span>
        </Link>

        <div className="rounded-2xl border border-border bg-surface p-7 shadow-lg">
          <h1 className="text-center text-xl font-bold tracking-tight text-text">{title}</h1>
          {subtitle && <p className="mt-1.5 text-center text-sm text-text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>

        {footer && <div className="mt-5 text-center text-sm text-text-muted">{footer}</div>}
      </div>
    </div>
  );
}

/** The "Continue with Google" button — shared by login and register. */
export function GoogleButton({ label = "Continue with Google" }: { label?: string }) {
  return (
    <a
      href="/api/v1/auth/google/login"
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface py-2.5 text-sm font-medium text-text transition-colors hover:bg-surface-2"
    >
      <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.7 30.1 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6.1C12.2 13.3 17.6 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.2-3.9 6.6-9.6 6.6-16z" />
        <path fill="#FBBC05" d="M10.3 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.8-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.7l7.8-6.1z" />
        <path fill="#34A853" d="M24 48c6.1 0 11.3-2 15-5.5l-7.1-5.5c-2 1.3-4.5 2.1-7.9 2.1-6.4 0-11.8-3.8-13.7-9.4l-7.8 6.1C6.4 42.6 14.6 48 24 48z" />
      </svg>
      {label}
    </a>
  );
}

/** "or" divider between Google and the email form. */
export function OrDivider() {
  return (
    <div className="my-4 flex items-center gap-3 text-xs text-text-muted">
      <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
    </div>
  );
}
