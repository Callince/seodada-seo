import { ArrowDown, ArrowUp, Plus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { apiErrorMessage } from "@/api/client";
import {
  useAdminWebstoryDetail,
  useCreateWebstory,
  useUpdateWebstory,
  useUploadBlogImage,
  type WebStoryInput,
  type WebStorySlide,
} from "@/api/hooks/useAdmin";
import { assetUrl } from "@/api/hooks/useContentPublic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/store/toast";
import { Field, Modal, ModalActions } from "@/routes/admin/ui";

const AREA = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none";
const BLANK: WebStorySlide = { image: "", image_alt: "", heading: "", text: "", learn_more_url: "" };

/** Upload button that stores an image and calls back with its URL. */
function ImageField({ value, onChange, label }: { value: string; onChange: (url: string) => void; label: string }) {
  const upload = useUploadBlogImage();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="/content-assets/… or https://…" />
        <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload.mutate(file, { onSuccess: (r) => onChange(r.url), onError: (err) => toast.error(apiErrorMessage(err)) });
        }} />
        <Button type="button" variant="secondary" loading={upload.isPending} onClick={() => ref.current?.click()}>
          <Upload size={14} /> Upload
        </Button>
      </div>
      {value && <img src={assetUrl(value)} alt="" className="mt-2 h-20 rounded-lg border border-border object-cover" />}
    </Field>
  );
}

export function WebStoryEditor({ storyId, onClose }: { storyId: string | null; onClose: () => void }) {
  const editing = !!storyId;
  const { data: existing, isPending: loading } = useAdminWebstoryDetail(storyId);
  const create = useCreateWebstory();
  const update = useUpdateWebstory();

  const [f, setF] = useState<WebStoryInput | null>(null);
  const seed = editing ? existing : ({} as WebStoryInput);
  if (!f && (seed || !editing)) {
    setF({
      title: seed?.title ?? "",
      slug: seed?.slug ?? "",
      meta_description: seed?.meta_description ?? "",
      cover_image_url: seed?.cover_image_url ?? "",
      status: seed?.status ?? "draft",
      slides: seed?.slides ?? [{ ...BLANK }],
    });
  }

  if (editing && loading && !f) {
    return <Modal title="Edit story" onClose={onClose} wide><p className="text-sm text-text-muted">Loading…</p></Modal>;
  }
  if (!f) return null;

  const set = (k: keyof WebStoryInput, v: unknown) => setF({ ...f, [k]: v });
  const slides = f.slides ?? [];
  const setSlide = (i: number, patch: Partial<WebStorySlide>) =>
    set("slides", slides.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= slides.length) return;
    const copy = [...slides];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    set("slides", copy);
  };
  const busy = create.isPending || update.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const opts = {
      onSuccess: () => { toast.success(editing ? "Story updated" : "Story created"); onClose(); },
      onError: (err: unknown) => toast.error(apiErrorMessage(err)),
    };
    if (editing) update.mutate({ id: storyId!, ...f }, opts);
    else create.mutate(f, opts);
  };

  return (
    <Modal title={editing ? "Edit web story" : "New web story"} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Title"><Input value={f.title ?? ""} onChange={(e) => set("title", e.target.value)} required /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Slug (blank = from title)"><Input value={f.slug ?? ""} onChange={(e) => set("slug", e.target.value)} placeholder="my-story" /></Field>
          <Field label="Status">
            <Select value={f.status ?? "draft"} onChange={(e) => set("status", e.target.value)} className="w-full">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </Select>
          </Field>
        </div>
        <Field label="Meta description"><textarea value={f.meta_description ?? ""} onChange={(e) => set("meta_description", e.target.value)} rows={2} className={AREA} /></Field>
        <ImageField label="Cover image" value={f.cover_image_url ?? ""} onChange={(url) => set("cover_image_url", url)} />

        <div className="rounded-lg border border-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-text">Slides ({slides.length})</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => set("slides", [...slides, { ...BLANK }])}>
              <Plus size={14} /> Add slide
            </Button>
          </div>
          <div className="space-y-4">
            {slides.map((s, i) => (
              <div key={i} className="rounded-lg border border-border/70 bg-app-bg p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Slide {i + 1}</span>
                  <div className="flex gap-0.5">
                    <Button type="button" variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp size={14} /></Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === slides.length - 1} aria-label="Move down"><ArrowDown size={14} /></Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => set("slides", slides.filter((_, j) => j !== i))} aria-label="Remove slide"><Trash2 size={14} className="text-danger" /></Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <ImageField label="Image" value={s.image} onChange={(url) => setSlide(i, { image: url })} />
                  <Field label="Image alt text"><Input value={s.image_alt} onChange={(e) => setSlide(i, { image_alt: e.target.value })} /></Field>
                  <Field label="Heading (HTML allowed)"><Input value={s.heading} onChange={(e) => setSlide(i, { heading: e.target.value })} /></Field>
                  <Field label="Text (HTML allowed)"><textarea value={s.text} onChange={(e) => setSlide(i, { text: e.target.value })} rows={2} className={AREA} /></Field>
                  <Field label="“Learn more” URL"><Input value={s.learn_more_url} onChange={(e) => setSlide(i, { learn_more_url: e.target.value })} placeholder="https://…" /></Field>
                </div>
              </div>
            ))}
            {!slides.length && <p className="text-sm text-text-muted">No slides yet — add one.</p>}
          </div>
        </div>

        <ModalActions onClose={onClose} loading={busy} label={editing ? "Save story" : "Create story"} />
      </form>
    </Modal>
  );
}
