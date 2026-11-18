import Dexie, { type Table } from "dexie";
import type { Customer } from "@/types/customer";

/** A change made on this device that still has to be uploaded to the shared database. */
export interface OutboxRow {
  id: string; // customer id
  op: "put" | "delete";
  at: number; // increases with every change so a finished upload can tell if the record changed meanwhile
}

export interface SettingRow {
  key: string;
  value: unknown;
}

class TajDatabase extends Dexie {
  customers!: Table<Customer, string>;
  settings!: Table<SettingRow, string>;
  outbox!: Table<OutboxRow, string>;

  constructor() {
    super("taj-export");
    // Version 1. Add new versions below (never edit an existing one) so that
    // existing user data is migrated instead of being lost.
    this.version(1).stores({
      customers: "id, name, shopName, mobile, city, district, state, pin, createdAt, updatedAt",
      settings: "key",
    });
    this.version(2).stores({
      customers: "id, name, shopName, mobile, city, district, state, pin, createdAt, updatedAt",
      settings: "key",
      outbox: "id",
    });
  }
}

export const db = new TajDatabase();
