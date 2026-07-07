import { CalendarClock, Pause, Play, Trash2, Zap } from "lucide-react";
import { Link } from "react-router-dom";

import {
  useDeleteSchedule,
  useRunSchedule,
  useSchedules,
  useUpdateSchedule,
} from "@/api/hooks/useSchedules";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Schedules() {
  const schedules = useSchedules();
  const update = useUpdateSchedule();
  const del = useDeleteSchedule();
  const runNow = useRunSchedule();
  const items = schedules.data ?? [];

  return (
    <div>
      <PageHeader
        title="Schedules"
        subtitle="Automated reports that run on their own and save to your projects."
      />

      {schedules.isLoading ? (
        <Skeleton className="h-48" />
      ) : items.length === 0 ? (
        <EmptyState
          title="No schedules yet"
          hint="Open a Site Report and use “Automate this report” to schedule a recurring audit."
        />
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <Card key={s.id} className="transition-colors hover:bg-surface-2">
              <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-text">
                    <CalendarClock size={15} className="text-primary" />
                    {s.label}
                    {!s.active && (
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-muted">
                        paused
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-text-muted">
                    {s.frequency} · next {new Date(s.next_run_at).toLocaleString()}
                    {s.last_run_at ? ` · last ${new Date(s.last_run_at).toLocaleString()}` : ""}
                    {s.last_status ? ` · ${s.last_status}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => runNow.mutate(s.id)} disabled={runNow.isPending}>
                    <Zap size={14} /> Run now
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => update.mutate({ id: s.id, active: !s.active })}
                  >
                    {s.active ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Resume</>}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => del.mutate(s.id)} title="Delete">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
          <p className="pt-1 text-sm text-text-muted">
            Reports land in your{" "}
            <Link to="/projects" className="text-primary hover:underline">
              Projects
            </Link>{" "}
            — reopen any saved run for $0.
          </p>
        </div>
      )}
    </div>
  );
}
