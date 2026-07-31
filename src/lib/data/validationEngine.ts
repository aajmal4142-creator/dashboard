import { getPayload } from "payload";

import config from "@/payload.config";
import {
  evaluateRules,
  toEvaluableRule,
  type DatapointRecord,
  type ValidationResult,
} from "@/lib/data/validation";

export type {
  DatapointRecord,
  ValidationResult,
  ValidationViolation,
} from "@/lib/data/validation";

/**
 * Load active org rules and evaluate a datapoint. I/O wrapper around pure evaluateRules.
 */
export async function validateDatapoint(
  orgId: string,
  datapoint: DatapointRecord,
): Promise<ValidationResult> {
  const payload = await getPayload({ config });

  const rules = await payload.find({
    collection: "data-quality-rules",
    where: {
      and: [
        { organisation: { equals: orgId } },
        { status: { equals: "active" } },
        { appliesTo: { equals: "datapoints" } },
      ],
    },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  });

  const evaluable = rules.docs.map(toEvaluableRule);
  return evaluateRules(evaluable, datapoint);
}

/**
 * Evaluate a single stored rule (any status) against a datapoint.
 */
export async function validateDatapointAgainstRule(
  ruleId: string,
  datapoint: DatapointRecord,
): Promise<ValidationResult> {
  const payload = await getPayload({ config });
  const rule = await payload.findByID({
    collection: "data-quality-rules",
    id: ruleId,
    depth: 0,
    overrideAccess: true,
  });
  return evaluateRules([toEvaluableRule(rule)], datapoint);
}

export async function validateBatch(
  orgId: string,
  datapoints: DatapointRecord[],
): Promise<Map<string, ValidationResult>> {
  const results = new Map<string, ValidationResult>();

  // Load rules once for the batch
  const payload = await getPayload({ config });
  const rules = await payload.find({
    collection: "data-quality-rules",
    where: {
      and: [
        { organisation: { equals: orgId } },
        { status: { equals: "active" } },
        { appliesTo: { equals: "datapoints" } },
      ],
    },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  });
  const evaluable = rules.docs.map(toEvaluableRule);

  for (const datapoint of datapoints) {
    const result = evaluateRules(evaluable, datapoint);
    results.set(datapoint.id || JSON.stringify(datapoint), result);
  }

  return results;
}

/** Map a Payload datapoint doc into a flat record for rule evaluation. */
export function datapointDocToRecord(doc: {
  id: string;
  metricKey?: string | null;
  value?: number | null;
  quality?: string | null;
  unit?: string | null;
  source?: string | null;
  approvalState?: string | null;
  provenance?: string | null;
  supplierKey?: string | null;
}): DatapointRecord {
  return {
    id: doc.id,
    metricKey: doc.metricKey ?? undefined,
    value: doc.value ?? null,
    quality: doc.quality ?? null,
    unit: doc.unit ?? null,
    source: doc.source ?? null,
    approvalState: doc.approvalState ?? null,
    provenance: doc.provenance ?? null,
    supplierKey: doc.supplierKey ?? null,
  };
}
