import { Database, History, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Meta } from "@/types";

/** Human age of the data, e.g. "12m", "5h", "2d". */
function age(iso?: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${Math.max(mins, 1)}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function CacheBadge({ meta }: { meta?: Meta }) {
  if (!meta) return null;
  const a = age(meta.fetched_at);
  if (!meta.from_cache)
    return (
      <Badge tone="info" title={`live call · ${meta.latency_ms}ms`}>
        <Zap size={12} /> live
      </Badge>
    );
  // "stale" = expired data served because the upstream fetch failed.
  if (meta.source === "stale")
    return (
      <Badge tone="warning" title="The data source was unreachable, so the last known result is shown">
        <History size={12} /> stale{a ? ` · ${a} old` : ""}
      </Badge>
    );
  return (
    <Badge tone="success" title={`served from ${meta.source} in ${meta.latency_ms}ms`}>
      <Database size={12} /> cached{a ? ` · ${a} old` : ""}
    </Badge>
  );
}
