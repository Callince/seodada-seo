import { ChevronDown, ExternalLink } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/cn";
import type { PaaItem } from "@/types";

export function PAAList({ items }: { items: PaaItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  if (!items.length) return null;

  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={i}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-2"
            >
              <span className="text-sm font-medium text-text">{it.question}</span>
              <ChevronDown
                size={16}
                aria-hidden
                className={cn(
                  "shrink-0 text-text-muted transition-transform",
                  isOpen && "rotate-180",
                )}
              />
            </button>
            {isOpen && (
              <div className="animate-fade-rise px-4 pb-4 text-sm text-text-muted">
                {it.answer ? (
                  <p>{it.answer}</p>
                ) : (
                  <p className="italic">
                    Google serves this answer dynamically, so no snippet was
                    returned with the SERP. Open it on Google below.
                  </p>
                )}
                <a
                  href={
                    it.url ||
                    `https://www.google.com/search?q=${encodeURIComponent(it.question)}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[color:var(--section)] hover:underline"
                >
                  <ExternalLink size={12} /> {it.url ? "Source" : "Search on Google"}
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
