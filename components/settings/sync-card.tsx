"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { RefreshCw, Upload } from "lucide-react";
import { db } from "@/lib/database";
import { queueAllForUpload } from "@/lib/customer-storage";
import { requestSync } from "@/lib/sync-bus";
import { getSyncSetup } from "@/lib/sync-config";
import { useSyncStatus } from "@/hooks/use-sync-status";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/common/button";
import { Card } from "@/components/common/page-header";
import { SyncBadge } from "@/components/layout/sync-badge";

function Row({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="grid grid-cols-5 gap-2 border-b border-line py-2 text-sm last:border-0">
      <dt className="col-span-2 text-muted">{label}</dt>
      <dd className={`col-span-3 break-words font-medium ${bad ? "text-red-600" : "text-fg"}`}>{value}</dd>
    </div>
  );
}

/** Shows whether online sync is working and gives buttons to push everything from this device. */
export function SyncCard() {
  const { toast } = useToast();
  const { state, detail } = useSyncStatus();
  const setup = getSyncSetup();
  const local = useLiveQuery(() => db.customers.count(), []);
  const pending = useLiveQuery(() => db.outbox.count(), []);

  return (
    <Card title="Online sync (all devices)">
      <div className="mb-3 rounded-lg bg-side px-3 py-2"><SyncBadge /></div>
      {detail && <p role="alert" className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">{detail}</p>}
      <dl className="mb-4">
        <Row label="Settings in this app" value={setup.config ? "Complete" : setup.missing.length ? `Missing: ${setup.missing.join(", ")}` : "Invalid"} bad={!setup.config} />
        {setup.codeProblem && <Row label="Secret code" value={setup.codeProblem} bad />}
        <Row label="Firebase project" value={setup.projectId ?? "—"} />
        <Row label="Customers on this device" value={String(local ?? 0)} />
        <Row label="Waiting to upload" value={String(pending ?? 0)} bad={(pending ?? 0) > 0 && state === "error"} />
      </dl>
      {!setup.config && (
        <p className="mb-4 text-sm text-muted">Sync is off because the settings above are not in this build. Add them in Vercel (Settings → Environment Variables), then redeploy, and reopen the app.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!setup.config} onClick={() => { requestSync(); toast("Sync started."); }}><RefreshCw className="h-4 w-4" /> Sync now</Button>
        <Button variant="gold" disabled={!setup.config} onClick={async () => { const n = await queueAllForUpload(); toast(`${n} customer${n === 1 ? "" : "s"} queued to upload to all devices.`); }}><Upload className="h-4 w-4" /> Upload everything from this device</Button>
      </div>
    </Card>
  );
}
