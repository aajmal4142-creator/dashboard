import type { Payload } from "payload";

import { writeAuditLog } from "@/lib/audit/write";
import type { Quality } from "@/lib/calc";
import { NO_SUPPLIER_KEY } from "@/lib/suppliers/supplierKey";

export type DatapointWriteInput = {
  organisationId: string;
  periodId: string;
  metricKey: string;
  value: number | null;
  unit?: string | null;
  quality: Quality;
  source: "manual" | "import" | "supplier" | "estimate" | "api" | "internal_survey";
  actorId: string;
  assignedTo?: string | null;
};

export type DatapointWriteResult = {
  id: string;
  approvalReset: boolean;
};

/**
 * Central Datapoint write path — grid, paste commit, and Excel commit.
 * Editing an approved row resets approvalState → pending + AuditLog.
 * Locked periods are refused by the collection hook; callers should pre-check.
 */
export async function writeDatapoint(
  payload: Payload,
  input: DatapointWriteInput,
): Promise<DatapointWriteResult> {
  const existing = await payload.find({
    collection: "datapoints",
    where: {
      and: [
        { organisation: { equals: input.organisationId } },
        { period: { equals: input.periodId } },
        { metricKey: { equals: input.metricKey } },
        { supplierKey: { equals: NO_SUPPLIER_KEY } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });

  const prev = existing.docs[0];
  const wasApproved = prev?.approvalState === "approved";

  const data: Record<string, unknown> = {
    organisation: input.organisationId,
    period: input.periodId,
    metricKey: input.metricKey,
    value: input.value ?? undefined,
    unit: input.unit ?? undefined,
    quality: input.quality,
    source: input.source,
    supplierKey: NO_SUPPLIER_KEY,
    provenance: "manual",
    enteredBy: input.actorId,
    enteredAt: new Date().toISOString(),
  };

  if (input.assignedTo !== undefined) {
    data.assignedTo = input.assignedTo;
  }

  if (wasApproved) {
    data.approvalState = "pending";
    data.approvalReason = "Value changed after approval — re-validation required.";
  }

  if (prev) {
    const updated = await payload.update({
      collection: "datapoints",
      id: prev.id,
      data,
      overrideAccess: true,
    });

    if (wasApproved) {
      await writeAuditLog(payload, {
        organisationId: input.organisationId,
        actorId: input.actorId,
        action: "datapoint.approval_reset",
        entityType: "datapoints",
        entityId: prev.id,
        before: {
          approvalState: "approved",
          value: prev.value,
          quality: prev.quality,
        },
        after: {
          approvalState: "pending",
          value: input.value,
          quality: input.quality,
          reason: "edited after approval",
        },
      });
    }

    return { id: updated.id, approvalReset: wasApproved };
  }

  const created = await (
    payload.create as (args: {
      collection: "datapoints";
      data: Record<string, unknown>;
      overrideAccess: true;
    }) => Promise<{ id: string }>
  )({
    collection: "datapoints",
    data: {
      ...data,
      approvalState: "pending",
    },
    overrideAccess: true,
  });

  return { id: created.id, approvalReset: false };
}
