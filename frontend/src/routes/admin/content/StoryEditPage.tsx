import { useNavigate, useParams } from "react-router-dom";

import { WebStoryEditor } from "@/routes/admin/tabs/WebStoryEditor";

/** /admin/content/stories/new (no :id → create) and /admin/content/stories/:id (edit). */
export function StoryEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  return <WebStoryEditor storyId={id ?? null} onClose={() => navigate("/admin/content/stories")} />;
}
