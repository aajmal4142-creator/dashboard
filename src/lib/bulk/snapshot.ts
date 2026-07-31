/** Pure bulk-operation snapshot helpers — zero I/O. */

export type BulkSnapshotItem = {
  id: string;
  data: Record<string, unknown>;
  label?: string;
};

export type BulkOperationType =
  "delete" | "update-status" | "assign" | "email-reminder" | "export" | "update";

export type BulkResourceType = "suppliers" | "datapoints" | "users";

export type SnapshotApplyPlan = {
  updates: Array<{ id: string; data: Record<string, unknown> }>;
  creates: Array<{ id: string; data: Record<string, unknown> }>;
  deletes: string[];
};

export type UndoPreview = {
  operationType: string;
  resourceType: string;
  itemCount: number;
  canUndo: boolean;
  sampleLabels: string[];
  changedFields: string[];
  description: string;
};

const META_KEYS = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "collection",
  "sizes",
  "_status",
]);

const DELETED_MARKER = "__deleted";

export function isDeletedMarker(item: BulkSnapshotItem): boolean {
  return item.data[DELETED_MARKER] === true;
}

export function deletedSnapshotItem(id: string, label?: string): BulkSnapshotItem {
  return {
    id,
    label,
    data: { [DELETED_MARKER]: true },
  };
}

function relationId(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    const id = (value as { id: unknown }).id;
    return id == null ? null : String(id);
  }
  return value;
}

/** Flatten a Payload-like doc into snapshot data (relations → ids). */
export function sanitizeDocForSnapshot(
  doc: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (META_KEYS.has(key)) continue;
    if (Array.isArray(value)) {
      out[key] = value.map((v) =>
        typeof v === "object" && v !== null ? relationId(v) : v,
      );
      continue;
    }
    if (typeof value === "object" && value !== null) {
      out[key] = relationId(value);
      continue;
    }
    out[key] = value;
  }
  return out;
}

function labelFromDoc(
  doc: Record<string, unknown>,
  labelField?: string,
): string | undefined {
  if (labelField && typeof doc[labelField] === "string") {
    return doc[labelField] as string;
  }
  if (typeof doc.name === "string") return doc.name;
  if (typeof doc.metricKey === "string") return doc.metricKey;
  if (typeof doc.email === "string") return doc.email;
  return undefined;
}

export function snapshotItemsFromRecords(
  records: Array<Record<string, unknown>>,
  options?: { labelField?: string },
): BulkSnapshotItem[] {
  const items: BulkSnapshotItem[] = [];
  for (const doc of records) {
    const id = doc.id == null ? "" : String(doc.id);
    if (!id) continue;
    items.push({
      id,
      data: sanitizeDocForSnapshot(doc),
      label: labelFromDoc(doc, options?.labelField),
    });
  }
  return items;
}

export function isBulkSnapshotItem(value: unknown): value is BulkSnapshotItem {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    row.id.length > 0 &&
    typeof row.data === "object" &&
    row.data !== null &&
    !Array.isArray(row.data)
  );
}

/** Parse JSON field into snapshot items; empty array / invalid → null. */
export function parseBulkSnapshot(raw: unknown): BulkSnapshotItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const items: BulkSnapshotItem[] = [];
  for (const entry of raw) {
    if (!isBulkSnapshotItem(entry)) return null;
    items.push({
      id: entry.id,
      data: { ...entry.data },
      label: typeof entry.label === "string" ? entry.label : undefined,
    });
  }
  return items;
}

/** Payload update/create body from a snapshot item (no meta, no delete marker). */
export function restorePayloadFromSnapshot(
  item: BulkSnapshotItem,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item.data)) {
    if (key === DELETED_MARKER) continue;
    if (META_KEYS.has(key)) continue;
    data[key] = value;
  }
  return data;
}

export function emptyApplyPlan(): SnapshotApplyPlan {
  return { updates: [], creates: [], deletes: [] };
}

/**
 * Undo applies the pre-operation snapshot.
 * delete → recreate; update/assign → restore fields; non-mutating → empty.
 */
export function planUndoApply(
  operationType: string,
  beforeSnapshot: BulkSnapshotItem[],
): SnapshotApplyPlan {
  if (operationType === "email-reminder" || operationType === "export") {
    return emptyApplyPlan();
  }

  if (operationType === "delete") {
    return {
      updates: [],
      deletes: [],
      creates: beforeSnapshot
        .filter((item) => !isDeletedMarker(item))
        .map((item) => ({
          id: item.id,
          data: restorePayloadFromSnapshot(item),
        })),
    };
  }

  // update-status | assign | update | unknown mutators
  return {
    creates: [],
    deletes: [],
    updates: beforeSnapshot
      .filter((item) => !isDeletedMarker(item))
      .map((item) => ({
        id: item.id,
        data: restorePayloadFromSnapshot(item),
      })),
  };
}

/**
 * Redo re-applies the post-operation snapshot (or re-deletes).
 */
export function planRedoApply(
  operationType: string,
  beforeSnapshot: BulkSnapshotItem[],
  afterSnapshot: BulkSnapshotItem[],
): SnapshotApplyPlan {
  if (operationType === "email-reminder" || operationType === "export") {
    return emptyApplyPlan();
  }

  if (operationType === "delete") {
    return {
      updates: [],
      creates: [],
      deletes: beforeSnapshot.map((item) => item.id),
    };
  }

  return {
    creates: [],
    deletes: [],
    updates: afterSnapshot
      .filter((item) => !isDeletedMarker(item))
      .map((item) => ({
        id: item.id,
        data: restorePayloadFromSnapshot(item),
      })),
  };
}

export function operationSupportsUndo(operationType: string): boolean {
  return (
    operationType === "delete" ||
    operationType === "update-status" ||
    operationType === "assign" ||
    operationType === "update"
  );
}

function changedFieldNames(
  before: BulkSnapshotItem[],
  after: BulkSnapshotItem[] | null,
): string[] {
  if (!after || after.length === 0) {
    if (before.length === 0) return [];
    return Object.keys(before[0].data)
      .filter((k) => k !== DELETED_MARKER)
      .slice(0, 8);
  }
  const fields = new Set<string>();
  const afterById = new Map(after.map((a) => [a.id, a]));
  for (const b of before) {
    const a = afterById.get(b.id);
    if (!a || isDeletedMarker(a)) {
      fields.add("deleted");
      continue;
    }
    for (const key of Object.keys({ ...b.data, ...a.data })) {
      if (key === DELETED_MARKER) continue;
      if (JSON.stringify(b.data[key]) !== JSON.stringify(a.data[key])) {
        fields.add(key);
      }
    }
  }
  return Array.from(fields).slice(0, 12);
}

export function buildUndoPreview(input: {
  operationType: string;
  resourceType: string;
  beforeSnapshot: BulkSnapshotItem[] | null;
  afterSnapshot?: BulkSnapshotItem[] | null;
  canUndo: boolean;
  undoneAt?: string | null;
}): UndoPreview {
  const items = input.beforeSnapshot ?? [];
  const itemCount = items.length;
  const canUndo =
    input.canUndo &&
    !input.undoneAt &&
    operationSupportsUndo(input.operationType) &&
    itemCount > 0;

  const sampleLabels = items
    .map((i) => i.label || i.id)
    .filter(Boolean)
    .slice(0, 5);

  const changedFields = changedFieldNames(items, input.afterSnapshot ?? null);

  let description: string;
  if (!canUndo) {
    description =
      itemCount === 0
        ? "No snapshot available for undo."
        : input.undoneAt
          ? "This operation was already undone."
          : "This operation cannot be undone.";
  } else if (input.operationType === "delete") {
    description = `Restore ${itemCount} deleted ${input.resourceType}.`;
  } else {
    const fieldPart =
      changedFields.length > 0 ? ` Fields: ${changedFields.join(", ")}.` : "";
    description = `Revert ${itemCount} ${input.resourceType} to their pre-operation state.${fieldPart}`;
  }

  return {
    operationType: input.operationType,
    resourceType: input.resourceType,
    itemCount,
    canUndo,
    sampleLabels,
    changedFields,
    description,
  };
}

export function buildRedoPreview(input: {
  operationType: string;
  resourceType: string;
  beforeSnapshot: BulkSnapshotItem[] | null;
  afterSnapshot: BulkSnapshotItem[] | null;
  canRedo: boolean;
}): UndoPreview {
  const before = input.beforeSnapshot ?? [];
  const after = input.afterSnapshot ?? [];
  const itemCount = Math.max(before.length, after.length);
  const canRedo =
    input.canRedo &&
    operationSupportsUndo(input.operationType) &&
    itemCount > 0 &&
    (input.operationType === "delete" || after.length > 0);

  const sampleLabels = (after.length > 0 ? after : before)
    .map((i) => i.label || i.id)
    .filter(Boolean)
    .slice(0, 5);

  const changedFields = changedFieldNames(before, after);

  let description: string;
  if (!canRedo) {
    description = "Redo is not available for this operation.";
  } else if (input.operationType === "delete") {
    description = `Re-delete ${itemCount} ${input.resourceType}.`;
  } else {
    description = `Re-apply the bulk change to ${itemCount} ${input.resourceType}.`;
  }

  return {
    operationType: input.operationType,
    resourceType: input.resourceType,
    itemCount,
    canUndo: canRedo,
    sampleLabels,
    changedFields,
    description,
  };
}
