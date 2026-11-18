import { describe, expect, it } from "vitest";
import { EMPTY_CUSTOMER } from "@/constants/customer";
import type { Customer } from "@/types/customer";
import { customerNumber, formatCustomerId } from "@/lib/customer-id";
import { decidePush } from "@/lib/sync-logic";

const make = (over: Partial<Customer> = {}): Customer => ({
  ...EMPTY_CUSTOMER, id: "CUS00005", name: "Ravi", createdAt: "2026-11-01T10:00:00.000Z", updatedAt: "2026-11-01T10:00:00.000Z", ...over,
});

describe("customer id helpers", () => {
  it("formats and parses CUS ids", () => {
    expect(formatCustomerId(7)).toBe("CUS00007");
    expect(customerNumber("CUS00123")).toBe(123);
    expect(customerNumber("IMP-ABC")).toBe(0);
  });
});

describe("decidePush (uploading a local change to the shared database)", () => {
  it("writes a brand-new customer and raises the shared id counter", () => {
    expect(decidePush(make(), null, 3)).toEqual({ action: "write", counter: 5 });
  });
  it("never lowers the counter", () => {
    expect(decidePush(make({ id: "CUS00002" }), null, 9)).toEqual({ action: "write", counter: 9 });
  });
  it("overwrites an older shared copy of the same customer (a normal edit)", () => {
    const remote = make({ updatedAt: "2026-11-01T10:00:00.000Z" });
    const local = make({ name: "Ravi K", updatedAt: "2026-11-02T10:00:00.000Z" });
    expect(decidePush(local, remote, 5).action).toBe("write");
  });
  it("keeps a newer shared copy instead of overwriting it (edited elsewhere later)", () => {
    const remote = make({ name: "Newer", updatedAt: "2026-11-03T10:00:00.000Z" });
    expect(decidePush(make(), remote, 5)).toEqual({ action: "adopt", remote });
  });
  it("gives a new id when two different customers got the same id on two devices", () => {
    const remote = make({ name: "Someone else", createdAt: "2026-11-01T09:00:00.000Z" });
    expect(decidePush(make(), remote, 5)).toEqual({ action: "rename" });
  });
});

import { analyzeSyncEnv } from "@/lib/sync-config";
import { explainSyncError } from "@/lib/sync-status";

describe("sync setup check", () => {
  const good = { apiKey: "k", projectId: "p", appId: "a", workspace: "taj-wholesale-4829-kumar" };
  it("accepts a complete setup", () => {
    const r = analyzeSyncEnv(good);
    expect(r.config?.workspace).toBe("taj-wholesale-4829-kumar");
    expect(r.missing).toEqual([]);
  });
  it("lists missing variables by name", () => {
    const r = analyzeSyncEnv({ projectId: "p" });
    expect(r.config).toBeNull();
    expect(r.missing).toEqual(["NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_APP_ID", "NEXT_PUBLIC_WORKSPACE_CODE"]);
  });
  it("rejects a short code or one with spaces", () => {
    expect(analyzeSyncEnv({ ...good, workspace: "short" }).codeProblem).toMatch(/shorter than 12/);
    expect(analyzeSyncEnv({ ...good, workspace: "has a space inside it" }).codeProblem).toMatch(/no spaces/);
    expect(analyzeSyncEnv({ ...good, workspace: "has a space inside it" }).config).toBeNull();
  });
  it("trims stray spaces around values", () => {
    expect(analyzeSyncEnv({ ...good, workspace: "  taj-wholesale-4829-kumar " }).config?.workspace).toBe("taj-wholesale-4829-kumar");
  });
  it("explains common Firebase errors", () => {
    expect(explainSyncError({ code: "permission-denied" })).toMatch(/rules/i);
    expect(explainSyncError({ code: "unavailable" })).toMatch(/internet/i);
  });
});
