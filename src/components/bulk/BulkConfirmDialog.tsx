"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BulkOpPreview } from "@/lib/hooks/useBulkOperations";

type Mode = "undo" | "redo";

export function BulkConfirmDialog({
  open,
  mode,
  operationId,
  onOpenChange,
  onConfirm,
  loadPreview,
}: {
  open: boolean;
  mode: Mode;
  operationId: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (operationId: string) => Promise<boolean>;
  loadPreview: (operationId: string) => Promise<{
    undoPreview?: BulkOpPreview;
    redoPreview?: BulkOpPreview;
  } | null>;
}) {
  const [preview, setPreview] = useState<BulkOpPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open || !operationId) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setPreview(null);
      void loadPreview(operationId)
        .then((detail) => {
          if (cancelled) return;
          setPreview(
            mode === "undo"
              ? (detail?.undoPreview ?? null)
              : (detail?.redoPreview ?? null),
          );
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, operationId, mode, loadPreview]);

  async function handleConfirm() {
    if (!operationId) return;
    setConfirming(true);
    const ok = await onConfirm(operationId);
    setConfirming(false);
    if (ok) onOpenChange(false);
  }

  const title = mode === "undo" ? "Confirm undo" : "Confirm redo";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-rule bg-surface-1 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-ink">{title}</DialogTitle>
          <DialogDescription className="text-ink-muted">
            {loading
              ? "Loading preview…"
              : (preview?.description ?? "Review what will change before continuing.")}
          </DialogDescription>
        </DialogHeader>

        {preview ? (
          <div className="space-y-3 border-t border-rule pt-3 text-[12px]">
            <div className="flex justify-between gap-4">
              <span className="text-ink-muted">Operation</span>
              <span className="font-data text-ink">{preview.operationType}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-ink-muted">Resource</span>
              <span className="font-data text-ink">{preview.resourceType}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-ink-muted">Items</span>
              <span className="font-data text-ink">{preview.itemCount}</span>
            </div>
            {preview.changedFields.length > 0 ? (
              <div>
                <p className="text-ink-muted">Fields affected</p>
                <p className="mt-1 font-data text-ink">
                  {preview.changedFields.join(", ")}
                </p>
              </div>
            ) : null}
            {preview.sampleLabels.length > 0 ? (
              <div>
                <p className="text-ink-muted">Sample</p>
                <ul className="mt-1 list-inside list-disc text-ink">
                  {preview.sampleLabels.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="border-t border-rule pt-3 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleConfirm()}
            disabled={confirming || loading || !operationId}
          >
            {confirming ? "Working…" : mode === "undo" ? "Undo" : "Redo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
