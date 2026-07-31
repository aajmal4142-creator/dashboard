import type { CollectionSlug, Payload, Where } from "payload";

import {
  deletedSnapshotItem,
  operationSupportsUndo,
  parseBulkSnapshot,
  planRedoApply,
  planUndoApply,
  snapshotItemsFromRecords,
  type BulkSnapshotItem,
} from "@/lib/bulk/snapshot";

const RESOURCE_COLLECTIONS = new Set<string>(["suppliers", "datapoints", "users"]);

function asCollection(resourceType: string): CollectionSlug | null {
  if (!RESOURCE_COLLECTIONS.has(resourceType)) return null;
  return resourceType as CollectionSlug;
}

export async function captureBeforeSnapshot(
  payload: Payload,
  resourceType: string,
  itemIds: string[],
  organisationId: string,
): Promise<BulkSnapshotItem[]> {
  const collection = asCollection(resourceType);
  if (!collection) return [];

  const where: Where =
    resourceType === "users"
      ? { id: { in: itemIds } }
      : {
          and: [{ id: { in: itemIds } }, { organisation: { equals: organisationId } }],
        };

  const result = await payload.find({
    collection,
    where,
    limit: Math.min(itemIds.length, 500),
    depth: 0,
    overrideAccess: true,
  });

  return snapshotItemsFromRecords(
    result.docs as unknown as Array<Record<string, unknown>>,
  );
}

export async function executeBulkMutation(
  payload: Payload,
  input: {
    operationType: string;
    resourceType: string;
    itemIds: string[];
    organisationId: string;
    changes: unknown;
    beforeSnapshot: BulkSnapshotItem[];
  },
): Promise<{ afterSnapshot: BulkSnapshotItem[]; errorMessage?: string }> {
  const collection = asCollection(input.resourceType);
  if (!collection) {
    return { afterSnapshot: [], errorMessage: "Unsupported resourceType" };
  }

  if (!operationSupportsUndo(input.operationType)) {
    return { afterSnapshot: [] };
  }

  try {
    if (input.operationType === "delete") {
      await Promise.all(
        input.itemIds.map((id) =>
          payload.delete({
            collection,
            id,
            overrideAccess: true,
          }),
        ),
      );
      return {
        afterSnapshot: input.beforeSnapshot.map((item) =>
          deletedSnapshotItem(item.id, item.label),
        ),
      };
    }

    const changes =
      input.changes && typeof input.changes === "object" && !Array.isArray(input.changes)
        ? (input.changes as Record<string, unknown>)
        : {};

    const patch: Record<string, unknown> = {};
    if (input.operationType === "update-status") {
      if (typeof changes.status === "string") patch.requestStatus = changes.status;
      if (typeof changes.requestStatus === "string") {
        patch.requestStatus = changes.requestStatus;
      }
      if (typeof changes.approvalState === "string") {
        patch.approvalState = changes.approvalState;
      }
    }
    if (input.operationType === "assign") {
      if (changes.assignedTo != null) patch.assignedTo = changes.assignedTo;
    }

    if (Object.keys(patch).length === 0) {
      return {
        afterSnapshot: input.beforeSnapshot,
        errorMessage: "No applicable changes for operation",
      };
    }

    await Promise.all(
      input.itemIds.map((id) =>
        payload.update({
          collection,
          id,
          data: patch,
          overrideAccess: true,
        }),
      ),
    );

    const after = await captureBeforeSnapshot(
      payload,
      input.resourceType,
      input.itemIds,
      input.organisationId,
    );
    return { afterSnapshot: after };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bulk mutation failed";
    return { afterSnapshot: [], errorMessage: message };
  }
}

export async function applySnapshotPlan(
  payload: Payload,
  resourceType: string,
  plan: ReturnType<typeof planUndoApply>,
): Promise<void> {
  const collection = asCollection(resourceType);
  if (!collection) throw new Error("Unsupported resourceType");

  await Promise.all(
    plan.deletes.map((id) => payload.delete({ collection, id, overrideAccess: true })),
  );

  await Promise.all(
    plan.updates.map((item) =>
      payload.update({
        collection,
        id: item.id,
        data: item.data,
        overrideAccess: true,
      }),
    ),
  );

  await Promise.all(
    plan.creates.map((item) =>
      payload.create({
        collection,
        data: { ...item.data, id: item.id },
        overrideAccess: true,
      }),
    ),
  );
}

export function resolveClientSnapshot(
  clientSnapshot: unknown,
  serverSnapshot: BulkSnapshotItem[],
): BulkSnapshotItem[] {
  const parsed = parseBulkSnapshot(clientSnapshot);
  if (parsed && parsed.length > 0) return parsed;
  return serverSnapshot;
}

export { planUndoApply, planRedoApply, parseBulkSnapshot };
