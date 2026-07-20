import { LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { AccountMenu } from "@/components/shared/AccountMenu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useDarkMode } from "@/lib/useDarkMode";
import { useAuth } from "@/store/auth";

// lucide-react dropped brand glyphs for trademark reasons, so the social icons
// are inlined as simple-icons paths (single 24×24 path each).
function BrandIcon({ path, ...props }: { path: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden {...props}>
      <path d={path} />
    </svg>
  );
}
const BRAND = {
  facebook:
    "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z",
  linkedin:
    "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  instagram:
    "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z",
  youtube:
    "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
} as const;

const NAV = [
  { to: "/free-tools", label: "Tools" },
  { to: "/features", label: "Features" },
  { to: "/pricing", label: "Pricing" },
  { to: "/blog", label: "Blog" },
  { to: "/about", label: "About" },
  { to: "/help", label: "Help" },
];

const SOCIALS = [
  { path: BRAND.facebook, label: "Facebook", href: "https://www.facebook.com/profile.php?id=61584072508577" },
  { path: BRAND.linkedin, label: "LinkedIn", href: "https://www.linkedin.com/company/seodada/" },
  { path: BRAND.instagram, label: "Instagram", href: "https://www.instagram.com/seodada1" },
  { path: BRAND.youtube, label: "YouTube", href: "https://youtube.com/@seodada-s4b" },
];

const FOOTER_COLS: { title: string; links: { to: string; label: string; external?: boolean }[] }[] = [
  {
    title: "Platform",
    links: [
      { to: "/serp", label: "SERP Ranking" },
      { to: "/keywords", label: "Keyword Research" },
      { to: "/domains", label: "Domain Analytics" },
      { to: "/audit", label: "Site Audit" },
      { to: "/rank", label: "Rank Tracking" },
      { to: "/ai-visibility", label: "AI Visibility" },
      { to: "/features", label: "All features →" },
    ],
  },
  {
    title: "Resources",
    links: [
      { to: "/free-tools", label: "Free SEO Tools" },
      { to: "/content", label: "Content Checker Tool" },
      { to: "/guides/technical-seo", label: "Technical SEO Guide" },
      { to: "/blog", label: "Blog" },
      { to: "/webstories", label: "Web Stories" },
      { to: "/help", label: "Help Center" },
    ],
  },
  {
    title: "Company",
    links: [
      { to: "/about", label: "About Us" },
      { to: "/pricing", label: "Pricing" },
      { to: "/contact", label: "Contact Us" },
    ],
  },
];

function Logo({ scrolled }: { scrolled: boolean }) {
  return (
    <Link to="/" className="flex shrink-0 items-center" aria-label="seodada home">
      {/* Matches the nav capsule's 54px from lg up, where the capsule exists.
          The PNG is fully trimmed — measured 0% transparent padding on both
          axes — so the box height IS the artwork height and 54px lines up.
          `shrink-0` is load-bearing: the header is a flex row, and without it
          the image was squeezed to fit rather than keeping its 3.75 aspect
          (it rendered 67px wide instead of 202 at tablet widths).
          The magnifier handle protrudes below the wordmark, which drops the
          geometric centre below the visual one; the nudge corrects for that. */}
      <img
        src="/content-assets/logo_1761200794.png"
        alt="seodada"
        width={202}
        height={54}
        className={cn(
          "w-auto shrink-0 translate-y-[2px] transition-[height] duration-500 ease-out",
          // Tracks the capsule through its morph: 54px at rest, 50px once the
          // pill tightens on scroll. Without this the logo stayed 54 and drifted
          // 4px taller than the pill it is supposed to match.
          scrolled ? "h-10 lg:h-[50px]" : "h-11 lg:h-[54px]",
        )}
      />
    </Link>
  );
}

export function PublicShell() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const authed = useAuth((s) => !!s.accessToken);
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const { pathname } = useLocation();
  const { dark, toggle } = useDarkMode();

  // The centre nav pill floats as a glass capsule and morphs once scrolled.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      {/* ===== Dynamic-island nav — floating glass pill that morphs on scroll =====
          Every public page opens with a permanently-dark hero, so at rest the
          header sits ON that navy and adopts the same `.lp-hero` token scope the
          hero uses: nav links were 3.0:1 and "Log in" 2.56:1 against it once the
          landing switched to the dark backdrop. Past the fold it drops the scope
          and returns to the theme tokens for the light content below. */}
      <header
        className={cn(
          "pointer-events-none fixed inset-x-0 top-0 z-40 px-3 sm:px-4",
          !scrolled && "lp-hero",
        )}
      >
        {/* Three columns, not `justify-between`. With flex the pill lands wherever
            the two flanks leave room — logo is 165px, the actions cluster is ~180,
            so it sat ~8px off centre and drifted again whenever the right side
            changed (signed in vs out swaps two buttons for one avatar). Equal
            1fr flanks centre it on the viewport regardless of what's beside it. */}
        <div className="mx-auto mt-3 grid max-w-6xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:mt-4">
          {/* Logo — floats free on the left (outside the pill) */}
          <div className="pointer-events-auto">
            <Logo scrolled={scrolled} />
          </div>

          {/* Center island — holds ONLY the nav links; morphs on scroll */}
          <nav
            className={cn(
              "pointer-events-auto hidden items-center gap-1 rounded-full border border-border backdrop-blur-xl transition-all duration-500 ease-out lg:flex",
              scrolled
                ? "bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] px-2 py-1.5 lp-shadow-lg"
                : "bg-[color-mix(in_srgb,var(--surface)_65%,transparent)] px-2.5 py-2 shadow-md",
            )}
          >
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-full px-3.5 py-2 text-sm font-medium tracking-wide transition-colors",
                    isActive ? "text-primary-ink" : "text-text-muted hover:text-text",
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          {/* Actions — float free on the right (outside the pill) */}
          <div className="pointer-events-auto flex items-center justify-self-end gap-2">
            {/* The public site had no way to change theme, so a visitor whose
                stored preference is dark got the landing in dark with no exit. */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
              className="rounded-full"
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </Button>
            <div className="hidden items-center gap-2 lg:flex">
              {authed ? (
                <AccountMenu />
              ) : (
                <>
                  {/* size="md" (h-10), not "sm" (h-8) — the header cluster had
                      three control heights side by side: the 40px theme toggle
                      next to two 32px buttons. One height reads as one row. */}
                  <Link to="/login">
                    <Button variant="ghost" size="md" className="rounded-full">
                      Log in
                    </Button>
                  </Link>
                  <Link to="/register">
                    <Button size="md" className="rounded-full">
                      Get started
                    </Button>
                  </Link>
                </>
              )}
            </div>

            <button
              className="grid h-10 w-10 place-items-center rounded-full border border-border bg-[color-mix(in_srgb,var(--surface)_75%,transparent)] text-text-muted backdrop-blur transition-colors hover:bg-surface-2 lg:hidden"
              onClick={() => setOpen((o) => !o)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="public-mobile-menu"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu — floating panel below the island */}
        {open && (
          <div id="public-mobile-menu" className="pointer-events-auto mx-auto mt-2 max-h-[75vh] w-full max-w-md overflow-y-auto rounded-3xl border border-border bg-surface p-3 lp-shadow-lg lg:hidden">
            <div className="flex flex-col gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  className="rounded-xl px-3 py-2 text-sm font-medium text-text-muted hover:bg-surface-2 hover:text-text"
                >
                  {n.label}
                </Link>
              ))}
              {/* Auth-aware. This block used to be hardcoded to Log in /
                  Get started, so a signed-in visitor on mobile or tablet was
                  invited to sign in again and had no way to sign out. */}
              {authed ? (
                <div className="mt-2 border-t border-border pt-2">
                  <div className="px-3 py-1.5">
                    <p className="truncate text-sm font-medium text-text">
                      {user?.full_name || "Account"}
                    </p>
                    <p className="truncate text-xs text-text-muted">{user?.email}</p>
                  </div>
                  <Link to="/dashboard" className="mt-1 block">
                    <Button size="sm" className="w-full rounded-full">
                      Go to dashboard
                    </Button>
                  </Link>
                  <button
                    onClick={logout}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-text-muted hover:bg-surface-2 hover:text-text"
                  >
                    <LogOut size={15} aria-hidden /> Log out
                  </button>
                </div>
              ) : (
                <div className="mt-2 flex gap-2">
                  <Link to="/login" className="flex-1">
                    <Button variant="secondary" size="sm" className="w-full rounded-full">
                      Log in
                    </Button>
                  </Link>
                  <Link to="/register" className="flex-1">
                    <Button size="sm" className="w-full rounded-full">
                      Get started
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Every public page draws its own full-bleed dark hero (with built-in
          top padding to clear the fixed header), so main needs no top pad. */}
      <main className="flex-1">
        <Suspense fallback={<div className="min-h-[60vh]" />}>
          <Outlet />
        </Suspense>
      </main>

      {/* ===== Footer — matches seodada.com ===== */}
      <footer
        className="text-[color:var(--footer-text)]"
        style={{ backgroundColor: "var(--footer)" }}
      >
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
            <div>
              <Link to="/" className="flex items-center" aria-label="seodada home">
                <img
                  src="/content-assets/logo_1761200794.png"
                  alt="seodada"
                  width={148}
                  height={40}
                  className="h-10 w-auto"
                />
              </Link>
              <p className="mt-4 max-w-xs text-sm leading-relaxed">
                Enterprise SEO analytics for data-driven teams — research, tracking, technical
                audits, and AI content in one platform.
              </p>
              <div className="mt-5 flex gap-2.5">
                {SOCIALS.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={s.label}
                    className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-[color:var(--footer-text)] transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <BrandIcon path={s.path} />
                  </a>
                ))}
              </div>
            </div>

            {FOOTER_COLS.map((col) => (
              <div key={col.title}>
                <h3 className="text-sm font-bold text-white">{col.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link to={l.to} className="text-sm transition-colors hover:text-white">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 md:flex-row">
            <p className="text-sm">© {new Date().getFullYear()} SEO Dada. All rights reserved.</p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              <Link to="/privacy" className="text-sm transition-colors hover:text-white">
                Privacy Policy
              </Link>
              <Link to="/terms" className="text-sm transition-colors hover:text-white">
                Terms of Service
              </Link>
              <Link to="/cookies" className="text-sm transition-colors hover:text-white">
                Cookie &amp; Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
