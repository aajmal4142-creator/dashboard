import type { Payload } from "payload";

import { CASCADED_TARGETS_SLUG } from "@/collections/CascadedTargets";
import { getOrgFacility } from "@/lib/facilities";
import { listOrgSbtiTargets } from "@/lib/compliance/sbtiService";

import {
  isAllocationMode,
  isCascadeStatus,
  resolveChildBaselineTco2e,
  resolveChildTargetTco2e,
  rollupChildProgress,
  validateAllocationShares,
  type AllocationMode,
  type CascadeAllocationInput,
  type CascadeProgressRollup,
  type CascadeStatus,
} from "./targetCascade";

export type CascadeAllocationDto = {
  id: string;
  facilityId: string;
  ownerId: string | null;
  mode: AllocationMode;
  sharePct: number | null;
  absoluteTco2e: number | null;
  reportedCurrentTco2e: number | null;
  notes: string | null;
  resolvedTargetTco2e: number | null;
  resolvedBaselineTco2e: number | null;
};

export type CascadedTargetDto = {
  id: string;
  organisationId: string;
  name: string;
  sbtiTargetId: string | null;
  baselineYear: number;
  targetYear: number;
  orgBaselineTco2e: number;
  orgTargetTco2e: number;
  requireExactShares: boolean;
  status: CascadeStatus;
  notes: string | null;
  allocations: CascadeAllocationDto[];
  shareSumPct: number;
  allocatedTargetTco2e: number;
  unallocatedTargetTco2e: number;
  createdAt: string;
  updatedAt: string;
};

export type CascadedTargetWriteInput = {
  name: string;
  sbtiTargetId?: string | null;
  baselineYear: number;
  targetYear: number;
  orgBaselineTco2e: number;
  orgTargetTco2e: number;
  requireExactShares?: boolean;
  status?: CascadeStatus;
  notes?: string | null;
  allocations: Array<{
    id?: string;
    facilityId: string;
    ownerId?: string | null;
    mode: AllocationMode;
    sharePct?: number | null;
    absoluteTco2e?: number | null;
    reportedCurrentTco2e?: number | null;
    notes?: string | null;
  }>;
};

function relationId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function allocationRowId(doc: { id?: unknown }, index: number): string {
  if (typeof doc.id === "string" && doc.id.trim()) return doc.id;
  return `row-${index}`;
}

export function docToCascadedTarget(doc: {
  id: string;
  organisation?: unknown;
  name?: unknown;
  sbtiTarget?: unknown;
  baselineYear?: unknown;
  targetYear?: unknown;
  orgBaselineTco2e?: unknown;
  orgTargetTco2e?: unknown;
  requireExactShares?: unknown;
  status?: unknown;
  notes?: unknown;
  allocations?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}): CascadedTargetDto {
  const orgBaselineTco2e = Number(doc.orgBaselineTco2e ?? 0);
  const orgTargetTco2e = Number(doc.orgTargetTco2e ?? 0);
  const rawAllocs = Array.isArray(doc.allocations) ? doc.allocations : [];

  const allocations: CascadeAllocationDto[] = rawAllocs.map((row, index) => {
    const r = row as Record<string, unknown>;
    const mode: AllocationMode = isAllocationMode(r.mode) ? r.mode : "sharePct";
    const input: CascadeAllocationInput = {
      id: allocationRowId(r, index),
      facilityId: relationId(r.facility) ?? "",
      ownerId: relationId(r.owner),
      mode,
      sharePct: optionalNumber(r.sharePct),
      absoluteTco2e: optionalNumber(r.absoluteTco2e),
    };
    return {
      id: input.id,
      facilityId: input.facilityId,
      ownerId: input.ownerId ?? null,
      mode,
      sharePct: input.sharePct ?? null,
      absoluteTco2e: input.absoluteTco2e ?? null,
      reportedCurrentTco2e: optionalNumber(r.reportedCurrentTco2e),
      notes: optionalString(r.notes),
      resolvedTargetTco2e: resolveChildTargetTco2e(orgTargetTco2e, input),
      resolvedBaselineTco2e: resolveChildBaselineTco2e(
        orgBaselineTco2e,
        orgTargetTco2e,
        input,
      ),
    };
  });

  const shareSumPct = allocations
    .filter((a) => a.mode === "sharePct")
    .reduce((s, a) => s + (a.sharePct ?? 0), 0);
  const allocatedTargetTco2e = allocations.reduce(
    (s, a) => s + (a.resolvedTargetTco2e ?? 0),
    0,
  );

  return {
    id: String(doc.id),
    organisationId: relationId(doc.organisation) ?? "",
    name: String(doc.name ?? ""),
    sbtiTargetId: relationId(doc.sbtiTarget),
    baselineYear: Number(doc.baselineYear ?? 0),
    targetYear: Number(doc.targetYear ?? 0),
    orgBaselineTco2e,
    orgTargetTco2e,
    requireExactShares: doc.requireExactShares === true,
    status: isCascadeStatus(doc.status) ? doc.status : "draft",
    notes: optionalString(doc.notes),
    allocations,
    shareSumPct,
    allocatedTargetTco2e,
    unallocatedTargetTco2e: Math.max(0, orgTargetTco2e - allocatedTargetTco2e),
    createdAt: String(doc.createdAt ?? ""),
    updatedAt: String(doc.updatedAt ?? ""),
  };
}

function toAllocationInputs(
  rows: CascadedTargetWriteInput["allocations"],
): CascadeAllocationInput[] {
  return rows.map((row, index) => ({
    id: row.id?.trim() ? row.id.trim() : `new-${index}`,
    facilityId: row.facilityId,
    ownerId: row.ownerId ?? null,
    mode: row.mode,
    sharePct: row.sharePct ?? null,
    absoluteTco2e: row.absoluteTco2e ?? null,
    notes: row.notes ?? null,
  }));
}

function toPayloadAllocations(rows: CascadedTargetWriteInput["allocations"]): Array<{
  id?: string;
  facility: string;
  owner?: string | null;
  mode: AllocationMode;
  sharePct?: number | null;
  absoluteTco2e?: number | null;
  reportedCurrentTco2e?: number | null;
  notes?: string | null;
}> {
  return rows.map((row) => {
    const data: {
      id?: string;
      facility: string;
      owner?: string | null;
      mode: AllocationMode;
      sharePct?: number | null;
      absoluteTco2e?: number | null;
      reportedCurrentTco2e?: number | null;
      notes?: string | null;
    } = {
      facility: row.facilityId,
      mode: row.mode,
      notes: row.notes?.trim() ? row.notes.trim() : undefined,
    };
    if (row.id?.trim()) data.id = row.id.trim();
    if (row.ownerId?.trim()) data.owner = row.ownerId.trim();
    else data.owner = null;

    if (row.mode === "sharePct") {
      data.sharePct = row.sharePct;
      data.absoluteTco2e = null;
    } else {
      data.absoluteTco2e = row.absoluteTco2e;
      data.sharePct = null;
    }

    if (row.reportedCurrentTco2e === null || row.reportedCurrentTco2e === undefined) {
      data.reportedCurrentTco2e = null;
    } else {
      data.reportedCurrentTco2e = row.reportedCurrentTco2e;
    }

    return data;
  });
}

export type CascadeWriteValidation =
  | { ok: true; data: CascadedTargetWriteInput }
  | { ok: false; error: string; details?: string[] };

export function parseCascadeWriteBody(
  body: Record<string, unknown>,
): CascadeWriteValidation {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { ok: false, error: "name is required" };

  const baselineYear = Number(body.baselineYear);
  const targetYear = Number(body.targetYear);
  if (!Number.isInteger(baselineYear) || baselineYear < 1990 || baselineYear > 2100) {
    return { ok: false, error: "baselineYear must be an integer year 1990–2100" };
  }
  if (!Number.isInteger(targetYear) || targetYear < 1990 || targetYear > 2100) {
    return { ok: false, error: "targetYear must be an integer year 1990–2100" };
  }
  if (targetYear <= baselineYear) {
    return { ok: false, error: "targetYear must be after baselineYear" };
  }

  const orgBaselineTco2e = Number(body.orgBaselineTco2e);
  const orgTargetTco2e = Number(body.orgTargetTco2e);
  if (!(orgBaselineTco2e >= 0) || !Number.isFinite(orgBaselineTco2e)) {
    return { ok: false, error: "orgBaselineTco2e must be a finite number ≥ 0" };
  }
  if (!(orgTargetTco2e >= 0) || !Number.isFinite(orgTargetTco2e)) {
    return { ok: false, error: "orgTargetTco2e must be a finite number ≥ 0" };
  }

  let status: CascadeStatus = "draft";
  if (body.status !== undefined) {
    if (!isCascadeStatus(body.status)) {
      return { ok: false, error: "status must be draft, active, or archived" };
    }
    status = body.status;
  }

  const sbtiTargetId =
    body.sbtiTargetId === undefined ||
    body.sbtiTargetId === null ||
    body.sbtiTargetId === ""
      ? null
      : typeof body.sbtiTargetId === "string"
        ? body.sbtiTargetId.trim()
        : null;
  if (
    body.sbtiTargetId !== undefined &&
    body.sbtiTargetId !== null &&
    body.sbtiTargetId !== "" &&
    !sbtiTargetId
  ) {
    return { ok: false, error: "sbtiTargetId must be a string or null" };
  }

  if (!Array.isArray(body.allocations)) {
    return { ok: false, error: "allocations must be an array" };
  }

  const allocations: CascadedTargetWriteInput["allocations"] = [];
  for (let i = 0; i < body.allocations.length; i++) {
    const row = body.allocations[i];
    if (!row || typeof row !== "object") {
      return { ok: false, error: `allocations[${i}] must be an object` };
    }
    const r = row as Record<string, unknown>;
    const facilityId = typeof r.facilityId === "string" ? r.facilityId.trim() : "";
    if (!facilityId) {
      return { ok: false, error: `allocations[${i}].facilityId is required` };
    }
    if (!isAllocationMode(r.mode)) {
      return {
        ok: false,
        error: `allocations[${i}].mode must be sharePct or absolute`,
      };
    }

    const ownerId =
      r.ownerId === undefined || r.ownerId === null || r.ownerId === ""
        ? null
        : typeof r.ownerId === "string"
          ? r.ownerId.trim()
          : null;
    if (r.ownerId !== undefined && r.ownerId !== null && r.ownerId !== "" && !ownerId) {
      return { ok: false, error: `allocations[${i}].ownerId must be a string or null` };
    }

    let sharePct: number | null = null;
    let absoluteTco2e: number | null = null;
    if (r.mode === "sharePct") {
      sharePct = optionalNumber(r.sharePct);
      if (sharePct === null) {
        return { ok: false, error: `allocations[${i}].sharePct is required` };
      }
    } else {
      absoluteTco2e = optionalNumber(r.absoluteTco2e);
      if (absoluteTco2e === null) {
        return {
          ok: false,
          error: `allocations[${i}].absoluteTco2e is required`,
        };
      }
    }

    let reportedCurrentTco2e: number | null = null;
    if (
      r.reportedCurrentTco2e !== undefined &&
      r.reportedCurrentTco2e !== null &&
      r.reportedCurrentTco2e !== ""
    ) {
      reportedCurrentTco2e = optionalNumber(r.reportedCurrentTco2e);
      if (reportedCurrentTco2e === null || reportedCurrentTco2e < 0) {
        return {
          ok: false,
          error: `allocations[${i}].reportedCurrentTco2e must be a finite number ≥ 0 or null`,
        };
      }
    }

    allocations.push({
      id: typeof r.id === "string" ? r.id : undefined,
      facilityId,
      ownerId,
      mode: r.mode,
      sharePct,
      absoluteTco2e,
      reportedCurrentTco2e,
      notes: optionalString(r.notes),
    });
  }

  const requireExactShares = body.requireExactShares === true;
  const shareCheck = validateAllocationShares(toAllocationInputs(allocations), {
    orgTargetTco2e,
    requireExact100: requireExactShares,
  });
  if (!shareCheck.ok) {
    return {
      ok: false,
      error: shareCheck.errors[0]?.message ?? "Invalid allocations",
      details: shareCheck.errors.map((e) => e.message),
    };
  }

  return {
    ok: true,
    data: {
      name,
      sbtiTargetId,
      baselineYear,
      targetYear,
      orgBaselineTco2e,
      orgTargetTco2e,
      requireExactShares,
      status,
      notes: optionalString(body.notes),
      allocations,
    },
  };
}

export async function assertCascadeFacilitiesInOrg(
  payload: Payload,
  organisationId: string,
  facilityIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const unique = [...new Set(facilityIds)];
  for (const id of unique) {
    const facility = await getOrgFacility(payload, organisationId, id);
    if (!facility) {
      return {
        ok: false,
        error: `facilityId ${id} not found in this organisation`,
      };
    }
  }
  return { ok: true };
}

export async function assertCascadeOwnersInOrg(
  payload: Payload,
  organisationId: string,
  ownerIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const unique = [...new Set(ownerIds.filter(Boolean))];
  for (const userId of unique) {
    const membership = await payload.find({
      collection: "memberships",
      where: {
        and: [
          { organisation: { equals: organisationId } },
          { user: { equals: userId } },
          { status: { equals: "active" } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    if (membership.docs.length === 0) {
      return {
        ok: false,
        error: `ownerId ${userId} is not an active member of this organisation`,
      };
    }
  }
  return { ok: true };
}

export async function assertSbtiTargetInOrg(
  payload: Payload,
  organisationId: string,
  sbtiTargetId: string | null | undefined,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!sbtiTargetId) return { ok: true };
  const targets = await listOrgSbtiTargets(payload, organisationId);
  if (!targets.some((t) => t.id === sbtiTargetId)) {
    return {
      ok: false,
      error: "sbtiTargetId must reference an SBTi target in this organisation",
    };
  }
  return { ok: true };
}

export async function listOrgCascadedTargets(
  payload: Payload,
  organisationId: string,
): Promise<CascadedTargetDto[]> {
  const result = await payload.find({
    collection: CASCADED_TARGETS_SLUG,
    where: { organisation: { equals: organisationId } },
    sort: "-updatedAt",
    limit: 100,
    depth: 0,
    overrideAccess: true,
  });
  return result.docs.map((d) => docToCascadedTarget(d));
}

export async function getOrgCascadedTarget(
  payload: Payload,
  organisationId: string,
  id: string,
): Promise<CascadedTargetDto | null> {
  try {
    const doc = await payload.findByID({
      collection: CASCADED_TARGETS_SLUG,
      id,
      depth: 0,
      overrideAccess: true,
    });
    const dto = docToCascadedTarget(doc);
    if (dto.organisationId !== organisationId) return null;
    return dto;
  } catch {
    return null;
  }
}

export async function createCascadedTarget(
  payload: Payload,
  organisationId: string,
  input: CascadedTargetWriteInput,
): Promise<CascadedTargetDto> {
  const created = await payload.create({
    collection: CASCADED_TARGETS_SLUG,
    data: {
      organisation: organisationId,
      name: input.name,
      sbtiTarget: input.sbtiTargetId ?? undefined,
      baselineYear: input.baselineYear,
      targetYear: input.targetYear,
      orgBaselineTco2e: input.orgBaselineTco2e,
      orgTargetTco2e: input.orgTargetTco2e,
      requireExactShares: input.requireExactShares === true,
      status: input.status ?? "draft",
      notes: input.notes ?? undefined,
      allocations: toPayloadAllocations(input.allocations),
    },
    overrideAccess: true,
  });
  return docToCascadedTarget(created);
}

export async function updateCascadedTarget(
  payload: Payload,
  organisationId: string,
  id: string,
  input: CascadedTargetWriteInput,
): Promise<CascadedTargetDto | null> {
  const existing = await getOrgCascadedTarget(payload, organisationId, id);
  if (!existing) return null;

  const updated = await payload.update({
    collection: CASCADED_TARGETS_SLUG,
    id,
    data: {
      name: input.name,
      sbtiTarget: input.sbtiTargetId ?? null,
      baselineYear: input.baselineYear,
      targetYear: input.targetYear,
      orgBaselineTco2e: input.orgBaselineTco2e,
      orgTargetTco2e: input.orgTargetTco2e,
      requireExactShares: input.requireExactShares === true,
      status: input.status ?? existing.status,
      notes: input.notes ?? null,
      allocations: toPayloadAllocations(input.allocations),
    },
    overrideAccess: true,
  });
  return docToCascadedTarget(updated);
}

export async function deleteCascadedTarget(
  payload: Payload,
  organisationId: string,
  id: string,
): Promise<boolean> {
  const existing = await getOrgCascadedTarget(payload, organisationId, id);
  if (!existing) return false;
  await payload.delete({
    collection: CASCADED_TARGETS_SLUG,
    id,
    overrideAccess: true,
  });
  return true;
}

/**
 * Build progress roll-up. Uses reportedCurrentTco2e when set;
 * otherwise quality is missing (never silent zero).
 */
export function buildCascadeProgress(target: CascadedTargetDto): CascadeProgressRollup {
  return rollupChildProgress({
    orgBaselineTco2e: target.orgBaselineTco2e,
    orgTargetTco2e: target.orgTargetTco2e,
    children: target.allocations.map((a) => ({
      allocationId: a.id,
      facilityId: a.facilityId,
      ownerId: a.ownerId,
      targetTco2e: a.resolvedTargetTco2e ?? 0,
      baselineTco2e: a.resolvedBaselineTco2e ?? 0,
      currentTco2e: a.reportedCurrentTco2e,
    })),
  });
}
