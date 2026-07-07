import { Menu, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useAuth } from "@/store/auth";

const NAV = [
  { to: "/features", label: "Features" },
  { to: "/pricing", label: "Pricing" },
  { to: "/blog", label: "Blog" },
  { to: "/about", label: "About" },
  { to: "/help", label: "Help" },
];

const FOOTER = {
  Product: [
    { to: "/features", label: "Features" },
    { to: "/pricing", label: "Pricing" },
    { to: "/dashboard", label: "Dashboard" },
    { to: "/blog", label: "Blog" },
  ],
  Company: [
    { to: "/about", label: "About" },
    { to: "/contact", label: "Contact" },
    { to: "/help", label: "Help center" },
  ],
  Legal: [
    { to: "/privacy", label: "Privacy" },
    { to: "/terms", label: "Terms" },
    { to: "/cookies", label: "Cookie policy" },
  ],
};

function Logo({ light }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-xl gradient-fill text-white shadow-glow">
        <Search size={16} />
      </span>
      <span className="text-lg font-extrabold lowercase tracking-tight">
        <span className="gradient-text">seo</span>
        <span className={light ? "text-white" : "text-text"}>dada</span>
      </span>
    </Link>
  );
}

export function PublicShell() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const authed = useAuth((s) => !!s.accessToken);
  const { pathname } = useLocation();

  // The landing hero is a dark full-bleed photo; float a transparent, white
  // header over it and swap to the solid glass bar once the user scrolls past.
  const overHero = pathname === "/" && !scrolled;
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top nav */}
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 transition-colors duration-300",
          overHero ? "bg-transparent" : "border-b border-border glass",
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo light={overHero} />
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-full px-3.5 py-2 text-sm font-medium tracking-wide transition-colors",
                    overHero
                      ? "text-white/80 hover:text-white"
                      : isActive
                        ? "text-primary"
                        : "text-text-muted hover:text-text",
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            {authed ? (
              <Link to="/dashboard">
                <Button size="sm">Go to dashboard</Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={overHero ? "text-white hover:bg-white/10" : ""}
                  >
                    Log in
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm" className="gradient-fill text-white shadow-glow hover:opacity-95">
                    Sign up
                  </Button>
                </Link>
              </>
            )}
          </div>
          <button
            className={cn(
              "rounded-md p-2 md:hidden",
              overHero ? "text-white hover:bg-white/10" : "text-text-muted hover:bg-surface-2",
            )}
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {/* Mobile menu */}
        {open && (
          <div className="border-t border-border bg-surface px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-text-muted hover:bg-surface-2 hover:text-text"
                >
                  {n.label}
                </Link>
              ))}
              <div className="mt-2 flex gap-2">
                <Link to="/login" className="flex-1" onClick={() => setOpen(false)}>
                  <Button variant="secondary" size="sm" className="w-full">
                    Log in
                  </Button>
                </Link>
                <Link to="/register" className="flex-1" onClick={() => setOpen(false)}>
                  <Button size="sm" className="w-full gradient-fill text-white">
                    Sign up
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Non-landing pages need top padding to clear the fixed header; the
          landing draws its own full-bleed hero underneath it. */}
      <main className={cn("flex-1", pathname !== "/" && "pt-16")}>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-text-muted">
              One platform for SEO intelligence, rank tracking, technical audits, and AI-driven
              content — built for data-driven teams.
            </p>
          </div>
          {Object.entries(FOOTER).map(([group, links]) => (
            <div key={group}>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                {group}
              </p>
              <ul className="mt-3 space-y-2">
                {links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="text-sm text-text-muted hover:text-text">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-5 text-xs text-text-muted sm:px-6">
            © {new Date().getFullYear()} seodada. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
