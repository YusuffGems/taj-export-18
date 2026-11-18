export type SyncState = "off" | "connecting" | "synced" | "syncing" | "offline" | "error";

export interface SyncSnapshot {
  state: SyncState;
  /** Human-readable reason, mainly for errors. */
  detail: string;
}

let snapshot: SyncSnapshot = { state: "off", detail: "" };
const listeners = new Set<() => void>();

export function setSyncState(state: SyncState, detail = ""): void {
  if (snapshot.state === state && snapshot.detail === detail) return;
  snapshot = { state, detail }; // new object so React notices the change
  listeners.forEach((l) => l());
}

export function getSyncSnapshot(): SyncSnapshot {
  return snapshot;
}

export function subscribeSyncState(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Turns a Firebase error into a sentence a shop owner can act on. */
export function explainSyncError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code ?? "";
  if (code.includes("permission-denied")) return "Firebase refused access. Publish the Firestore rules and make sure the secret code in the rules is exactly the same as NEXT_PUBLIC_WORKSPACE_CODE.";
  if (code.includes("unavailable")) return "Cannot reach Firebase. Check the internet connection.";
  if (code.includes("failed-precondition")) return "Firestore database is not ready. Create the Firestore database in Firebase first.";
  if (code.includes("not-found")) return "Firestore database not found. Create it in Firebase (Build → Firestore Database).";
  if (code.includes("unauthenticated") || code.includes("api-key")) return "Firebase rejected the API key. Check NEXT_PUBLIC_FIREBASE_API_KEY.";
  return code ? `Firebase error: ${code}` : "Unknown sync error.";
}
