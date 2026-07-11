import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/** Shared branded shell for the auth pages (login, register, forgot/reset).
 *  Centered card over the aurora brand backdrop — consistent with the public
 *  site so sign-in doesn't feel like a different product. */
const PREVIEW_KPIS = [
  { label: "Organic traffic", value: "284k", delta: "+34%" },
  { label: "Keywords", value: "12.4k", delta: "+18%" },
  { label: "Authority", value: "71", delta: "+3" },
];

/** Left brand panel — gradient with a floating dashboard preview (lg+ only). */
function BrandPanel() {
  return (
    <div
      className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-14"
      style={{ background: "linear-gradient(150deg, #2e3f87, #1d7dbd 58%, #45a8f5)" }}
    >
      {/* ambient glow + grid */}
      <div className="cyber-grid pointer-events-none absolute inset-0 opacity-[0.12]" aria-hidden />
      <div className="float-slow pointer-events-none absolute -left-24 top-8 h-72 w-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
      <div className="float-slower pointer-events-none absolute -right-12 bottom-8 h-80 w-80 rounded-full bg-[#7dd3fc]/25 blur-3xl" aria-hidden />

      <Link to="/" className="relative z-10 inline-flex w-fit" aria-label="seodada home">
        <img
          src="/content-assets/logo_1761200794.png"
          alt="seodada"
          width={119}
          height={32}
          className="h-9 w-auto drop-shadow-md"
        />
      </Link>

      {/* floating dashboard preview */}
      <div className="relative z-10 my-8">
        <div className="float-slow rounded-2xl border border-white/25 bg-[#122a5c]/55 p-5 shadow-2xl backdrop-blur-xl">
          <div className="grid grid-cols-3 gap-3">
            {PREVIEW_KPIS.map((k) => (
              <div key={k.label} className="rounded-xl bg-white/10 p-3">
                <p className="text-[10px] uppercase tracking-wide text-white/80">{k.label}</p>
                <p className="mt-0.5 text-lg font-extrabold text-white">{k.value}</p>
                <p className="text-[11px] font-semibold text-emerald-300">{k.delta}</p>
              </div>
            ))}
          </div>
          <svg viewBox="0 0 260 64" preserveAspectRatio="none" className="mt-4 h-16 w-full" aria-hidden>
            <defs>
              <linearGradient id="auth-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,48 C34,42 46,22 78,27 C110,32 122,10 154,16 C186,22 208,8 260,13 L260,64 L0,64 Z"
              fill="url(#auth-area)"
            />
            <path
              d="M0,48 C34,42 46,22 78,27 C110,32 122,10 154,16 C186,22 208,8 260,13"
              fill="none"
              stroke="#fff"
              strokeOpacity="0.85"
              strokeWidth="2"
            />
          </svg>
        </div>
        <div className="float-slower absolute -bottom-5 -right-3 rounded-xl border border-white/25 bg-[#122a5c]/70 px-3 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-xl">
          <span className="text-emerald-300">▲</span> Rank #3 · running shoes
        </div>
      </div>

      <div className="relative z-10">
        <h2 className="max-w-md text-2xl font-extrabold leading-tight xl:text-3xl">
          See the insights your SEO tools miss.
        </h2>
        <p className="mt-2 max-w-sm text-sm text-white/80">
          Research, audit, optimize and track — across classic search and AI answer engines, in one
          workspace.
        </p>
        <div className="mt-5 flex items-center gap-3 text-sm text-white/90">
          <div className="flex -space-x-2">
            {["PN", "AM", "SO", "RK"].map((i) => (
              <span
                key={i}
                className="grid h-7 w-7 place-items-center rounded-full border border-white/60 bg-[#122a5c]/60 text-[10px] font-bold text-white backdrop-blur"
              >
                {i}
              </span>
            ))}
          </div>
          Trusted by 2,000+ teams
        </div>
      </div>
    </div>
  );
}

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
    <div className="flex min-h-screen bg-app-bg">
      <BrandPanel />

      {/* form side */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-6 flex justify-center lg:hidden" aria-label="seodada home">
            <img
              src="/content-assets/logo_1761200794.png"
              alt="seodada"
              width={119}
              height={32}
              className="h-9 w-auto"
            />
          </Link>

          <div className="rounded-2xl border border-border bg-surface p-7 lp-shadow-lg">
            <h1 className="text-xl font-bold tracking-tight text-text">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-text-muted">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>

          {footer && <div className="mt-5 text-center text-sm text-text-muted">{footer}</div>}
        </div>
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
