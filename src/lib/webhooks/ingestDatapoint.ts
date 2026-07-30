import { getPayload } from "payload";
import { randomUUID } from "crypto";
import config from "@/payload.config";
import { writeAuditLog } from "@/lib/audit/write";
import { NO_SUPPLIER_KEY, supplierKeyFrom } from "@/lib/suppliers/supplierKey";
import {
  deduplicateIngestRecords,
  ingestKeyString,
  type DeduplicationReport,
  type IngestDedupRecord,
} from "./ingestDedupe";
import { normalizeIngestPayload, type NormalizedIngestRecord } from "./ingestNormalize";
import { logWebhookAttempt } from "./webhookService";

export type IngestDatapointInput = {
  metricKey: string;
  value?: number | null;
  quality: "measured" | "calculated" | "estimated" | "missing";
  unit?: string;
  source?: string;
  supplierId?: string;
  externalId?: string;
};

export type IngestResult = {
  id: string;
  status: "created";
  timestamp: string;
};

export type IngestError = {
  index: number;
  error: string;
  path?: string;
};

export type IngestBatchResponse = {
  ok: true;
  dryRun: boolean;
  batchId: string;
  recordsProcessed: number;
  recordsSkipped: number;
  recordsFailed: number;
  errors: IngestError[];
  deduplicationReport: {
    matched: Array<{
      index: number;
      metricKey: string;
      supplierKey: string;
      reason: "existing" | "batch_duplicate";
      externalId?: string;
    }>;
    newRecords: Array<{
      index: number;
      metricKey: string;
      supplierKey: string;
      externalId?: string;
    }>;
  };
};

export type BatchIngestResult = IngestBatchResponse;

async function loadExistingKeys(
  organisationId: string,
  periodId: string,
  metricKeys: string[],
): Promise<Set<string>> {
  if (metricKeys.length === 0) return new Set();

  const payload = await getPayload({ config });
  const uniqueMetrics = [...new Set(metricKeys)];
  const existing = await payload.find({
    collection: "datapoints",
    where: {
      and: [
        { organisation: { equals: organisationId } },
        { period: { equals: periodId } },
        { metricKey: { in: uniqueMetrics } },
      ],
    },
    limit: Math.min(uniqueMetrics.length * 20, 5000),
    depth: 0,
    overrideAccess: true,
  });

  const keys = new Set<string>();
  for (const doc of existing.docs) {
    const supplierKey =
      typeof doc.supplierKey === "string"
        ? doc.supplierKey
        : supplierKeyFrom(
            typeof doc.supplier === "string"
              ? doc.supplier
              : doc.supplier && typeof doc.supplier === "object" && "id" in doc.supplier
                ? String(doc.supplier.id)
                : null,
          );
    keys.add(
      ingestKeyString(organisationId, periodId, String(doc.metricKey), supplierKey),
    );
  }
  return keys;
}

function toDedupRecords(records: NormalizedIngestRecord[]): IngestDedupRecord[] {
  return records.map((r) => ({
    index: r.index,
    metricKey: r.metricKey,
    supplierKey: r.supplierKey || NO_SUPPLIER_KEY,
    externalId: r.externalId,
  }));
}

function buildReport(
  dedupe: DeduplicationReport,
): IngestBatchResponse["deduplicationReport"] {
  return {
    matched: dedupe.matched.map((m) => ({
      index: m.index,
      metricKey: m.metricKey,
      supplierKey: m.supplierKey,
      reason: m.reason,
      externalId: m.externalId,
    })),
    newRecords: dedupe.newRecords.map((n) => ({
      index: n.index,
      metricKey: n.metricKey,
      supplierKey: n.supplierKey,
      externalId: n.externalId,
    })),
  };
}

async function createDatapoint(
  organisationId: string,
  periodId: string,
  record: NormalizedIngestRecord,
  actorId?: string,
): Promise<IngestResult> {
  const payload = await getPayload({ config });

  const result = await (
    payload.create as (args: {
      collection: "datapoints";
      data: Record<string, unknown>;
      overrideAccess: true;
    }) => Promise<{ id: string }>
  )({
    collection: "datapoints",
    data: {
      organisation: organisationId,
      period: periodId,
      metricKey: record.metricKey,
      value: record.quality === "missing" ? null : (record.value ?? null),
      unit: record.unit,
      quality: record.quality,
      source: "api",
      supplier: record.supplierId,
      supplierKey: record.supplierKey || NO_SUPPLIER_KEY,
      approvalState: "pending",
      enteredBy: actorId,
      enteredAt: new Date().toISOString(),
    },
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId,
    actorId,
    action: "datapoint.webhook_ingest",
    entityType: "datapoints",
    entityId: result.id,
    after: {
      metricKey: record.metricKey,
      value: record.value,
      quality: record.quality,
      source: "api",
      supplierKey: record.supplierKey,
    },
  });

  return {
    id: result.id,
    status: "created",
    timestamp: new Date().toISOString(),
  };
}

/** Legacy single-create path — still used by callers that already validated one row. */
export async function ingestDatapoint(
  organisationId: string,
  periodId: string,
  input: IngestDatapointInput,
  actorId?: string,
): Promise<IngestResult> {
  const record: NormalizedIngestRecord = {
    index: 0,
    metricKey: input.metricKey,
    value: input.value,
    quality: input.quality,
    unit: input.unit,
    source: input.source ?? "api",
    supplierKey: supplierKeyFrom(input.supplierId),
    supplierId: input.supplierId,
    externalId: input.externalId,
  };

  const existingKeys = await loadExistingKeys(organisationId, periodId, [
    record.metricKey,
  ]);
  const dedupe = deduplicateIngestRecords(
    organisationId,
    periodId,
    toDedupRecords([record]),
    existingKeys,
  );
  if (dedupe.matched.length > 0) {
    throw new Error(
      `Duplicate datapoint for organisation/period/metric/supplierKey (${record.metricKey}).`,
    );
  }

  const orgPayload = await getPayload({ config });
  const org = await orgPayload.findByID({
    collection: "organisations",
    id: organisationId,
    depth: 0,
    overrideAccess: true,
  });
  if (!org) throw new Error("Organisation not found");

  const period = await orgPayload.findByID({
    collection: "reporting-periods",
    id: periodId,
    depth: 0,
    overrideAccess: true,
  });
  if (!period || period.status !== "open") {
    throw new Error("Reporting period not open");
  }

  return createDatapoint(organisationId, periodId, record, actorId);
}

export type ProcessIngestOptions = {
  organisationId: string;
  periodId: string;
  body: unknown;
  actorId?: string;
  dryRunDefault?: boolean;
};

/**
 * Full ingest pipeline: normalize → validate → dedupe → dry-run or commit.
 * Always returns the AC response shape.
 */
export async function processIngest(
  options: ProcessIngestOptions,
): Promise<IngestBatchResponse> {
  const batchId = randomUUID();
  const { organisationId, periodId, body, actorId } = options;
  const normalized = normalizeIngestPayload(body, {
    dryRunDefault: options.dryRunDefault ?? false,
  });

  const errors: IngestError[] = [...normalized.errors];
  const validRecords = normalized.records;

  if (validRecords.length === 0) {
    const response: IngestBatchResponse = {
      ok: true,
      dryRun: normalized.dryRun,
      batchId,
      recordsProcessed: 0,
      recordsSkipped: 0,
      recordsFailed: errors.length,
      errors,
      deduplicationReport: { matched: [], newRecords: [] },
    };
    await logIngestAttempt(organisationId, batchId, response);
    return response;
  }

  const payload = await getPayload({ config });
  const org = await payload.findByID({
    collection: "organisations",
    id: organisationId,
    depth: 0,
    overrideAccess: true,
  });
  if (!org) throw new Error("Organisation not found");

  const period = await payload.findByID({
    collection: "reporting-periods",
    id: periodId,
    depth: 0,
    overrideAccess: true,
  });
  if (!period || period.status !== "open") {
    throw new Error("Reporting period not open");
  }

  const existingKeys = await loadExistingKeys(
    organisationId,
    periodId,
    validRecords.map((r) => r.metricKey),
  );
  const dedupe = deduplicateIngestRecords(
    organisationId,
    periodId,
    toDedupRecords(validRecords),
    existingKeys,
  );

  const newIndexSet = new Set(dedupe.newRecords.map((r) => r.index));
  const toWrite = validRecords.filter((r) => newIndexSet.has(r.index));

  let recordsProcessed = 0;

  if (!normalized.dryRun) {
    const batchSize = 10;
    for (let i = 0; i < toWrite.length; i += batchSize) {
      const batch = toWrite.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((item) => createDatapoint(organisationId, periodId, item, actorId)),
      );
      results.forEach((result, batchIndex) => {
        const item = batch[batchIndex];
        if (!item) return;
        if (result.status === "fulfilled") {
          recordsProcessed += 1;
        } else {
          errors.push({
            index: item.index,
            error:
              result.reason instanceof Error
                ? result.reason.message
                : "Failed to create datapoint",
          });
        }
      });
    }
  } else {
    // Dry-run: count would-be writes as processed for the preview totals.
    recordsProcessed = toWrite.length;
  }

  const response: IngestBatchResponse = {
    ok: true,
    dryRun: normalized.dryRun,
    batchId,
    recordsProcessed,
    recordsSkipped: dedupe.matched.length,
    recordsFailed: errors.length,
    errors,
    deduplicationReport: buildReport(dedupe),
  };

  await logIngestAttempt(organisationId, batchId, response);
  return response;
}

async function logIngestAttempt(
  organisationId: string,
  batchId: string,
  response: IngestBatchResponse,
): Promise<void> {
  try {
    await logWebhookAttempt({
      webhookId: `api-ingest:${batchId}`,
      organisationId,
      eventType: "data.ingest",
      source: "api",
      batchId,
      recordCount:
        response.recordsProcessed + response.recordsSkipped + response.recordsFailed,
      payload: {
        source: "api",
        batchId,
        dryRun: response.dryRun,
        recordsProcessed: response.recordsProcessed,
        recordsSkipped: response.recordsSkipped,
        recordsFailed: response.recordsFailed,
        deduplicationReport: response.deduplicationReport,
        errors: response.errors,
      },
      status:
        response.recordsFailed > 0 && response.recordsProcessed === 0
          ? "failed"
          : "success",
      responseCode: 201,
      attemptNumber: 1,
    });
  } catch (err) {
    console.error("[ingest] failed to write webhook log", err);
  }
}

/** @deprecated Prefer processIngest — kept for call-site compatibility. */
export async function batchIngestDatapoints(
  organisationId: string,
  periodId: string,
  inputs: IngestDatapointInput[],
  actorId?: string,
): Promise<IngestBatchResponse> {
  return processIngest({
    organisationId,
    periodId,
    body: inputs,
    actorId,
    dryRunDefault: false,
  });
}
