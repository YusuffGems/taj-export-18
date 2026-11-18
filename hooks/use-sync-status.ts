"use client";

import { useSyncExternalStore } from "react";
import { getSyncSnapshot, subscribeSyncState, type SyncSnapshot } from "@/lib/sync-status";

const SERVER: SyncSnapshot = { state: "off", detail: "" };

export function useSyncStatus(): SyncSnapshot {
  return useSyncExternalStore(subscribeSyncState, getSyncSnapshot, () => SERVER);
}
