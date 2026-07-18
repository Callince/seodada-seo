import { useNavigate, useParams } from "react-router-dom";

import { BlogEditor } from "@/routes/admin/tabs/BlogEditor";

/** /admin/content/blogs/new (no :id → create) and /admin/content/blogs/:id (edit). */
export function BlogEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  return <BlogEditor blogId={id ?? null} onClose={() => navigate("/admin/content/blogs")} />;
}
