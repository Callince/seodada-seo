import { PageHeader, EmptyState } from "@/components/shared/states";

export function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <EmptyState title="Coming soon" hint="This module is under construction." />
    </div>
  );
}
