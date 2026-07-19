import { Play } from "lucide-react";
import { Link } from "react-router-dom";

import { assetUrl, usePublicWebstories } from "@/api/hooks/useContentPublic";
import { PublicHero } from "@/components/public/PublicHero";
import { Seo } from "@/lib/seo";

/** Public web-stories index — the real migrated seodada stories. */
export default function WebStories() {
  const { data: stories } = usePublicWebstories();

  return (
    <div>
      <Seo
        title="Web Stories"
        description="Explore our engaging web stories about SEO, digital marketing, and technology insights."
        path="/webstories"
      />
      <PublicHero
        eyebrow="Web Stories"
        title="SEO, told in"
        highlight="quick visual stories"
        subtitle="Bite-sized, tap-through explainers on the SEO topics that move rankings."
        compact
      />

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {(stories ?? []).map((s) => (
            <Link
              key={s.slug}
              to={`/webstories/${s.slug}`}
              className="group relative aspect-[9/16] overflow-hidden rounded-2xl border border-border shadow-sm"
            >
              {s.cover_image_url ? (
                <img src={assetUrl(s.cover_image_url)} alt={s.title} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              ) : (
                <div className="h-full w-full" style={{ background: "linear-gradient(160deg,var(--signal-0),var(--signal-2) 60%,var(--signal-4))" }} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <span className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/20 text-white backdrop-blur">
                <Play size={14} />
              </span>
              <p className="absolute inset-x-0 bottom-0 p-3 text-sm font-semibold leading-tight text-white">
                {s.title}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
