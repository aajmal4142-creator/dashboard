/**
 * Payload I/O for base-year restatement events.
 * Keep pure compare/disclosure helpers out of this module.
 */

import type { Payload, Where } from "payload";

import { BASE_YEAR_RESTATEMENTS_SLUG } from "@/collections/BaseYearRestatements";

import {
  buildAuditNarrativeFromVersions,
  buildDisclosureNote,
  compareBaseYearInventories,
  normaliseInventorySnapshot,
} from "./compare";
import type {
  BaseYearInventoryComparison,
  InventorySnapshot,
  RestatementReason,
  RestatementStatus,
} from "./types";
import { isRestatementReason, isRestatementStatus } from "./types";

export type PeriodOption = {
  id: string;
  label: string;
  status: string | null;
};

export type RestatementDto = {
  id: string;
  title: string;
  reason: RestatementReason;
  reasonDetail: string;
  methodologyNote: string;
  status: RestatementStatus;
  effectivePeriodId: string;
  effectivePeriodLabel: string | null;
  baseYearPeriodId: string;
  baseYearPeriodLabel: string | null;
  priorInventory: InventorySnapshot;
  restatedInventory: InventorySnapshot;
  disclosureNote: string | null;
  auditNarrative: string | null;
  comparison: BaseYearInventoryComparison | null;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function relationId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

function relationLabel(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  if ("label" in value && typeof (value as { label: unknown }).label === "string") {
    return (value as { label: string }).label;
  }
  return null;
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

function readInventoryGroup(value: unknown): InventorySnapshot {
  if (!value || typeof value !== "object") {
    return normaliseInventorySnapshot(null);
  }
  const g = value as Record<string, unknown>;
  return normaliseInventorySnapshot({
    scope1: typeof g.scope1 === "number" ? g.scope1 : null,
    scope2: typeof g.scope2 === "number" ? g.scope2 : null,
    scope3: typeof g.scope3 === "number" ? g.scope3 : null,
    quality: g.quality === "measured" ? "measured" : "missing",
    source: optionalString(g.source),
    capturedAt: optionalString(g.capturedAt),
  });
}

function inventoryToData(snapshot: InventorySnapshot) {
  return {
    scope1: snapshot.scope1 ?? undefined,
    scope2: snapshot.scope2 ?? undefined,
    scope3: snapshot.scope3 ?? undefined,
    quality: snapshot.quality,
    source: snapshot.source ?? undefined,
    capturedAt: snapshot.capturedAt ?? undefined,
  };
}

function parseComparison(value: unknown): BaseYearInventoryComparison | null {
  if (!value || typeof value !== "object") return null;
  return value as BaseYearInventoryComparison;
}

export function docToRestatement(doc: {
  id: string;
  title?: unknown;
  reason?: unknown;
  reasonDetail?: unknown;
  methodologyNote?: unknown;
  status?: unknown;
  effectivePeriod?: unknown;
  baseYearPeriod?: unknown;
  priorInventory?: unknown;
  restatedInventory?: unknown;
  disclosureNote?: unknown;
  auditNarrative?: unknown;
  comparisonJson?: unknown;
  finalizedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}): RestatementDto {
  const reason = isRestatementReason(doc.reason) ? doc.reason : "other";
  const status = isRestatementStatus(doc.status) ? doc.status : "draft";
  const priorInventory = readInventoryGroup(doc.priorInventory);
  const restatedInventory = readInventoryGroup(doc.restatedInventory);
  const stored = parseComparison(doc.comparisonJson);
  const comparison =
    stored ?? compareBaseYearInventories(priorInventory, restatedInventory);

  return {
    id: String(doc.id),
    title: String(doc.title ?? ""),
    reason,
    reasonDetail: String(doc.reasonDetail ?? ""),
    methodologyNote: String(doc.methodologyNote ?? ""),
    status,
    effectivePeriodId: relationId(doc.effectivePeriod) ?? "",
    effectivePeriodLabel: relationLabel(doc.effectivePeriod),
    baseYearPeriodId: relationId(doc.baseYearPeriod) ?? "",
    baseYearPeriodLabel: relationLabel(doc.baseYearPeriod),
    priorInventory,
    restatedInventory,
    disclosureNote: optionalString(doc.disclosureNote),
    auditNarrative: optionalString(doc.auditNarrative),
    comparison,
    finalizedAt: optionalString(doc.finalizedAt),
    createdAt: String(doc.createdAt ?? ""),
    updatedAt: String(doc.updatedAt ?? ""),
  };
}

export async function listOrgPeriods(
  payload: Payload,
  organisationId: string,
): Promise<PeriodOption[]> {
  const result = await payload.find({
    collection: "reporting-periods",
    where: { organisation: { equals: organisationId } },
    sort: "-startDate",
    limit: 100,
    depth: 0,
    overrideAccess: true,
  });
  return result.docs.map((p) => ({
    id: String(p.id),
    label: String(p.label ?? p.id),
    status: typeof p.status === "string" ? p.status : null,
  }));
}

export async function listOrgRestatements(
  payload: Payload,
  organisationId: string,
): Promise<RestatementDto[]> {
  const result = await payload.find({
    collection: BASE_YEAR_RESTATEMENTS_SLUG,
    where: { organisation: { equals: organisationId } },
    sort: "-updatedAt",
    limit: 100,
    depth: 1,
    overrideAccess: true,
  });
  return result.docs.map((doc) => docToRestatement(doc));
}

export async function getOrgRestatement(
  payload: Payload,
  organisationId: string,
  id: string,
): Promise<RestatementDto | null> {
  const doc = await payload
    .findByID({
      collection: BASE_YEAR_RESTATEMENTS_SLUG,
      id,
      depth: 1,
      overrideAccess: true,
    })
    .catch(() => null);
  if (!doc) return null;
  const org = relationId(doc.organisation);
  if (org !== organisationId) return null;
  return docToRestatement(doc);
}

/**
 * Load inventory snapshot from a published report for the base-year period,
 * falling back to GHG Protocol compliance totals for a matching year label.
 */
export async function loadBaseYearInventorySnapshot(
  payload: Payload,
  organisationId: string,
  periodId: string,
): Promise<InventorySnapshot> {
  const period = await payload
    .findByID({
      collection: "reporting-periods",
      id: periodId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null);
  const periodOrg = period ? relationId(period.organisation) : null;
  if (!period || periodOrg !== organisationId) {
    return normaliseInventorySnapshot({
      quality: "missing",
      source: "period_not_found",
    });
  }

  const reports = await payload.find({
    collection: "reports",
    where: {
      and: [
        { organisation: { equals: organisationId } },
        { period: { equals: periodId } },
        { status: { equals: "published" } },
      ],
    } as Where,
    sort: "-publishedAt",
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });

  const report = reports.docs[0];
  if (report?.emissions) {
    const e = report.emissions as {
      scope1?: number | null;
      scope2?: number | null;
      scope3?: number | null;
    };
    return normaliseInventorySnapshot({
      scope1: typeof e.scope1 === "number" ? e.scope1 : null,
      scope2: typeof e.scope2 === "number" ? e.scope2 : null,
      scope3: typeof e.scope3 === "number" ? e.scope3 : null,
      source: `report:${report.id}`,
      capturedAt: new Date().toISOString(),
    });
  }

  const yearHint =
    typeof period.label === "string"
      ? period.label.replace(/[^0-9]/g, "").slice(0, 4)
      : "";
  if (yearHint.length === 4) {
    const compliance = await payload.find({
      collection: "ghg-protocol-compliance",
      where: {
        and: [
          { organisation: { equals: organisationId } },
          { complianceYear: { equals: yearHint } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    const row = compliance.docs[0];
    if (row) {
      return normaliseInventorySnapshot({
        scope1: typeof row.scope1Total === "number" ? row.scope1Total : null,
        scope2: typeof row.scope2Total === "number" ? row.scope2Total : null,
        scope3: typeof row.scope3Total === "number" ? row.scope3Total : null,
        source: `ghg-protocol-compliance:${row.id}`,
        capturedAt: new Date().toISOString(),
      });
    }
  }

  return normaliseInventorySnapshot({
    quality: "missing",
    source: "no_published_inventory",
    capturedAt: new Date().toISOString(),
  });
}

export async function loadAuditNarrativeForPeriod(
  payload: Payload,
  organisationId: string,
  periodId: string,
): Promise<string | null> {
  const period = await payload
    .findByID({
      collection: "reporting-periods",
      id: periodId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null);
  if (!period || relationId(period.organisation) !== organisationId) {
    return null;
  }

  const start = period.startDate ? new Date(String(period.startDate)) : null;
  const end = period.endDate ? new Date(String(period.endDate)) : null;

  const versions = await payload.find({
    collection: "datapoint-versions",
    where: { organisation: { equals: organisationId } },
    sort: "-changedAt",
    limit: 80,
    depth: 0,
    overrideAccess: true,
  });

  const filtered = versions.docs.filter((v) => {
    if (!start || !end || !v.changedAt) return true;
    const t = new Date(String(v.changedAt)).getTime();
    return t >= start.getTime() && t <= end.getTime() + 86_400_000;
  });

  return buildAuditNarrativeFromVersions(
    filtered.map((v) => ({
      datapointId: String(v.datapointId ?? ""),
      versionNumber: Number(v.versionNumber ?? 0),
      changeType: String(v.changeType ?? "update"),
      changedAt: v.changedAt ? String(v.changedAt) : null,
      changeReason:
        typeof (v as { reason?: unknown }).reason === "string"
          ? String((v as { reason: string }).reason)
          : null,
    })),
  );
}

export type CreateRestatementInput = {
  title: string;
  reason: RestatementReason;
  reasonDetail: string;
  methodologyNote: string;
  effectivePeriodId: string;
  baseYearPeriodId: string;
  priorInventory?: InventorySnapshot | null;
  restatedInventory?: InventorySnapshot | null;
  auditNarrative?: string | null;
  createdBy?: string;
};

export async function createRestatement(
  payload: Payload,
  organisationId: string,
  input: CreateRestatementInput,
): Promise<RestatementDto> {
  let prior =
    input.priorInventory ??
    (await loadBaseYearInventorySnapshot(
      payload,
      organisationId,
      input.baseYearPeriodId,
    ));
  prior = normaliseInventorySnapshot(prior);

  const restated = normaliseInventorySnapshot(
    input.restatedInventory ?? {
      quality: "missing",
      source: "pending_recalculation",
    },
  );

  const auditNarrative =
    input.auditNarrative ??
    (await loadAuditNarrativeForPeriod(payload, organisationId, input.baseYearPeriodId));

  const comparison = compareBaseYearInventories(prior, restated);

  const created = await payload.create({
    collection: BASE_YEAR_RESTATEMENTS_SLUG,
    data: {
      organisation: organisationId,
      title: input.title,
      reason: input.reason,
      reasonDetail: input.reasonDetail,
      methodologyNote: input.methodologyNote,
      effectivePeriod: input.effectivePeriodId,
      baseYearPeriod: input.baseYearPeriodId,
      status: "draft",
      priorInventory: inventoryToData(prior),
      restatedInventory: inventoryToData(restated),
      auditNarrative: auditNarrative ?? undefined,
      comparisonJson: comparison,
      createdBy: input.createdBy,
    },
    overrideAccess: true,
  });

  return docToRestatement(created);
}

export type UpdateRestatementInput = {
  title?: string;
  reason?: RestatementReason;
  reasonDetail?: string;
  methodologyNote?: string;
  effectivePeriodId?: string;
  baseYearPeriodId?: string;
  priorInventory?: InventorySnapshot | null;
  restatedInventory?: InventorySnapshot | null;
  auditNarrative?: string | null;
  disclosureNote?: string | null;
};

export async function updateRestatement(
  payload: Payload,
  organisationId: string,
  id: string,
  input: UpdateRestatementInput,
): Promise<RestatementDto | null> {
  const existing = await getOrgRestatement(payload, organisationId, id);
  if (!existing) return null;
  if (existing.status === "final") {
    throw new Error("Final restatements cannot be edited. Create a new draft.");
  }

  const prior = normaliseInventorySnapshot(
    input.priorInventory ?? existing.priorInventory,
  );
  const restated = normaliseInventorySnapshot(
    input.restatedInventory ?? existing.restatedInventory,
  );
  const comparison = compareBaseYearInventories(prior, restated);

  const updated = await payload.update({
    collection: BASE_YEAR_RESTATEMENTS_SLUG,
    id,
    data: {
      title: input.title ?? existing.title,
      reason: input.reason ?? existing.reason,
      reasonDetail: input.reasonDetail ?? existing.reasonDetail,
      methodologyNote: input.methodologyNote ?? existing.methodologyNote,
      effectivePeriod: input.effectivePeriodId ?? existing.effectivePeriodId,
      baseYearPeriod: input.baseYearPeriodId ?? existing.baseYearPeriodId,
      priorInventory: inventoryToData(prior),
      restatedInventory: inventoryToData(restated),
      auditNarrative:
        input.auditNarrative !== undefined
          ? (input.auditNarrative ?? undefined)
          : (existing.auditNarrative ?? undefined),
      disclosureNote:
        input.disclosureNote !== undefined
          ? (input.disclosureNote ?? undefined)
          : (existing.disclosureNote ?? undefined),
      comparisonJson: comparison,
    },
    overrideAccess: true,
  });

  return docToRestatement(updated);
}

export async function finalizeRestatement(
  payload: Payload,
  organisationId: string,
  id: string,
  userId: string,
  organisationName: string,
): Promise<RestatementDto | null> {
  const existing = await getOrgRestatement(payload, organisationId, id);
  if (!existing) return null;
  if (existing.status === "final") {
    return existing;
  }

  const prior = existing.priorInventory;
  const restated = existing.restatedInventory;
  const comparison = compareBaseYearInventories(prior, restated);
  const finalizedAt = new Date().toISOString();

  const disclosureNote = buildDisclosureNote({
    organisationName,
    reason: existing.reason,
    reasonDetail: existing.reasonDetail,
    methodologyNote: existing.methodologyNote,
    effectivePeriodLabel: existing.effectivePeriodLabel ?? existing.effectivePeriodId,
    baseYearPeriodLabel: existing.baseYearPeriodLabel ?? existing.baseYearPeriodId,
    comparison,
    auditNarrative: existing.auditNarrative,
    finalizedAt,
  });

  const updated = await payload.update({
    collection: BASE_YEAR_RESTATEMENTS_SLUG,
    id,
    data: {
      status: "final",
      comparisonJson: comparison,
      disclosureNote,
      finalizedAt,
      finalizedBy: userId,
    },
    overrideAccess: true,
  });

  return docToRestatement(updated);
}

export async function deleteRestatement(
  payload: Payload,
  organisationId: string,
  id: string,
): Promise<boolean> {
  const existing = await getOrgRestatement(payload, organisationId, id);
  if (!existing) return false;
  if (existing.status === "final") {
    throw new Error("Final restatements cannot be deleted.");
  }
  await payload.delete({
    collection: BASE_YEAR_RESTATEMENTS_SLUG,
    id,
    overrideAccess: true,
  });
  return true;
}

export async function assertPeriodInOrg(
  payload: Payload,
  organisationId: string,
  periodId: string,
): Promise<boolean> {
  const period = await payload
    .findByID({
      collection: "reporting-periods",
      id: periodId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null);
  return Boolean(period && relationId(period.organisation) === organisationId);
}
