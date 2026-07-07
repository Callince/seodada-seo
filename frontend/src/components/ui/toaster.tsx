import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

import { cn } from "@/lib/cn";
import { useToastStore, type ToastKind } from "@/store/toast";

const ICON: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};
const TONE: Record<ToastKind, string> = {
  success: "text-success",
  error: "text-danger",
  info: "text-info",
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-full max-w-xs flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICON[t.kind];
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex animate-fade-rise items-start gap-2.5 rounded-lg border border-border bg-surface px-3 py-2.5 shadow-md"
          >
            <Icon size={16} className={cn("mt-0.5 shrink-0", TONE[t.kind])} />
            <span className="flex-1 text-sm text-text">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-text-muted transition-colors hover:text-text"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
