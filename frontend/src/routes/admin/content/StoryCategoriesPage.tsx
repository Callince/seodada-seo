import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { apiErrorMessage } from "@/api/client";
import {
  useAdminWebstoryCategories,
  useCreateWebstoryCategory,
  useDeleteWebstoryCategory,
  useUpdateWebstoryCategory,
} from "@/api/hooks/useAdmin";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/store/toast";
import { ContentTabs } from "@/routes/admin/content/ContentTabs";

function CategoriesCard() {
  const { data } = useAdminWebstoryCategories();
  const create = useCreateWebstoryCategory();
  const upd = useUpdateWebstoryCategory();
  const del = useDeleteWebstoryCategory();
  const [name, setName] = useState("");
  return (
    <Card>
      <CardHeader><CardTitle>Story categories</CardTitle></CardHeader>
      <CardBody>
        <form
          className="mb-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            create.mutate({ name: name.trim() }, { onSuccess: () => { setName(""); toast.success("Category added"); }, onError: (er) => toast.error(apiErrorMessage(er)) });
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category name" />
          <Button type="submit" loading={create.isPending}><Plus size={14} /> Add</Button>
        </form>
        <div className="divide-y divide-border/60">
          {(data ?? []).map((c) => (
            <div key={c.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-text">{c.name} <span className="text-text-muted">/{c.slug}</span></span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => {
                  const nn = prompt("Rename category", c.name);
                  if (nn && nn.trim()) upd.mutate({ id: c.id, name: nn.trim() }, { onError: (er) => toast.error(apiErrorMessage(er)) });
                }}><Pencil size={13} /></Button>
                <Button variant="ghost" size="sm" onClick={() => {
                  if (confirm(`Delete category "${c.name}"? Stories in it must be moved first.`)) del.mutate(c.id, { onError: (er) => toast.error(apiErrorMessage(er)) });
                }}><Trash2 size={13} className="text-danger" /></Button>
              </div>
            </div>
          ))}
          {!data?.length && <p className="py-2 text-sm text-text-muted">No categories yet.</p>}
        </div>
      </CardBody>
    </Card>
  );
}

export function StoryCategoriesPage() {
  return (
    <div className="space-y-5">
      <ContentTabs />
      <CategoriesCard />
    </div>
  );
}
