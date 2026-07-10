import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { assetUrl, usePublicWebstory } from "@/api/hooks/useContentPublic";
import { Seo } from "@/lib/seo";

/** Tap-through web-story player: full-viewport slides with progress bar,
 *  tap zones (prev/next), and heading/text overlays. */
export default function WebStoryViewer() {
  const { slug = "" } = useParams();
  const { data: story, isLoading, isError } = usePublicWebstory(slug);
  const [i, setI] = useState(0);

  const slides = story?.slides ?? [];
  const next = () => setI((n) => Math.min(n + 1, slides.length - 1));
  const prev = () => setI((n) => Math.max(n - 1, 0));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length]);

  if (isLoading) return <div className="grid h-screen place-items-center bg-black text-white/70">Loading…</div>;
  if (isError || !story || !slides.length) {
    return (
      <div className="grid h-screen place-items-center bg-black text-center text-white">
        <div>
          <Seo title="Story not found" noindex />
          <p className="text-lg font-semibold">Story not found</p>
          <Link to="/webstories" className="mt-3 inline-block text-sm text-white/70 hover:text-white">← All web stories</Link>
        </div>
      </div>
    );
  }

  const slide = slides[i];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <Seo title={story.title} description={story.meta_description} type="article" path={`/webstories/${story.slug}`} />
      <div className="relative h-full w-full max-w-[420px] overflow-hidden bg-black sm:h-[92vh] sm:rounded-2xl">
        {/* Progress bars */}
        <div className="absolute inset-x-0 top-0 z-20 flex gap-1 p-2">
          {slides.map((_, idx) => (
            <span key={idx} className="h-1 flex-1 rounded-full bg-white/30">
              <span className={`block h-full rounded-full bg-white transition-all ${idx <= i ? "w-full" : "w-0"}`} />
            </span>
          ))}
        </div>
        <Link to="/webstories" className="absolute right-3 top-4 z-20 rounded-full bg-black/40 p-1.5 text-white backdrop-blur">
          <X size={18} />
        </Link>

        {/* Slide image */}
        {slide.image && (
          <img src={assetUrl(slide.image)} alt={slide.image_alt || ""} className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />

        {/* Text overlay */}
        <div className="absolute inset-x-0 bottom-0 z-10 p-6 text-white">
          {slide.heading && (
            <div className="text-2xl font-extrabold leading-tight [&_p]:m-0" dangerouslySetInnerHTML={{ __html: slide.heading }} />
          )}
          {slide.text && (
            <div className="mt-3 text-sm leading-relaxed text-white/90 [&_p]:m-0" dangerouslySetInnerHTML={{ __html: slide.text }} />
          )}
          {slide.learn_more_url && (
            <a href={slide.learn_more_url} target="_blank" rel="noreferrer" className="mt-4 inline-block rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-black">
              Learn more
            </a>
          )}
        </div>

        {/* Tap zones */}
        <button onClick={prev} className="absolute inset-y-0 left-0 z-10 w-1/3" aria-label="Previous" />
        <button onClick={next} className="absolute inset-y-0 right-0 z-10 w-2/3" aria-label="Next" />
      </div>
    </div>
  );
}
