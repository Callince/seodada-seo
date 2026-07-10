import { Download, Mail, Trash2 } from "lucide-react";
import { useState } from "react";

import { apiErrorMessage } from "@/api/client";
import {
  downloadAdminFile,
  useContactSubmissions,
  useDeleteContact,
  useReplyContact,
  useUpdateContact,
  type ContactSubmission,
} from "@/api/hooks/useAdmin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/store/toast";
import { fmtDateTime, Field, Modal, MiniStats } from "@/routes/admin/ui";

const STATUS_TONE: Record<string, "success" | "info" | "neutral" | "danger"> = {
  new: "info",
  read: "neutral",
  responded: "success",
  spam: "danger",
};

function DetailModal({ sub, onClose }: { sub: ContactSubmission; onClose: () => void }) {
  const update = useUpdateContact();
  const reply = useReplyContact();
  const del = useDeleteContact();
  const [notes, setNotes] = useState(sub.admin_notes);
  const [status, setStatus] = useState(sub.status);
  const [subject, setSubject] = useState(`Re: your message to seodada`);
  const [message, setMessage] = useState("");

  return (
    <Modal title={`Message from ${sub.name}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-app-bg p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <a href={`mailto:${sub.email}`} className="text-sm font-medium text-primary hover:underline">
              {sub.email}
            </a>
            <span className="text-xs text-text-muted">{fmtDateTime(sub.created_at)}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-text">{sub.message}</p>
          {sub.ip && <p className="mt-2 text-xs text-text-muted">IP: {sub.ip}</p>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full">
              <option value="new">New</option>
              <option value="read">Read</option>
              <option value="responded">Responded</option>
              <option value="spam">Spam</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <Button
              variant="secondary"
              loading={update.isPending}
              onClick={() =>
                update.mutate(
                  { id: sub.id, status, admin_notes: notes },
                  { onSuccess: () => toast.success("Saved"), onError: (e) => toast.error(apiErrorMessage(e)) },
                )
              }
            >
              Save status & notes
            </Button>
          </div>
        </div>
        <Field label="Admin notes (internal)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </Field>

        <div className="rounded-xl border border-border p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text">
            <Mail size={14} /> Reply by email
          </p>
          <div className="space-y-2">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Write your reply…"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <Button
              className="gradient-fill text-white shadow-glow"
              loading={reply.isPending}
              disabled={!subject.trim() || !message.trim()}
              onClick={() =>
                reply.mutate(
                  { id: sub.id, subject, message },
                  {
                    onSuccess: () => { toast.success(`Reply sent to ${sub.email}`); onClose(); },
                    onError: (e) => toast.error(apiErrorMessage(e)),
                  },
                )
              }
            >
              Send reply
            </Button>
          </div>
        </div>

        <div className="flex justify-between border-t border-border pt-3">
          <Button
            variant="ghost"
            onClick={() => {
              if (confirm("Delete this submission?"))
                del.mutate(sub.id, { onSuccess: () => { toast.success("Deleted"); onClose(); } });
            }}
          >
            <Trash2 size={14} className="text-danger" /> Delete
          </Button>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}

export function ContactTab() {
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");
  const { data, isPending } = useContactSubmissions({ status_filter: statusFilter || undefined, q: q || undefined });
  const [open, setOpen] = useState<ContactSubmission | null>(null);

  return (
    <div className="space-y-4">
      <MiniStats
        items={[
          { label: "Total", value: data?.total ?? "—" },
          { label: "New", value: data?.new_count ?? "—", accent: true },
          { label: "Responded", value: data?.responded_count ?? "—" },
          { label: "Today", value: data?.today_count ?? "—" },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="read">Read</option>
          <option value="responded">Responded</option>
          <option value="spam">Spam</option>
        </Select>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…" className="max-w-xs" />
        <div className="ml-auto">
          <Button
            variant="secondary"
            onClick={() => downloadAdminFile("/admin/contact-submissions/export", "contact-submissions.csv", { status_filter: statusFilter || undefined })}
          >
            <Download size={14} /> Export CSV
          </Button>
        </div>
      </div>

      {isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
                  <th className="py-2 pl-4 pr-4">From</th>
                  <th className="py-2 pr-4">Message</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Received</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer border-b border-border/60 hover:bg-app-bg"
                    onClick={() => setOpen(r)}
                  >
                    <td className="py-2.5 pl-4 pr-4">
                      <p className="font-medium text-text">{r.name}</p>
                      <p className="text-xs text-text-muted">{r.email}</p>
                    </td>
                    <td className="max-w-md truncate py-2.5 pr-4 text-text-muted">{r.message}</td>
                    <td className="py-2.5 pr-4"><Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge></td>
                    <td className="py-2.5 pr-4 text-text-muted">{fmtDateTime(r.created_at)}</td>
                  </tr>
                ))}
                {!data?.items.length && (
                  <tr><td colSpan={4} className="py-8 text-center text-text-muted">No submissions.</td></tr>
                )}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
      {open && <DetailModal sub={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
