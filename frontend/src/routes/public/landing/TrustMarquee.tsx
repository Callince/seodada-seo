const ECOSYSTEM = [
  "Search Console",
  "Google Analytics",
  "WordPress",
  "Shopify",
  "Razorpay",
  "Cloudflare",
  "Bing Webmaster",
  "Looker Studio",
];

export function TrustMarquee() {
  return (
    <section className="border-y border-border bg-surface py-10">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
        Plays nicely with the tools your team already uses
      </p>
      <div className="marquee-wrap group relative mt-6 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
        <div className="marquee gap-14 pr-14">
          {[...ECOSYSTEM, ...ECOSYSTEM].map((name, i) => (
            <span key={i} className="whitespace-nowrap text-xl font-bold tracking-tight text-text-muted/60 grayscale transition group-hover:text-text-muted/80">
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
