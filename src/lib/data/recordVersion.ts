import type { Payload } from "payload";

import { writeAuditLog } from "@/lib/audit/write";
import { DATAPOINT_VERSIONS_SLUG } from "@/collections/DatapointVersions";

import {
  auditActionForChange,
  diffDatapointSnapshots,
  restoreDataFromSnapshot,
  snapshotDatapoint,
  snapshotsEqual,
  type DatapointSnapshot,
  type DatapointVersionChangeType,
} from "./versioning";

export type DatapointVersionContext = {
  skipDatapointVersion?: boolean;
  changeType?: DatapointVersionChangeType;
  reason?: string | null;
  changedBy?: string | null;
};

export type RecordVersionInput = {
  organisationId: string;
  datapointId: string;
  changeType: DatapointVersionChangeType;
  previousDoc?: Record<string, unknown> | null;
  nextDoc?: Record<string, unknown> | null;
  oldValue?: DatapointSnapshot | null;
  newValue?: DatapointSnapshot | null;
  changedBy?: string | null;
  reason?: string | null;
};

export type DatapointVersionRow = {
  id: string;
  versionNumber: number;
  changeType: DatapointVersionChangeType;
  oldValue: DatapointSnapshot | null;
  newValue: DatapointSnapshot | null;
  changedBy: string | null;
  changedAt: string;
  reason: string | null;
  diffs: ReturnType<typeof diffDatapointSnapshots>;
};

async function nextVersionNumber(payload: Payload, datapointId: string): Promise<number> {
  const existing = await payload.find({
    collection: DATAPOINT_VERSIONS_SLUG,
    where: { datapointId: { equals: datapointId } },
    sort: "-versionNumber",
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const last = existing.docs[0] as { versionNumber?: number } | undefined;
  return (typeof last?.versionNumber === "number" ? last.versionNumber : 0) + 1;
}

/**
 * Append a datapoint version row + audit event.
 * No-ops when old/new snapshots are equal (except delete/create which always record).
 */
export async function recordDatapointVersion(
  payload: Payload,
  input: RecordVersionInput,
): Promise<{ id: string; versionNumber: number } | null> {
  const oldValue =
    input.oldValue !== undefined
      ? input.oldValue
      : snapshotDatapoint(input.previousDoc ?? null);
  const newValue =
    input.newValue !== undefined
      ? input.newValue
      : snapshotDatapoint(input.nextDoc ?? null);

  if (input.changeType === "update" && snapshotsEqual(oldValue, newValue)) {
    return null;
  }

  const versionNumber = await nextVersionNumber(payload, input.datapointId);
  const changedAt = new Date().toISOString();
  const changedBy = input.changedBy ?? null;
  const reason = input.reason?.trim() ? input.reason.trim() : null;

  const created = await (
    payload.create as (args: {
      collection: typeof DATAPOINT_VERSIONS_SLUG;
      data: Record<string, unknown>;
      overrideAccess: true;
    }) => Promise<{ id: string }>
  )({
    collection: DATAPOINT_VERSIONS_SLUG,
    data: {
      organisation: input.organisationId,
      datapoint: input.changeType === "delete" ? undefined : input.datapointId,
      datapointId: input.datapointId,
      versionNumber,
      changeType: input.changeType,
      oldValue,
      newValue,
      changedBy: changedBy ?? undefined,
      changedAt,
      reason: reason ?? undefined,
    },
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: input.organisationId,
    actorId: changedBy && !changedBy.includes(":") ? changedBy : null,
    action: auditActionForChange(input.changeType),
    entityType: "datapoints",
    entityId: input.datapointId,
    before: oldValue,
    after: {
      ...(newValue ?? {}),
      versionNumber,
      changeType: input.changeType,
      ...(reason ? { reason } : {}),
      ...(changedBy ? { changedBy } : {}),
    },
  });

  return { id: created.id, versionNumber };
}

export async function listDatapointVersions(
  payload: Payload,
  args: { organisationId: string; datapointId: string; limit?: number },
): Promise<DatapointVersionRow[]> {
  const result = await payload.find({
    collection: DATAPOINT_VERSIONS_SLUG,
    where: {
      and: [
        { organisation: { equals: args.organisationId } },
        { datapointId: { equals: args.datapointId } },
      ],
    },
    sort: "-versionNumber",
    limit: args.limit ?? 100,
    depth: 0,
    overrideAccess: true,
  });

  return result.docs.map((doc) => {
    const oldValue = (doc.oldValue as DatapointSnapshot | null) ?? null;
    const newValue = (doc.newValue as DatapointSnapshot | null) ?? null;
    return {
      id: String(doc.id),
      versionNumber: Number(doc.versionNumber),
      changeType: doc.changeType as DatapointVersionChangeType,
      oldValue,
      newValue,
      changedBy: typeof doc.changedBy === "string" ? doc.changedBy : null,
      changedAt: String(doc.changedAt ?? doc.createdAt),
      reason: typeof doc.reason === "string" ? doc.reason : null,
      diffs: diffDatapointSnapshots(oldValue, newValue),
    };
  });
}

/**
 * Restore a datapoint to the state captured in a version's newValue
 * (or oldValue when rolling back a delete version).
 */
export async function rollbackDatapoint(
  payload: Payload,
  args: {
    organisationId: string;
    datapointId: string;
    versionId: string;
    actorId: string;
    reason?: string | null;
  },
): Promise<{ id: string; versionNumber: number }> {
  const version = await payload.findByID({
    collection: DATAPOINT_VERSIONS_SLUG,
    id: args.versionId,
    depth: 0,
    overrideAccess: true,
  });

  const orgId =
    typeof version.organisation === "string"
      ? version.organisation
      : version.organisation &&
          typeof version.organisation === "object" &&
          "id" in version.organisation
        ? String(version.organisation.id)
        : null;
  if (orgId !== args.organisationId || String(version.datapointId) !== args.datapointId) {
    throw new Error("Version not found for this datapoint.");
  }

  const targetSnap =
    (version.newValue as DatapointSnapshot | null) ??
    (version.oldValue as DatapointSnapshot | null);
  if (!targetSnap) {
    throw new Error("Version has no restorable snapshot.");
  }

  const current = await payload.findByID({
    collection: "datapoints",
    id: args.datapointId,
    depth: 0,
    overrideAccess: true,
  });
  const currentOrg =
    typeof current.organisation === "string"
      ? current.organisation
      : current.organisation?.id;
  if (currentOrg !== args.organisationId) {
    throw new Error("Datapoint not found for organisation.");
  }

  const previous = snapshotDatapoint(current as unknown as Record<string, unknown>);
  const data = restoreDataFromSnapshot(targetSnap);

  const updated = await (
    payload.update as (a: {
      collection: "datapoints";
      id: string;
      data: Record<string, unknown>;
      overrideAccess: true;
      context: DatapointVersionContext;
    }) => Promise<{ id: string }>
  )({
    collection: "datapoints",
    id: args.datapointId,
    data: {
      ...data,
      enteredBy: args.actorId,
      enteredAt: new Date().toISOString(),
    },
    overrideAccess: true,
    context: {
      changeType: "rollback",
      reason: args.reason ?? `Rollback to v${version.versionNumber}`,
      changedBy: args.actorId,
    },
  });

  // Hook records the rollback version; return latest version number for the caller.
  const versions = await listDatapointVersions(payload, {
    organisationId: args.organisationId,
    datapointId: args.datapointId,
    limit: 1,
  });
  const latest = versions[0];

  if (!latest) {
    // Fallback if hook skipped (no-op restore)
    const recorded = await recordDatapointVersion(payload, {
      organisationId: args.organisationId,
      datapointId: args.datapointId,
      changeType: "rollback",
      oldValue: previous,
      newValue: targetSnap,
      changedBy: args.actorId,
      reason: args.reason ?? `Rollback to v${version.versionNumber}`,
    });
    return {
      id: updated.id,
      versionNumber: recorded?.versionNumber ?? Number(version.versionNumber),
    };
  }

  return { id: updated.id, versionNumber: latest.versionNumber };
}

export function orgIdFromDoc(doc: Record<string, unknown>): string | null {
  const org = doc.organisation;
  if (!org) return null;
  if (typeof org === "string") return org;
  if (typeof org === "object" && org !== null && "id" in org) {
    return String((org as { id: string }).id);
  }
  return null;
}

export function actorFromDoc(
  doc: Record<string, unknown>,
  fallback?: string | null,
): string | null {
  if (fallback) return fallback;
  const enteredBy = doc.enteredBy;
  if (typeof enteredBy === "string") return enteredBy;
  if (enteredBy && typeof enteredBy === "object" && "id" in enteredBy) {
    return String((enteredBy as { id: string }).id);
  }
  return null;
}
