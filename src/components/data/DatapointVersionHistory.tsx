"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Metric } from "@/components/ui/metric";
import { cn } from "@/lib/utils";

type VersionDiff = {
  field: string;
  oldValue: string | number | null;
  newValue: string | number | null;
};

type VersionRow = {
  id: string;
  versionNumber: number;
  changeType: "create" | "update" | "delete" | "rollback";
  oldValue: {
    value?: number | null;
    quality?: string | null;
    unit?: string | null;
  } | null;
  newValue: {
    value?: number | null;
    quality?: string | null;
    unit?: string | null;
  } | null;
  changedBy: string | null;
  changedAt: string;
  reason: string | null;
  diffs: VersionDiff[];
};

export type VersionHistoryRestored = {
  id: string;
  value: number | null;
  quality: string;
  unit: string | null;
  approvalState: string;
};

function formatValue(v: string | number | null): string {
  if (v == null) return "—";
  if (typeof v === "number") return String(v);
  return v || "—";
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 16).replace("T", " ");
  } catch {
    return iso;
  }
}

export function DatapointVersionHistory({
  datapointId,
  metricLabel,
  open,
  onOpenChange,
  canWrite,
  periodLocked,
  onRestored,
}: {
  datapointId: string;
  metricLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
  periodLocked: boolean;
  onRestored?: (row: VersionHistoryRestored) => void;
}) {
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/datapoints/${datapointId}/versions`);
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        versions?: VersionRow[];
      };
      if (!res.ok) {
        setError(data.error ?? "Could not load version history.");
        setVersions([]);
        return;
      }
      setVersions(data.versions ?? []);
    } catch {
      setError("Could not load version history.");
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }, [datapointId]);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (next) void load();
  }

  async function rollback(versionId: string) {
    if (!canWrite || periodLocked) return;
    setRollingBackId(versionId);
    setError(null);
    try {
      const res = await fetch(`/api/app/datapoints/${datapointId}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionId,
          reason: reason.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        datapoint?: VersionHistoryRestored;
      };
      if (!res.ok) {
        setError(data.error ?? "Rollback failed.");
        return;
      }
      if (data.datapoint && onRestored) {
        onRestored(data.datapoint);
      }
      setReason("");
      await load();
    } catch {
      setError("Rollback failed.");
    } finally {
      setRollingBackId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-rule bg-surface-1 text-ink">
        <DialogHeader>
          <DialogTitle className="font-display text-ink">Version history</DialogTitle>
          <DialogDescription className="text-ink-muted">
            Field-level changes for {metricLabel}. Rollback restores the selected
            version&apos;s values; each rollback is itself versioned and audited.
          </DialogDescription>
        </DialogHeader>

        {canWrite && !periodLocked ? (
          <label className="block text-[12px] text-ink">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Rollback reason (optional)
            </span>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Correcting supplier restatement"
              className="mt-1 w-full rounded-[4px] border border-rule bg-canvas px-2 py-1.5 text-[13px] text-ink placeholder:text-ink-muted"
            />
          </label>
        ) : null}

        {loading ? (
          <p className="py-6 text-center text-[13px] text-ink-muted">Loading versions…</p>
        ) : error ? (
          <p className="border border-rust/40 bg-rust/10 px-3 py-2 text-[13px] text-rust">
            {error}
          </p>
        ) : versions.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-ink-muted">
            No versions recorded yet. Saves from the data grid create the first entry.
          </p>
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {versions.map((v) => {
              const expanded = expandedId === v.id;
              const snap = v.newValue ?? v.oldValue;
              return (
                <li key={v.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setExpandedId(expanded ? null : v.id)}
                    >
                      <p className="text-[12px] font-medium text-ink">
                        <span className="font-data tabular-nums">v{v.versionNumber}</span>
                        <span className="mx-1.5 text-ink-muted">·</span>
                        <span className="capitalize">{v.changeType}</span>
                      </p>
                      <p className="mt-0.5 font-data text-[11px] text-ink-muted tabular-nums">
                        {formatWhen(v.changedAt)}
                        {v.changedBy ? ` · ${v.changedBy}` : null}
                      </p>
                      {snap ? (
                        <p className="mt-1 text-[12px] text-ink">
                          {typeof snap.value === "number" ? (
                            <Metric
                              value={snap.value}
                              size="sm"
                              decimals={3}
                              className="inline"
                              inView={false}
                            />
                          ) : (
                            <span className="font-data tabular-nums">—</span>
                          )}
                          {snap.unit ? ` ${snap.unit}` : null}
                          {snap.quality ? (
                            <span className="text-ink-muted"> · {snap.quality}</span>
                          ) : null}
                        </p>
                      ) : null}
                      {v.reason ? (
                        <p className="mt-1 text-[11px] text-ink-muted">{v.reason}</p>
                      ) : null}
                    </button>
                    {canWrite &&
                    !periodLocked &&
                    v.changeType !== "delete" &&
                    v.newValue ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={rollingBackId === v.id}
                        onClick={() => void rollback(v.id)}
                      >
                        {rollingBackId === v.id ? "Restoring…" : "Restore"}
                      </Button>
                    ) : null}
                  </div>
                  {expanded && v.diffs.length > 0 ? (
                    <table className="mt-2 w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-rule text-left text-ink-muted">
                          <th className="py-1 pr-2 font-medium">Field</th>
                          <th className="py-1 pr-2 font-medium">Before</th>
                          <th className="py-1 font-medium">After</th>
                        </tr>
                      </thead>
                      <tbody>
                        {v.diffs.map((d) => (
                          <tr key={d.field} className="border-b border-rule/60">
                            <td className="py-1 pr-2 text-ink">{d.field}</td>
                            <td
                              className={cn(
                                "py-1 pr-2 font-data tabular-nums text-ink-muted",
                              )}
                            >
                              {formatValue(d.oldValue)}
                            </td>
                            <td className="py-1 font-data tabular-nums text-ink">
                              {formatValue(d.newValue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}
                  {expanded && v.diffs.length === 0 ? (
                    <p className="mt-2 text-[11px] text-ink-muted">No field diffs.</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
