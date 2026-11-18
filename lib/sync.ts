import type { DocumentChange, DocumentData } from "firebase/firestore";
import type { Customer } from "@/types/customer";
import { db, type OutboxRow } from "./database";
import { formatCustomerId } from "./customer-id";
import { getSyncConfig } from "./sync-config";
import { setSyncHandler } from "./sync-bus";
import { explainSyncError, setSyncState } from "./sync-status";
import { decidePush } from "./sync-logic";

let started = false;

/**
 * Two-way sync between this device (IndexedDB) and a shared Firestore database.
 * - Changes made here are stored in an outbox and uploaded as soon as there is internet.
 * - Changes made on other devices arrive in real time and are written into IndexedDB,
 *   so the existing screens update by themselves.
 * Without configuration (see .env.example) nothing happens and the app stays local-only.
 */
export async function startSync(): Promise<void> {
  const config = getSyncConfig();
  if (!config) { setSyncState("off"); return; }
  if (started) return;
  started = true;
  setSyncState("connecting");

  const { initializeApp, getApp, getApps } = await import("firebase/app");
  const { collection, deleteDoc, doc, getFirestore, initializeFirestore, onSnapshot, runTransaction } = await import("firebase/firestore");

  const app = getApps().length ? getApp() : initializeApp(config.firebase);
  // Auto-detect long polling: some mobile / office networks block Firestore's default streaming connection.
  let fs: ReturnType<typeof getFirestore>;
  try { fs = initializeFirestore(app, { experimentalAutoDetectLongPolling: true }); } catch { fs = getFirestore(app); }
  const col = collection(fs, "workspaces", config.workspace, "customers");
  const counterRef = doc(fs, "workspaces", config.workspace, "meta", "counter");

  let flushing = false;
  let again = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const online = () => (typeof navigator === "undefined" ? true : navigator.onLine);

  async function finishItem(item: OutboxRow): Promise<void> {
    await db.transaction("rw", db.outbox, async () => {
      const current = await db.outbox.get(item.id);
      if (current && current.at === item.at) await db.outbox.delete(item.id);
      else if (current) again = true; // changed while uploading → another round
    });
  }

  async function adoptRemote(remote: Customer): Promise<void> {
    await db.customers.put(remote);
  }

  async function pushItem(item: OutboxRow): Promise<void> {
    const current = await db.outbox.get(item.id);
    if (!current || current.at !== item.at) { again = true; return; }

    if (item.op === "delete") {
      await deleteDoc(doc(col, item.id));
      await finishItem(item);
      return;
    }
    const local = await db.customers.get(item.id);
    if (!local) { await finishItem(item); return; }

    const result = await runTransaction(fs, async (tx) => {
      const snap = await tx.get(doc(col, local.id));
      const counterSnap = await tx.get(counterRef);
      const counter = counterSnap.exists() ? Number(counterSnap.data().n) || 0 : 0;
      const decision = decidePush(local, snap.exists() ? (snap.data() as Customer) : null, counter);

      if (decision.action === "adopt") return decision;
      if (decision.action === "write") {
        tx.set(doc(col, local.id), local as unknown as DocumentData);
        if (decision.counter !== counter) tx.set(counterRef, { n: decision.counter });
        return decision;
      }
      // rename: find a free id first (all reads happen before any write)
      let n = counter;
      let newId = "";
      for (let i = 0; i < 25 && !newId; i++) {
        n += 1;
        const candidate = formatCustomerId(n);
        if (!(await tx.get(doc(col, candidate))).exists()) newId = candidate;
      }
      if (!newId) throw new Error("No free customer id");
      tx.set(doc(col, newId), { ...local, id: newId } as unknown as DocumentData);
      tx.set(counterRef, { n });
      return { action: "rename" as const, newId };
    });

    if (result.action === "adopt") {
      await adoptRemote(result.remote);
    } else if (result.action === "rename") {
      await db.transaction("rw", db.customers, db.outbox, async () => {
        await db.customers.delete(local.id);
        await db.customers.put({ ...local, id: result.newId });
      });
    }
    await finishItem(item);
  }

  async function flush(): Promise<void> {
    if (flushing) { again = true; return; }
    flushing = true;
    try {
      do {
        again = false;
        const items = await db.outbox.toArray();
        if (items.length === 0) break;
        setSyncState("syncing");
        for (const item of items) await pushItem(item);
      } while (again);
      setSyncState(online() ? "synced" : "offline");
    } catch (err) {
      if (online()) setSyncState("error", explainSyncError(err)); else setSyncState("offline");
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => { void flush(); }, 15000);
    } finally {
      flushing = false;
    }
  }

  /** First time on this device: upload what is already stored locally. */
  async function seedOnce(): Promise<void> {
    const key = `taj-sync-seeded-${config!.workspace}`;
    if (localStorage.getItem(key)) return;
    const ids = (await db.customers.toCollection().primaryKeys()) as string[];
    await db.transaction("rw", db.outbox, async () => {
      for (const id of ids) {
        if (!(await db.outbox.get(id))) await db.outbox.put({ id, op: "put", at: Date.now() });
      }
    });
    localStorage.setItem(key, "1");
  }

  async function applyChanges(changes: DocumentChange<DocumentData>[]): Promise<void> {
    for (const ch of changes) {
      const id = ch.doc.id;
      if (await db.outbox.get(id)) continue; // our own unsent change wins until it is uploaded
      if (ch.type === "removed") { await db.customers.delete(id); continue; }
      const remote = { ...(ch.doc.data() as Customer), id };
      const local = await db.customers.get(id);
      if (!local || local.createdAt !== remote.createdAt || remote.updatedAt > local.updatedAt) await db.customers.put(remote);
    }
  }

  /** Customers deleted on another device while this one was closed/offline. */
  async function removeDeletedElsewhere(remoteIds: string[]): Promise<void> {
    const remote = new Set(remoteIds);
    const pending = new Set((await db.outbox.toCollection().primaryKeys()) as string[]);
    const local = (await db.customers.toCollection().primaryKeys()) as string[];
    const stale = local.filter((id) => !remote.has(id) && !pending.has(id));
    if (stale.length) await db.customers.bulkDelete(stale);
  }

  setSyncHandler(() => { void flush(); });
  window.addEventListener("online", () => { void flush(); });
  window.addEventListener("offline", () => setSyncState("offline"));

  await seedOnce();
  void flush();

  let queue: Promise<void> = Promise.resolve();
  let reconciled = false;
  onSnapshot(
    col,
    (snap) => {
      queue = queue.then(async () => {
        try {
          await applyChanges(snap.docChanges());
          if (!snap.metadata.fromCache && !reconciled) {
            await removeDeletedElsewhere(snap.docs.map((d) => d.id));
            reconciled = true;
          }
          if (!flushing && (await db.outbox.count()) === 0) setSyncState(online() ? "synced" : "offline");
        } catch (err) {
          setSyncState("error", explainSyncError(err));
        }
      });
    },
    (err) => (online() ? setSyncState("error", explainSyncError(err)) : setSyncState("offline")),
  );
}
