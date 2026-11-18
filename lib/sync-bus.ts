/** Lets storage code ask the sync engine to run, without importing Firebase. */
let handler: (() => void) | null = null;

export function setSyncHandler(h: (() => void) | null): void {
  handler = h;
}

export function requestSync(): void {
  handler?.();
}
