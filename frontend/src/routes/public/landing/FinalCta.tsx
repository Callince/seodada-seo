import { ArrowRight, Bell, PhoneCall, ShieldCheck, Zap } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";

import { Magnetic, Particles, Reveal } from "@/components/public/landingKit";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/store/auth";

export function FinalCta() {
  const authed = useAuth((s) => !!s.accessToken);

  const primaryTo = authed ? "/dashboard" : "/register";
  const primaryLabel = authed ? "Go to dashboard" : "Start free trial";

  return (
    <section className="px-4 pb-24 sm:px-6">
      <Reveal>
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[36px] px-6 py-20 text-center lp-shadow-lg sm:px-12 sm:py-24">
          <div className="absolute inset-0 -z-10 gradient-fill" />
          <div className="lp-mesh absolute inset-0 -z-10 opacity-40 mix-blend-overlay" />
          <Particles count={20} className="-z-10 opacity-60" />
          <h2 className="mx-auto max-w-3xl text-5xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl">
            Dominate search — classic, AI, and everything next.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/80">
            Start free, no credit card. Or book a demo and we'll map your growth plan.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Magnetic>
              <RouterLink to={primaryTo}>
                <Button size="lg" variant="secondary" className="rounded-full bg-white text-[#2e3f87] shadow-lg hover:bg-white/90">
                  {primaryLabel} <ArrowRight size={16} />
                </Button>
              </RouterLink>
            </Magnetic>
            <RouterLink to="/contact">
              <Button size="lg" variant="secondary" className="rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20">
                <PhoneCall size={15} /> Book a demo
              </Button>
            </RouterLink>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-sm text-white/80">
            {[
              { icon: Zap, label: "Free instant tools" },
              { icon: ShieldCheck, label: "GDPR-friendly" },
              { icon: Bell, label: "Cancel any time" },
            ].map((t) => (
              <span key={t.label} className="inline-flex items-center gap-2">
                <t.icon size={15} /> {t.label}
              </span>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
