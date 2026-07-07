import { Check, FolderPlus, Loader2, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { apiErrorMessage } from "@/api/client";
import { useCreateProject, useProjects, useSaveRun } from "@/api/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/store/toast";

interface Props {
  module: string;
  params: Record<string, unknown>;
  result: Record<string, unknown>;
}

export function SaveToProject({ module, params, result }: Props) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newName, setNewName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const { data: projects } = useProjects();
  const createProject = useCreateProject();
  const saveRun = useSaveRun();
  const busy = createProject.isPending || saveRun.isPending;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const flashSaved = () => {
    setSaved(true);
    setOpen(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const saveTo = async (projectId: string) => {
    try {
      await saveRun.mutateAsync({ projectId, module, params, result });
      flashSaved();
      toast.success("Saved to project.");
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const createAndSave = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const project = await createProject.mutateAsync({ name });
      await saveRun.mutateAsync({ projectId: project.id, module, params, result });
      setNewName("");
      flashSaved();
      toast.success(`Saved to “${name}”.`);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <div className="relative" ref={ref}>
      <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)} disabled={busy}>
        {saved ? <Check size={14} className="text-success" /> : <FolderPlus size={14} />}
        {saved ? "Saved" : "Save to project"}
      </Button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-border bg-surface p-2 shadow-md">
          <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-text-muted">
            Save to existing
          </p>
          <div className="max-h-48 overflow-y-auto">
            {projects && projects.length > 0 ? (
              projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => saveTo(p.id)}
                  disabled={busy}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-text hover:bg-surface-2 disabled:opacity-50"
                >
                  <span className="truncate">{p.name}</span>
                  <span className="ml-2 shrink-0 font-mono text-xs text-text-muted">
                    {p.run_count}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-2 py-1.5 text-sm text-text-muted">No projects yet.</p>
            )}
          </div>
          <div className="mt-2 border-t border-border pt-2">
            <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-text-muted">
              New project
            </p>
            <div className="flex gap-1.5">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Project name"
                className="h-8"
                onKeyDown={(e) => e.key === "Enter" && createAndSave()}
              />
              <Button size="sm" onClick={createAndSave} disabled={busy || !newName.trim()}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
