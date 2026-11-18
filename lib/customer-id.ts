/** Customer IDs look like CUS00001. Pure helpers shared by storage and sync. */
export function formatCustomerId(n: number): string {
  return `CUS${String(n).padStart(5, "0")}`;
}

/** The number inside a CUS id, or 0 for any other id format. */
export function customerNumber(id: string): number {
  const m = /^CUS(\d+)$/.exec(id);
  return m ? Number(m[1]) : 0;
}
