import { datapointUniqueKeyString, NO_SUPPLIER_KEY } from "@/lib/suppliers/supplierKey";

export type IngestDedupRecord = {
  index: number;
  metricKey: string;
  supplierKey: string;
  externalId?: string;
};

export type MatchedDedupRecord = IngestDedupRecord & {
  reason: "existing" | "batch_duplicate";
};

export type DeduplicationReport = {
  matched: MatchedDedupRecord[];
  newRecords: IngestDedupRecord[];
};

/** Encode org-scoped uniqueness the same way Datapoints indexes do. */
export function ingestKeyString(
  organisationId: string,
  periodId: string,
  metricKey: string,
  supplierKey: string = NO_SUPPLIER_KEY,
): string {
  return datapointUniqueKeyString({
    organisationId,
    periodId,
    metricKey,
    supplierKey,
  });
}

/**
 * Pure dedupe: skip records that already exist (org/period/metric/supplier)
 * or that collide earlier in the same batch. External ids also collide in-batch.
 */
export function deduplicateIngestRecords(
  organisationId: string,
  periodId: string,
  records: IngestDedupRecord[],
  existingKeys: ReadonlySet<string>,
): DeduplicationReport {
  const seenKeys = new Set<string>();
  const seenExternalIds = new Set<string>();
  const matched: MatchedDedupRecord[] = [];
  const newRecords: IngestDedupRecord[] = [];

  for (const record of records) {
    const key = ingestKeyString(
      organisationId,
      periodId,
      record.metricKey,
      record.supplierKey,
    );
    const externalId = record.externalId?.trim();

    if (externalId && seenExternalIds.has(externalId)) {
      matched.push({ ...record, reason: "batch_duplicate" });
      continue;
    }

    if (existingKeys.has(key) || seenKeys.has(key)) {
      matched.push({
        ...record,
        reason: existingKeys.has(key) ? "existing" : "batch_duplicate",
      });
      continue;
    }

    seenKeys.add(key);
    if (externalId) seenExternalIds.add(externalId);
    newRecords.push(record);
  }

  return { matched, newRecords };
}
