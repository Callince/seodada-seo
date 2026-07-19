import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Play, Star } from "lucide-react";
import { useState } from "react";

import { LandingImage, Reveal } from "@/components/public/landingKit";

// PLACEHOLDER — swap for real quotes/photos before launch.
// `avatar` points at /public/content-assets/landing/*; until those files exist
// the UI falls back to the gradient initials (see LandingImage).
const TESTIMONIALS = [
  { quote: "We replaced three SEO subscriptions with seodada. The audit alone paid for it in week one.", name: "Priya Nair", role: "Head of Growth, Nimbus Retail", initials: "PN", avatar: "/content-assets/landing/avatar-1.png" },
  { quote: "The free URL and sitemap tools are how our whole team checks pages before they ship.", name: "Arjun Mehta", role: "SEO Lead, Kavi Media", initials: "AM", avatar: "/content-assets/landing/avatar-2.png" },
  { quote: "Rank tracking plus the AI advisor means I walk into calls with the fixes already written.", name: "Sara Okoye", role: "Founder, Okoye Digital", initials: "SO", avatar: "/content-assets/landing/avatar-3.png" },
  { quote: "GEO and AI-visibility tracking is something no other tool in our stack does. Game changer.", name: "Rahul Kapoor", role: "CMO, Vaan Labs", initials: "RK", avatar: "/content-assets/landing/avatar-4.png" },
];

export function Testimonials() {
  const [tIdx, setTIdx] = useState(0);

  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-1 text-warning">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={16} fill="currentColor" />
              ))}
              <span className="ml-2 text-sm font-semibold text-text">4.9/5 · 500+ reviews</span>
            </div>
            <h2 className="mt-3 text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">Loved by SEO teams</h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTIdx((n) => (n - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)}
              aria-label="Previous testimonial"
              className="grid h-11 w-11 place-items-center rounded-full border border-border bg-surface text-text-muted transition hover:border-primary hover:text-primary-ink"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setTIdx((n) => (n + 1) % TESTIMONIALS.length)}
              aria-label="Next testimonial"
              className="grid h-11 w-11 place-items-center rounded-full border border-border bg-surface text-text-muted transition hover:border-primary hover:text-primary-ink"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </Reveal>

        <div className="mt-10 overflow-hidden">
          <motion.div className="flex" animate={{ x: `calc(-${tIdx} * (100% / 1))` }} transition={{ type: "spring", stiffness: 120, damping: 20 }}>
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="w-full shrink-0 md:w-1/2 md:pr-6 lg:w-1/3">
                <figure className="lp-card flex h-full flex-col rounded-3xl border border-border lp-glass p-7 lp-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-warning">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={13} fill="currentColor" />
                      ))}
                    </div>
                    <button aria-label="Play video testimonial" className="grid h-11 w-11 place-items-center rounded-full bg-primary-soft text-primary-ink transition hover:gradient-fill hover:text-white">
                      <Play size={14} />
                    </button>
                  </div>
                  <blockquote className="mt-4 flex-1 leading-relaxed text-text">"{t.quote}"</blockquote>
                  <figcaption className="mt-6 flex items-center gap-3">
                    <LandingImage
                      src={t.avatar}
                      alt={t.name}
                      className="h-11 w-11 shrink-0 rounded-full object-cover"
                      fallback={
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full gradient-fill text-sm font-bold text-white">
                          {t.initials}
                        </span>
                      }
                    />
                    <span>
                      <span className="block text-sm font-semibold text-text">{t.name}</span>
                      <span className="block text-xs text-text-muted">{t.role}</span>
                    </span>
                  </figcaption>
                </figure>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
