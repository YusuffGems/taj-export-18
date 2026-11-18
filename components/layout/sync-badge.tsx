"use client";

import { Cloud, CloudOff, Loader2, TriangleAlert } from "lucide-react";
import { useSyncStatus } from "@/hooks/use-sync-status";
import { cn } from "@/lib/format";

const LABELS = {
  off: { text: "Sync off · this device only", short: "Sync off", Icon: CloudOff, tone: "text-white/60" },
  connecting: { text: "Connecting…", short: "Connecting", Icon: Loader2, tone: "text-white/80" },
  synced: { text: "Synced on all devices", short: "Synced", Icon: Cloud, tone: "text-emerald-300" },
  syncing: { text: "Syncing…", short: "Syncing", Icon: Loader2, tone: "text-gold" },
  offline: { text: "Offline · will sync later", short: "Offline", Icon: CloudOff, tone: "text-amber-300" },
  error: { text: "Sync problem · see Settings", short: "Sync error", Icon: TriangleAlert, tone: "text-red-300" },
} as const;

/** Small status line. `onLight` is for the light mobile header; `compact` shows the short label. */
export function SyncBadge({ onLight = false, compact = false }: { onLight?: boolean; compact?: boolean }) {
  const { state, detail } = useSyncStatus();
  const { text, short, Icon, tone } = LABELS[state];
  const lightTone = state === "synced" ? "text-emerald-700" : state === "error" ? "text-red-600" : state === "syncing" || state === "offline" ? "text-amber-700" : "text-muted";
  return (
    <div role="status" title={detail || text} className={cn("flex items-center gap-1.5 text-xs font-semibold", onLight ? lightTone : tone)}>
      <Icon className={cn("h-4 w-4 shrink-0", (state === "connecting" || state === "syncing") && "animate-spin")} aria-hidden="true" />
      <span>{compact ? short : text}</span>
    </div>
  );
}
