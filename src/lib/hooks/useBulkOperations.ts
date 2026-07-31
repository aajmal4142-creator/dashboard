import { useState, useCallback } from "react";
import { toast } from "sonner";

import { snapshotItemsFromRecords, type BulkSnapshotItem } from "@/lib/bulk/snapshot";

export type BulkOperationSummary = {
  id: string;
  operationType: string;
  resourceType: string;
  itemCount: number;
  status: "pending" | "processing" | "completed" | "failed";
  progressPercent: number;
  canUndo: boolean;
  canRedo?: boolean;
  createdAt: string;
  undoneAt?: string | null;
};

export type BulkOpPreview = {
  operationType: string;
  resourceType: string;
  itemCount: number;
  canUndo: boolean;
  sampleLabels: string[];
  changedFields: string[];
  description: string;
};

export type BulkOperationDetail = BulkOperationSummary & {
  errorMessage?: string | null;
  redoneAt?: string | null;
  undoPreview?: BulkOpPreview;
  redoPreview?: BulkOpPreview;
};

type UseBulkOperationsReturn = {
  operations: BulkOperationSummary[];
  loading: boolean;
  createBulkOp: (
    operationType: string,
    resourceType: string,
    itemIds: string[],
    changes?: unknown,
    items?: Array<Record<string, unknown>>,
  ) => Promise<BulkOperationSummary | null>;
  undoOperation: (operationId: string) => Promise<boolean>;
  redoOperation: (operationId: string) => Promise<boolean>;
  getOperation: (operationId: string) => Promise<BulkOperationDetail | null>;
  loadOperations: (status?: string) => Promise<void>;
  buildClientSnapshot: (items: Array<Record<string, unknown>>) => BulkSnapshotItem[];
};

export function useBulkOperations(): UseBulkOperationsReturn {
  const [operations, setOperations] = useState<BulkOperationSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const buildClientSnapshot = useCallback(
    (items: Array<Record<string, unknown>>) => snapshotItemsFromRecords(items),
    [],
  );

  const loadOperations = useCallback(async (status?: string) => {
    setLoading(true);
    try {
      const url = new URL("/api/app/bulk-operations", window.location.origin);
      if (status) url.searchParams.append("status", status);

      const response = await fetch(url);
      const data = (await response.json()) as {
        operations?: BulkOperationSummary[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load operations");
      }
      setOperations(data.operations || []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load operations";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createBulkOp = useCallback(
    async (
      operationType: string,
      resourceType: string,
      itemIds: string[],
      changes?: unknown,
      items?: Array<Record<string, unknown>>,
    ): Promise<BulkOperationSummary | null> => {
      try {
        const beforeSnapshot =
          items && items.length > 0
            ? snapshotItemsFromRecords(
                items.filter((row) => itemIds.includes(String(row.id))),
              )
            : undefined;

        const response = await fetch("/api/app/bulk-operations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operationType,
            resourceType,
            itemIds,
            changes,
            beforeSnapshot: beforeSnapshot ?? [],
          }),
        });

        const data = (await response.json().catch(() => ({}))) as {
          operation?: BulkOperationSummary;
          error?: string;
          code?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to create bulk operation");
        }

        const op = data.operation;
        if (!op) throw new Error("Failed to create bulk operation");
        setOperations((prev) => [op, ...prev]);
        return op;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create operation";
        toast.error(message);
        return null;
      }
    },
    [],
  );

  const undoOperation = useCallback(async (operationId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/app/bulk-operations/${operationId}/undo`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to undo operation");
      }

      setOperations((prev) =>
        prev.map((op) =>
          op.id === operationId
            ? { ...op, canUndo: false, canRedo: true, undoneAt: new Date().toISOString() }
            : op,
        ),
      );
      toast.success("Operation undone");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to undo operation";
      toast.error(message);
      return false;
    }
  }, []);

  const redoOperation = useCallback(async (operationId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/app/bulk-operations/${operationId}/redo`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to redo operation");
      }

      setOperations((prev) =>
        prev.map((op) =>
          op.id === operationId
            ? { ...op, canUndo: true, canRedo: false, undoneAt: null }
            : op,
        ),
      );
      toast.success("Operation redone");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to redo operation";
      toast.error(message);
      return false;
    }
  }, []);

  const getOperation = useCallback(
    async (operationId: string): Promise<BulkOperationDetail | null> => {
      try {
        const response = await fetch(`/api/app/bulk-operations/${operationId}`);
        const data = (await response.json().catch(() => ({}))) as {
          operation?: BulkOperationDetail;
          error?: string;
        };
        if (!response.ok) throw new Error(data.error ?? "Failed to get operation");
        return data.operation ?? null;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to get operation";
        toast.error(message);
        return null;
      }
    },
    [],
  );

  return {
    operations,
    loading,
    createBulkOp,
    undoOperation,
    redoOperation,
    getOperation,
    loadOperations,
    buildClientSnapshot,
  };
}
