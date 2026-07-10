import { Plus, Trash2, Upload } from "lucide-react";
import { lazy, Suspense, useRef, useState } from "react";

import { apiErrorMessage } from "@/api/client";
import {
  useAdminBlogCategories,
  useAdminBlogDetail,
  useCreateBlog,
  useUpdateBlog,
  useUploadBlogImage,
  type BlogInput,
} from "@/api/hooks/useAdmin";
import { assetUrl } from "@/api/hooks/useContentPublic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/store/toast";
import { Field, Modal, ModalActions } from "@/routes/admin/ui";

const AREA = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none";

// CKEditor is heavy and admin-only — load its chunk only when the editor opens.
const RichEditor = lazy(() => import("@/components/ui/RichEditor").then((m) => ({ default: m.RichEditor })));

/** Create or edit a blog post. Pass blogId to edit; null to create. */
export function BlogEditor({ blogId, onClose }: { blogId: string | null; onClose: () => void }) {
  const editing = !!blogId;
  const { data: existing, isPending: loading } = useAdminBlogDetail(blogId);
  const { data: categories } = useAdminBlogCategories();
  const create = useCreateBlog();
  const update = useUpdateBlog();
  const upload = useUploadBlogImage();
  const fileRef = useRef<HTMLInputElement>(null);

  const [f, setF] = useState<BlogInput | null>(null);
  // Seed the form once the existing post loads (or immediately for a new post).
  const seed = editing ? existing : ({} as BlogInput);
  if (!f && (seed || !editing)) {
    setF({
      title: seed?.title ?? "",
      slug: seed?.slug ?? "",
      author: seed?.author ?? "seodada",
      category_id: seed?.category_id ?? null,
      cover_image_url: seed?.cover_image_url ?? "",
      excerpt: seed?.excerpt ?? "",
      meta_title: seed?.meta_title ?? "",
      meta_description: seed?.meta_description ?? "",
      meta_keywords: seed?.meta_keywords ?? "",
      body_html: seed?.body_html ?? "",
      faqs: seed?.faqs ?? [],
      status: seed?.status ?? "draft",
    });
  }

  if (editing && loading && !f) {
    return <Modal title="Edit post" onClose={onClose} wide><p className="text-sm text-text-muted">Loading…</p></Modal>;
  }
  if (!f) return null;

  const set = (k: keyof BlogInput, v: unknown) => setF({ ...f, [k]: v });
  const busy = create.isPending || update.isPending;
  const faqs = f.faqs ?? [];

  const pickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    upload.mutate(file, {
      onSuccess: (r) => { set("cover_image_url", r.url); toast.success("Image uploaded"); },
      onError: (err) => toast.error(apiErrorMessage(err)),
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const opts = {
      onSuccess: () => { toast.success(editing ? "Post updated" : "Post created"); onClose(); },
      onError: (err: unknown) => toast.error(apiErrorMessage(err)),
    };
    const body: BlogInput = { ...f, category_id: f.category_id || null };
    if (editing) update.mutate({ id: blogId!, ...body }, opts);
    else create.mutate(body, opts);
  };

  return (
    <Modal title={editing ? "Edit post" : "New post"} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Title"><Input value={f.title ?? ""} onChange={(e) => set("title", e.target.value)} required /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Slug (blank = from title)"><Input value={f.slug ?? ""} onChange={(e) => set("slug", e.target.value)} placeholder="my-post" /></Field>
          <Field label="Author"><Input value={f.author ?? ""} onChange={(e) => set("author", e.target.value)} /></Field>
          <Field label="Category">
            <Select value={f.category_id ?? ""} onChange={(e) => set("category_id", e.target.value || null)} className="w-full">
              <option value="">— none —</option>
              {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={f.status ?? "draft"} onChange={(e) => set("status", e.target.value)} className="w-full">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </Select>
          </Field>
        </div>

        <Field label="Cover image">
          <div className="flex items-center gap-2">
            <Input value={f.cover_image_url ?? ""} onChange={(e) => set("cover_image_url", e.target.value)} placeholder="/content-assets/... or https://…" />
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickImage} />
            <Button type="button" variant="secondary" loading={upload.isPending} onClick={() => fileRef.current?.click()}>
              <Upload size={14} /> Upload
            </Button>
          </div>
          {f.cover_image_url && (
            <img src={assetUrl(f.cover_image_url)} alt="" className="mt-2 h-24 rounded-lg border border-border object-cover" />
          )}
        </Field>

        <Field label="Excerpt">
          <textarea value={f.excerpt ?? ""} onChange={(e) => set("excerpt", e.target.value)} rows={2} className={AREA} />
        </Field>
        <Field label="Body">
          <Suspense fallback={<div className="rounded-lg border border-border bg-surface px-3 py-6 text-center text-sm text-text-muted">Loading editor…</div>}>
            <RichEditor value={f.body_html ?? ""} onChange={(html) => set("body_html", html)} />
          </Suspense>
        </Field>

        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium text-text">SEO meta</summary>
          <div className="mt-3 space-y-3">
            <Field label="Meta title"><Input value={f.meta_title ?? ""} onChange={(e) => set("meta_title", e.target.value)} /></Field>
            <Field label="Meta description"><textarea value={f.meta_description ?? ""} onChange={(e) => set("meta_description", e.target.value)} rows={2} className={AREA} /></Field>
            <Field label="Meta keywords"><Input value={f.meta_keywords ?? ""} onChange={(e) => set("meta_keywords", e.target.value)} /></Field>
          </div>
        </details>

        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text">FAQs</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => set("faqs", [...faqs, { question: "", answer: "" }])}>
              <Plus size={14} /> Add
            </Button>
          </div>
          <div className="mt-2 space-y-2">
            {faqs.map((qa, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="flex-1 space-y-1">
                  <Input value={qa.question} placeholder="Question" onChange={(e) => set("faqs", faqs.map((x, j) => j === i ? { ...x, question: e.target.value } : x))} />
                  <textarea value={qa.answer} placeholder="Answer" rows={2} className={AREA}
                    onChange={(e) => set("faqs", faqs.map((x, j) => j === i ? { ...x, answer: e.target.value } : x))} />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => set("faqs", faqs.filter((_, j) => j !== i))} aria-label="Remove FAQ">
                  <Trash2 size={14} className="text-danger" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <ModalActions onClose={onClose} loading={busy} label={editing ? "Save post" : "Create post"} />
      </form>
    </Modal>
  );
}
