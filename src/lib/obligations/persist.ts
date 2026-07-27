/**
 * Persist derived obligations into compliance-obligations.
 * I/O lives here — keep lib/obligations/* pure.
 */

import type { Payload } from "payload";

import { writeAuditLog } from "@/lib/audit/write";
import {
  deriveObligations,
  hasBaselineDrift,
  parseRevenueBand,
  shouldSkipEngineWrite,
  type ObligationInput,
  type ObligationResult,
} from "@/lib/obligations";

export type PersistObligationOptions = {
  organisationId: string;
  actorId: string;
  input: ObligationInput;
  /** When true, overwrite even sticky manual overrides. */
  force?: boolean;
};

export type PersistObligationResult = {
  obligations: Array<{
    id: string;
    result: ObligationResult;
    action: "created" | "updated" | "skipped_manual";
  }>;
  /** Sticky manual rows whose stored baseline no longer matches current figures. */
  baselineDrift: boolean;
  voluntary: boolean;
};

function toPayloadData(organisationId: string, result: ObligationResult) {
  return {
    organisation: organisationId,
    wave: result.wave,
    jurisdiction: result.jurisdiction,
    standardVersion: result.standardVersion,
    firstReportingFY: result.firstReportingFY,
    filingDeadline: result.filingDeadline,
    derivationReason: result.reason,
    confidence: result.confidence,
    source: "engine" as const,
    derivedInputs: {
      country: result.derivedInputs.country,
      headcount: result.derivedInputs.headcount,
      revenueBand: result.derivedInputs.revenueBand,
      asOf: result.derivedInputs.asOf,
    },
  };
}

/**
 * Upsert engine results for an org. Sticky manuals are left intact and
 * surface baselineDrift when figures changed.
 */
export async function persistDerivedObligations(
  payload: Payload,
  options: PersistObligationOptions,
): Promise<PersistObligationResult> {
  const { organisationId, actorId, input, force = false } = options;
  const derived = deriveObligations(input);
  const existing = await payload.find({
    collection: "compliance-obligations",
    where: { organisation: { equals: organisationId } },
    limit: 50,
    overrideAccess: true,
  });

  let baselineDrift = false;
  for (const doc of existing.docs) {
    if (doc.source === "manual") {
      const stored = doc.derivedInputs
        ? {
            country: doc.derivedInputs.country ?? "",
            headcount: doc.derivedInputs.headcount ?? null,
            revenueBand: parseRevenueBand(doc.derivedInputs.revenueBand),
            asOf: doc.derivedInputs.asOf ?? "",
          }
        : null;
      if (hasBaselineDrift(stored, input)) {
        baselineDrift = true;
      }
    }
  }

  const outcomes: PersistObligationResult["obligations"] = [];

  // Prefer updating the earliest / primary existing row when a single result.
  // Multiple engine results: update by wave match, else create.
  for (const result of derived.obligations) {
    const match =
      existing.docs.find((d) => d.wave === result.wave) ??
      (derived.obligations.length === 1 ? existing.docs[0] : undefined);

    if (match && shouldSkipEngineWrite(match, force)) {
      outcomes.push({ id: match.id, result, action: "skipped_manual" });
      continue;
    }

    const data = toPayloadData(organisationId, result);

    if (match) {
      const before = {
        wave: match.wave,
        filingDeadline: match.filingDeadline,
        confidence: match.confidence,
        source: match.source,
        derivationReason: match.derivationReason,
      };
      const updated = await payload.update({
        collection: "compliance-obligations",
        id: match.id,
        data,
        overrideAccess: true,
      });
      await writeAuditLog(payload, {
        organisationId,
        actorId,
        action: "obligation.derived",
        entityType: "compliance-obligations",
        entityId: updated.id,
        before,
        after: {
          wave: result.wave,
          filingDeadline: result.filingDeadline,
          confidence: result.confidence,
          source: "engine",
          derivationReason: result.reason,
        },
      });
      outcomes.push({ id: updated.id, result, action: "updated" });
    } else {
      const created = await (
        payload.create as (args: {
          collection: "compliance-obligations";
          data: Record<string, unknown>;
          overrideAccess: true;
        }) => Promise<{ id: string }>
      )({
        collection: "compliance-obligations",
        data,
        overrideAccess: true,
      });
      await writeAuditLog(payload, {
        organisationId,
        actorId,
        action: "obligation.derived",
        entityType: "compliance-obligations",
        entityId: created.id,
        after: {
          wave: result.wave,
          filingDeadline: result.filingDeadline,
          confidence: result.confidence,
          source: "engine",
          derivationReason: result.reason,
        },
      });
      outcomes.push({ id: created.id, result, action: "created" });
    }
  }

  return {
    obligations: outcomes,
    baselineDrift,
    voluntary: derived.voluntary,
  };
}

export type ManualOverrideInput = {
  organisationId: string;
  actorId: string;
  obligationId: string;
  filingDeadline: string | null;
  notes?: string;
  confirmOnly?: boolean;
};

/** Owner/Admin confirm or override — sticky source=manual. */
export async function applyManualObligationOverride(
  payload: Payload,
  input: ManualOverrideInput,
): Promise<{ id: string }> {
  const existing = await payload.findByID({
    collection: "compliance-obligations",
    id: input.obligationId,
    depth: 0,
    overrideAccess: true,
  });
  const orgId =
    typeof existing.organisation === "string"
      ? existing.organisation
      : existing.organisation.id;
  if (orgId !== input.organisationId) {
    throw new Error("Obligation does not belong to active organisation");
  }

  const before = {
    filingDeadline: existing.filingDeadline,
    source: existing.source,
    confidence: existing.confidence,
    notes: existing.notes,
    confirmedAt: existing.confirmedAt,
  };

  const confirmedAt = new Date().toISOString();
  const updated = await payload.update({
    collection: "compliance-obligations",
    id: input.obligationId,
    data: {
      filingDeadline: input.filingDeadline,
      notes: input.notes ?? existing.notes,
      source: "manual",
      confidence: "derived",
      confirmedAt,
      derivationReason: input.confirmOnly
        ? existing.derivationReason
        : [
            existing.derivationReason,
            input.notes
              ? `Manual override: ${input.notes}`
              : "Manual override by organisation admin.",
          ]
            .filter(Boolean)
            .join("\n\n"),
    },
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: input.organisationId,
    actorId: input.actorId,
    action: input.confirmOnly ? "obligation.confirm" : "obligation.override",
    entityType: "compliance-obligations",
    entityId: updated.id,
    before,
    after: {
      filingDeadline: updated.filingDeadline,
      source: "manual",
      confidence: "derived",
      notes: updated.notes,
      confirmedAt,
    },
  });

  return { id: updated.id };
}
