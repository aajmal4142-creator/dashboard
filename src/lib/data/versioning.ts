/** Fields captured in each datapoint version snapshot. */
export const DATAPOINT_VERSION_FIELDS = [
  "metricKey",
  "value",
  "unit",
  "quality",
  "source",
  "provenance",
  "approvalState",
  "approvalReason",
  "note",
  "assignedTo",
  "factorId",
  "supplierKey",
  "supplier",
] as const;

export type DatapointVersionField = (typeof DATAPOINT_VERSION_FIELDS)[number];

export type DatapointVersionChangeType = "create" | "update" | "delete" | "rollback";

export type DatapointSnapshot = {
  metricKey: string | null;
  value: number | null;
  unit: string | null;
  quality: string | null;
  source: string | null;
  provenance: string | null;
  approvalState: string | null;
  approvalReason: string | null;
  note: string | null;
  assignedTo: string | null;
  factorId: string | null;
  supplierKey: string | null;
  supplier: string | null;
};

export type DatapointFieldDiff = {
  field: DatapointVersionField;
  oldValue: string | number | null;
  newValue: string | number | null;
};

export type VersionCompareField = {
  field: DatapointVersionField;
  a: string | number | null;
  b: string | number | null;
  changed: boolean;
};

export type VersionCompareResult = {
  fields: VersionCompareField[];
  /** Map form for API consumers: `{ value: { a, b, changed }, ... }` */
  fieldMap: Record<
    DatapointVersionField,
    { a: string | number | null; b: string | number | null; changed: boolean }
  >;
  changedCount: number;
  identical: boolean;
};

/** Prefer post-change snapshot; fall back to pre-change (e.g. delete versions). */
export function effectiveVersionSnapshot(
  oldValue: DatapointSnapshot | null | undefined,
  newValue: DatapointSnapshot | null | undefined,
): DatapointSnapshot | null {
  if (newValue) return newValue;
  if (oldValue) return oldValue;
  return null;
}

function relationId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

function asNumberOrNull(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function asStringOrNull(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return String(value);
}

/** Extract a stable field snapshot from a datapoint document-like object. */
export function snapshotDatapoint(
  doc: Record<string, unknown> | null | undefined,
): DatapointSnapshot | null {
  if (!doc) return null;
  return {
    metricKey: asStringOrNull(doc.metricKey),
    value: asNumberOrNull(doc.value),
    unit: asStringOrNull(doc.unit),
    quality: asStringOrNull(doc.quality),
    source: asStringOrNull(doc.source),
    provenance: asStringOrNull(doc.provenance),
    approvalState: asStringOrNull(doc.approvalState),
    approvalReason: asStringOrNull(doc.approvalReason),
    note: asStringOrNull(doc.note),
    assignedTo: relationId(doc.assignedTo),
    factorId: asStringOrNull(doc.factorId),
    supplierKey: asStringOrNull(doc.supplierKey),
    supplier: relationId(doc.supplier),
  };
}

function fieldDisplay(value: string | number | null): string | number | null {
  return value;
}

/** Field-level diff between two snapshots. Null sides treated as empty snapshot. */
export function diffDatapointSnapshots(
  oldSnap: DatapointSnapshot | null,
  newSnap: DatapointSnapshot | null,
): DatapointFieldDiff[] {
  const diffs: DatapointFieldDiff[] = [];
  for (const field of DATAPOINT_VERSION_FIELDS) {
    const before = oldSnap ? fieldDisplay(oldSnap[field]) : null;
    const after = newSnap ? fieldDisplay(newSnap[field]) : null;
    if (before === after) continue;
    diffs.push({ field, oldValue: before, newValue: after });
  }
  return diffs;
}

export function snapshotsEqual(
  a: DatapointSnapshot | null,
  b: DatapointSnapshot | null,
): boolean {
  return diffDatapointSnapshots(a, b).length === 0;
}

/**
 * Side-by-side A/B field comparison of two version snapshots.
 * Includes unchanged fields so the UI can render a full two-column view.
 */
export function compareDatapointSnapshots(
  snapA: DatapointSnapshot | null,
  snapB: DatapointSnapshot | null,
): VersionCompareResult {
  const fields: VersionCompareField[] = [];
  const fieldMap = {} as VersionCompareResult["fieldMap"];
  let changedCount = 0;

  for (const field of DATAPOINT_VERSION_FIELDS) {
    const a = snapA ? fieldDisplay(snapA[field]) : null;
    const b = snapB ? fieldDisplay(snapB[field]) : null;
    const changed = a !== b;
    if (changed) changedCount += 1;
    const entry = { field, a, b, changed };
    fields.push(entry);
    fieldMap[field] = { a, b, changed };
  }

  return {
    fields,
    fieldMap,
    changedCount,
    identical: changedCount === 0,
  };
}

/** Build Payload update data to restore a snapshot onto a live datapoint. */
export function restoreDataFromSnapshot(
  snap: DatapointSnapshot,
): Record<string, unknown> {
  return {
    metricKey: snap.metricKey ?? undefined,
    value: snap.value ?? undefined,
    unit: snap.unit ?? undefined,
    quality: snap.quality ?? "missing",
    source: snap.source ?? "manual",
    provenance: snap.provenance ?? undefined,
    approvalState: snap.approvalState ?? "pending",
    approvalReason: snap.approvalReason ?? undefined,
    note: snap.note ?? undefined,
    assignedTo: snap.assignedTo ?? undefined,
    factorId: snap.factorId ?? undefined,
    supplierKey: snap.supplierKey ?? undefined,
    supplier: snap.supplier ?? undefined,
  };
}

export function auditActionForChange(changeType: DatapointVersionChangeType): string {
  if (changeType === "create") return "datapoint.created";
  if (changeType === "update") return "datapoint.updated";
  if (changeType === "delete") return "datapoint.deleted";
  return "datapoint.rolled_back";
}
