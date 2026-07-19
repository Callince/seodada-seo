import { Pencil, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import { useAdminBlogs, useDeleteContent, useSetContentStatus } from "@/api/hooks/useAdmin";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ContentTabs } from "@/routes/admin/content/ContentTabs";
import { fmtDate } from "@/routes/admin/ui";

function BlogsCard() {
  const { data: blogs, isPending } = useAdminBlogs();
  const setStatus = useSetContentStatus("blogs");
  const del = useDeleteContent("blogs");
  if (isPending) return <Skeleton className="h-48 w-full" />;
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Blog posts ({blogs?.length ?? 0})</CardTitle>
        <Link to="/admin/content/blogs/new" className={buttonVariants({ size: "sm" })}><Plus size={14} /> New post</Link>
      </CardHeader>
      <CardBody className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
              <th className="py-2 pl-4 pr-4">Title</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Published</th><th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {(blogs ?? []).map((r) => (
              <tr key={r.id} className="border-b border-border/60">
                <td className="max-w-xs truncate py-2.5 pl-4 pr-4">
                  <Link to={`/admin/content/blogs/${r.id}`} className="font-medium text-text hover:text-[color:var(--section-ink)]">{r.title}</Link>
                </td>
                <td className="py-2.5 pr-4"><Badge tone={r.status === "published" ? "success" : "neutral"}>{r.status}</Badge></td>
                <td className="py-2.5 pr-4 text-text-muted">{fmtDate(r.published_at)}</td>
                <td className="py-2.5 pr-4 text-right">
                  <Link to={`/admin/content/blogs/${r.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })} aria-label="Edit"><Pencil size={13} /></Link>
                  <Button variant="ghost" size="sm" disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ id: r.id, status: r.status === "published" ? "draft" : "published" })}>
                    {r.status === "published" ? "Unpublish" : "Publish"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete "${r.title}"?`)) del.mutate(r.id); }} aria-label="Delete">
                    <Trash2 size={13} className="text-danger" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}

export function BlogsPage() {
  return (
    <div className="space-y-5">
      <ContentTabs />
      <BlogsCard />
    </div>
  );
}
