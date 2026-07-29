import { useState, useCallback } from "react";
import { toast } from "sonner";

interface BulkOperation {
  id: string;
  operationType: string;
  resourceType: string;
  itemCount: number;
  status: "pending" | "processing" | "completed" | "failed";
  progressPercent: number;
  canUndo: boolean;
  createdAt: string;
}

interface UseBulkOperationsReturn {
  operations: BulkOperation[];
  loading: boolean;
  createBulkOp: (
    operationType: string,
    resourceType: string,
    itemIds: string[],
    changes?: unknown,
  ) => Promise<BulkOperation | null>;
  undoOperation: (operationId: string) => Promise<boolean>;
  getOperation: (operationId: string) => Promise<BulkOperation | null>;
  loadOperations: (status?: string) => Promise<void>;
}

export function useBulkOperations(): UseBulkOperationsReturn {
  const [operations, setOperations] = useState<BulkOperation[]>([]);
  const [loading, setLoading] = useState(false);

  const loadOperations = useCallback(async (status?: string) => {
    setLoading(true);
    try {
      const url = new URL("/api/app/bulk-operations", window.location.origin);
      if (status) url.searchParams.append("status", status);

      const response = await fetch(url);
      const data = await response.json();
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
    ): Promise<BulkOperation | null> => {
      try {
        const response = await fetch("/api/app/bulk-operations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operationType,
            resourceType,
            itemIds,
            changes,
            beforeSnapshot: [], // Would be populated with actual data
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to create bulk operation");
        }

        const data = await response.json();
        const op = data.operation;
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

      if (!response.ok) {
        throw new Error("Failed to undo operation");
      }

      setOperations((prev) =>
        prev.map((op) => (op.id === operationId ? { ...op, canUndo: false } : op)),
      );
      toast.success("Operation undone successfully");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to undo operation";
      toast.error(message);
      return false;
    }
  }, []);

  const getOperation = useCallback(
    async (operationId: string): Promise<BulkOperation | null> => {
      try {
        const response = await fetch(`/api/app/bulk-operations/${operationId}`);
        if (!response.ok) throw new Error("Failed to get operation");
        const data = await response.json();
        return data.operation;
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
    getOperation,
    loadOperations,
  };
}
