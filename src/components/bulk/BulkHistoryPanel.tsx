"use client";

import { useCallback, useEffect, useState } from "react";

import { BulkConfirmDialog } from "@/components/bulk/BulkConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  useBulkOperations,
  type BulkOperationSummary,
} from "@/lib/hooks/useBulkOperations";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 16).replace("T", " ");
  } catch {
    return iso;
  }
}

export function BulkHistoryPanel({
  resourceType,
  onChanged,
}: {
  resourceType?: "suppliers" | "datapoints" | "users";
  onChanged?: () => void;
}) {
  const {
    operations,
    loading,
    loadOperations,
    undoOperation,
    redoOperation,
    getOperation,
  } = useBulkOperations();
  const [dialog, setDialog] = useState<{
    mode: "undo" | "redo";
    id: string;
  } | null>(null);

  useEffect(() => {
    void loadOperations();
  }, [loadOperations]);

  const filtered: BulkOperationSummary[] = resourceType
    ? operations.filter((op) => op.resourceType === resourceType)
    : operations;

  const loadPreview = useCallback(
    async (operationId: string) => {
      const detail = await getOperation(operationId);
      if (!detail) return null;
      return {
        undoPreview: detail.undoPreview,
        redoPreview: detail.redoPreview,
      };
    },
    [getOperation],
  );

  async function handleConfirm(operationId: string): Promise<boolean> {
    if (!dialog) return false;
    const ok =
      dialog.mode === "undo"
        ? await undoOperation(operationId)
        : await redoOperation(operationId);
    if (ok) {
      await loadOperations();
      onChanged?.();
    }
    return ok;
  }

  return (
    <div className="rounded-md border border-rule bg-surface-1">
      <div className="flex items-center justify-between border-b border-rule px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Bulk history
          </p>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            Undo restores the pre-operation snapshot. Redo re-applies it.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void loadOperations()}
          disabled={loading}
        >
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <p className="px-4 py-6 text-[12px] text-ink-muted">No bulk operations yet.</p>
      ) : (
        <ul className="divide-y divide-rule">
          {filtered.slice(0, 12).map((op) => (
            <li
              key={op.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-ink">
                  <span className="font-data">{op.operationType}</span>
                  <span className="text-ink-muted"> · </span>
                  <span className="font-data">{op.itemCount}</span>
                  <span className="text-ink-muted"> {op.resourceType}</span>
                </p>
                <p className="text-[11px] text-ink-muted">
                  {formatWhen(op.createdAt)}
                  {op.status !== "completed" ? ` · ${op.status}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                {op.canUndo ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setDialog({ mode: "undo", id: op.id })}
                  >
                    Undo
                  </Button>
                ) : null}
                {op.canRedo ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setDialog({ mode: "redo", id: op.id })}
                  >
                    Redo
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <BulkConfirmDialog
        open={dialog !== null}
        mode={dialog?.mode ?? "undo"}
        operationId={dialog?.id ?? null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        onConfirm={handleConfirm}
        loadPreview={loadPreview}
      />
    </div>
  );
}
