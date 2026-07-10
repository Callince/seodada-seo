import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

/** Shared admin form/modal primitives so the tab components stay consistent. */

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export const inr = (cents: number) => "₹" + (cents / 100).toLocaleString("en-IN");

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[8vh]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <Card
        className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} animate-fade-rise`}
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X size={16} />
          </Button>
        </CardHeader>
        <CardBody className="max-h-[75vh] overflow-y-auto">{children}</CardBody>
      </Card>
    </div>
  );
}

export function ModalActions({ onClose, loading, label }: { onClose: () => void; loading: boolean; label: string }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <Button type="button" variant="ghost" onClick={onClose}>
        Cancel
      </Button>
      <Button type="submit" loading={loading}>
        {label}
      </Button>
    </div>
  );
}

/** A labelled stat pill row used across the inbox/logs/usage tabs. */
export function MiniStats({ items }: { items: { label: string; value: string | number; accent?: boolean }[] }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((s) => (
        <div key={s.label} className="rounded-xl border border-border bg-surface p-3">
          <p className="text-xs text-text-muted">{s.label}</p>
          <p className={`mt-0.5 text-xl font-bold ${s.accent ? "gradient-text" : "text-text"}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}
