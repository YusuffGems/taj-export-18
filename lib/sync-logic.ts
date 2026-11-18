import type { Customer } from "@/types/customer";
import { customerNumber } from "./customer-id";

export type PushDecision =
  | { action: "write"; counter: number } // upload local record; counter = new shared id counter
  | { action: "adopt"; remote: Customer } // shared copy is newer: keep it, drop our change
  | { action: "rename" }; // same id but a different customer already exists online: use a new id

/**
 * Decides what to do when uploading `local` while `remote` (may be null) is what the
 * shared database currently holds for the same id. Pure, so it is unit-tested.
 */
export function decidePush(local: Customer, remote: Customer | null, counter: number): PushDecision {
  if (remote) {
    if (remote.createdAt !== local.createdAt) return { action: "rename" };
    if (remote.updatedAt > local.updatedAt) return { action: "adopt", remote };
  }
  return { action: "write", counter: Math.max(counter, customerNumber(local.id)) };
}
