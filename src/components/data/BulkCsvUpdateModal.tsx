"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BulkUpdatePreviewRow } from "@/lib/data";
import { cn } from "@/lib/utils";

type PreviewResponse = {
  ok?: boolean;
  bulkUpdateId?: string | null;
  validated?: number;
  changed?: number;
  unchanged?: number;
  rejected?: number;
  periodLocked?: boolean;
  preview?: BulkUpdatePreviewRow[];
  message?: string;
  error?: string;
};

type ApplyResponse = {
  ok?: boolean;
  updated?: number;
  approvalResets?: number;
  canUndo?: boolean;
  error?: string;
  rolledBack?: boolean;
};

export function BulkCsvUpdateModal({
  open,
  onOpenChange,
  canWrite,
  periodLocked,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
  periodLocked: boolean;
  onApplied?: () => void;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  function reset() {
    setFileName(null);
    setLoading(false);
    setApplying(false);
    setError(null);
    setPreview(null);
    setDoneMessage(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function runPreview(file: File) {
    setLoading(true);
    setError(null);
    setDoneMessage(null);
    setPreview(null);
    setFileName(file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/app/data/bulk-update", {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as PreviewResponse;
      if (!res.ok) {
        setError(data.error ?? "Preview failed");
        return;
      }
      setPreview(data);
      if (data.message && !data.bulkUpdateId) {
        setError(null);
      }
    } catch {
      setError("Could not reach the bulk-update API");
    } finally {
      setLoading(false);
    }
  }

  async function applyPreview() {
    if (!preview?.bulkUpdateId) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch("/api/app/data/bulk-update/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bulkUpdateId: preview.bulkUpdateId, proceed: true }),
      });
      const data = (await res.json().catch(() => ({}))) as ApplyResponse;
      if (!res.ok) {
        setError(
          data.error
            ? data.rolledBack
              ? `${data.error} Changes were rolled back.`
              : data.error
            : "Apply failed",
        );
        return;
      }
      setDoneMessage(
        `Updated ${data.updated ?? 0} datapoint(s)${
          data.canUndo ? ". Undo is available from bulk history." : ""
        }`,
      );
      onApplied?.();
    } catch {
      setError("Could not reach the apply API");
    } finally {
      setApplying(false);
    }
  }

  const rows = preview?.preview ?? [];
  const canApply =
    canWrite &&
    !periodLocked &&
    Boolean(preview?.bulkUpdateId) &&
    (preview?.changed ?? 0) > 0 &&
    !doneMessage;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-rule bg-surface-1 text-ink">
        <DialogHeader>
          <DialogTitle className="font-display text-ink">Bulk CSV update</DialogTitle>
          <DialogDescription className="text-ink-muted">
            Update existing datapoints by id. Columns: datapoint_id, new_value, optional
            reason / quality / unit. Distinct from spreadsheet import (create).
          </DialogDescription>
        </DialogHeader>

        {!canWrite ? (
          <p className="text-[13px] text-ink-muted">View only — updates are disabled.</p>
        ) : periodLocked ? (
          <p className="text-[13px] text-rust">
            Reporting period is locked or published. Writes are refused.
          </p>
        ) : (
          <div className="space-y-4">
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                CSV file
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={loading || applying}
                className="mt-2 block w-full text-[13px] text-ink-muted file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-on-accent"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void runPreview(f);
                }}
              />
            </label>
            <p className="text-[11px] text-ink-muted">
              {fileName ? (
                <>
                  Selected: <span className="font-data text-ink">{fileName}</span>
                </>
              ) : (
                "No file chosen."
              )}{" "}
              Requires consultant bulk_actions entitlement.
            </p>
          </div>
        )}

        {loading ? (
          <p role="status" className="text-[13px] text-ink-muted">
            Validating CSV…
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-[13px] text-rust">
            {error}
          </p>
        ) : null}

        {doneMessage ? (
          <p role="status" className="text-[13px] text-signal">
            {doneMessage}
          </p>
        ) : null}

        {preview && !loading ? (
          <div className="border-t border-rule pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Preview
            </p>
            <p className="mt-1 font-data text-[12px] text-ink-muted">
              {preview.changed ?? 0} changed · {preview.unchanged ?? 0} unchanged ·{" "}
              {preview.rejected ?? 0} rejected
              {preview.bulkUpdateId ? (
                <>
                  {" "}
                  · id <span className="text-ink">{preview.bulkUpdateId}</span>
                </>
              ) : null}
            </p>

            {rows.length === 0 ? (
              <p className="mt-3 text-[13px] text-ink-muted">No preview rows.</p>
            ) : (
              <ul className="mt-3 max-h-64 overflow-y-auto text-[12px]">
                {rows.map((r, i) => (
                  <li
                    key={`${r.datapointId}-${i}`}
                    className={cn(
                      "border-b border-rule py-2 font-data",
                      r.kind === "rejected" && "text-rust",
                      r.kind === "changed" && "text-amber",
                      r.kind === "unchanged" && "text-ink-muted",
                    )}
                  >
                    <span className="uppercase">{r.kind}</span> · {r.datapointId}
                    {r.metricKey ? ` · ${r.metricKey}` : null}
                    {r.reason ? ` — ${r.reason}` : null}
                    {r.after ? ` → ${r.after.value ?? "∅"} (${r.after.quality})` : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
          >
            Close
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canApply || applying}
            onClick={() => void applyPreview()}
          >
            {applying ? "Applying…" : "Apply updates"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
