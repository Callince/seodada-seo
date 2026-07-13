import type { ReactNode } from "react";

import { useAdminMe } from "@/api/hooks/useAdmin";
import { canAccessAdmin } from "@/lib/adminNav";
import { EmptyState } from "@/components/shared/states";

/** Section title/subtitle header, consistent across admin pages. */
export function AdminPageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-text">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      <div className="mt-4 h-px bg-[color:var(--section-soft)]" />
    </div>
  );
}

/** Wraps an admin section route: guards the permission (protects direct-URL
 *  access, since the sidebar only hides links) and renders its header. */
export function AdminSection({
  perm,
  title,
  subtitle,
  children,
}: {
  perm: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { data: me } = useAdminMe();
  if (!canAccessAdmin(perm, me)) {
    return (
      <EmptyState
        title="Admin access required"
        hint="You don't have permission for this section. Ask a super-admin to grant it from Roles."
      />
    );
  }
  return (
    <>
      <AdminPageHeader title={title} subtitle={subtitle} />
      {children}
    </>
  );
}
