import { getPayload } from "payload";
import { z } from "zod";
import config from "@/payload.config";
import { writeAuditLog } from "@/lib/audit/write";

const DatapointSchema = z.object({
  metricKey: z.string().min(1),
  value: z.number().nullable().optional(),
  quality: z.enum(["measured", "calculated", "estimated", "missing"]),
  unit: z.string().optional(),
  source: z.string().default("webhook"),
});

export type IngestDatapointInput = z.infer<typeof DatapointSchema>;

export interface IngestResult {
  id: string;
  status: "created";
  timestamp: string;
}

export async function ingestDatapoint(
  organisationId: string,
  periodId: string,
  input: IngestDatapointInput,
  actorId?: string,
): Promise<IngestResult> {
  // Validate input
  const validated = DatapointSchema.parse(input);

  const payload = await getPayload({ config });

  // Check org exists
  const org = await payload.findByID({
    collection: "organisations",
    id: organisationId,
    depth: 0,
    overrideAccess: true,
  });
  if (!org) throw new Error("Organisation not found");

  // Check period is open
  const period = await payload.findByID({
    collection: "reporting-periods",
    id: periodId,
    depth: 0,
    overrideAccess: true,
  });
  if (!period || period.status !== "open") {
    throw new Error("Reporting period not open");
  }

  // Create datapoint
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
      metricKey: validated.metricKey,
      value: validated.quality === "missing" ? null : (validated.value ?? null),
      unit: validated.unit,
      quality: validated.quality,
      source: "webhook",
    },
    overrideAccess: true,
  });

  // Audit log
  await writeAuditLog(payload, {
    organisationId,
    actorId,
    action: "datapoint.webhook_ingest",
    entityType: "datapoints",
    entityId: result.id,
    after: {
      metricKey: validated.metricKey,
      value: validated.value,
      quality: validated.quality,
      source: "webhook",
    },
  });

  return {
    id: result.id,
    status: "created",
    timestamp: new Date().toISOString(),
  };
}

export interface BatchIngestResult {
  inserted: number;
  failed: number;
  errors: Array<{ index: number; error: string }>;
}

export async function batchIngestDatapoints(
  organisationId: string,
  periodId: string,
  inputs: IngestDatapointInput[],
  actorId?: string,
): Promise<BatchIngestResult> {
  const errors: Array<{ index: number; error: string }> = [];
  let inserted = 0;

  // Validate all inputs first
  const validated = inputs.map((input, index) => {
    try {
      return { index, data: DatapointSchema.parse(input) };
    } catch (err) {
      const message = err instanceof z.ZodError ? err.errors[0].message : "Invalid data";
      errors.push({ index, error: message });
      return null;
    }
  }).filter(Boolean) as Array<{ index: number; data: IngestDatapointInput }>;

  // Process in parallel (max 10 concurrent)
  const batchSize = 10;
  for (let i = 0; i < validated.length; i += batchSize) {
    const batch = validated.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((item) =>
        ingestDatapoint(organisationId, periodId, item.data, actorId),
      ),
    );

    results.forEach((result, batchIndex) => {
      const originalIndex = batch[batchIndex]?.index;
      if (result.status === "fulfilled") {
        inserted++;
      } else {
        if (originalIndex !== undefined) {
          errors.push({
            index: originalIndex,
            error: result.reason instanceof Error ? result.reason.message : "Unknown error",
          });
        }
      }
    });
  }

  return {
    inserted,
    failed: errors.length,
    errors,
  };
}
