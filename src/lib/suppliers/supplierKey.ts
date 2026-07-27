/**
 * Sentinel supplier key for datapoint uniqueness.
 *
 * MongoDB unique indexes treat multiple `null` values as distinct, so a
 * relationship field left null would allow duplicate org-level rows.
 * We always store an explicit string: supplier id, or "" for no supplier.
 */

export const NO_SUPPLIER_KEY = "";

export type DatapointUniqueKey = {
  organisationId: string;
  periodId: string;
  metricKey: string;
  /** Always a string — use NO_SUPPLIER_KEY when there is no supplier. */
  supplierKey: string;
};

/** Map optional supplier id → index key (never null/undefined). */
export function supplierKeyFrom(supplierId: string | null | undefined): string {
  if (supplierId == null || supplierId === "") return NO_SUPPLIER_KEY;
  return supplierId;
}

export function datapointUniqueKeyString(key: DatapointUniqueKey): string {
  return [key.organisationId, key.periodId, key.metricKey, key.supplierKey].join(
    "\u0000",
  );
}

/**
 * In-memory unique index mirroring MongoDB unique `{organisation, period,
 * metricKey, supplierKey}` with the empty-string sentinel.
 * Two no-supplier rows for the same metric MUST collide.
 */
export class DatapointUniqueIndex {
  private readonly keys = new Set<string>();

  tryInsert(key: DatapointUniqueKey): { ok: true } | { ok: false; reason: "duplicate" } {
    const encoded = datapointUniqueKeyString(key);
    if (this.keys.has(encoded)) {
      return { ok: false, reason: "duplicate" };
    }
    this.keys.add(encoded);
    return { ok: true };
  }

  has(key: DatapointUniqueKey): boolean {
    return this.keys.has(datapointUniqueKeyString(key));
  }
}
