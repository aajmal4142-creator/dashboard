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

type CompareField = {
  field: string;
  a: string | number | null;
  b: string | number | null;
  changed: boolean;
};

type CompareMeta = {
  versionNumber: number;
  changeType: string;
  changedBy: string | null;
  changedAt: string;
  reason: string | null;
};

type CompareResult = {
  v1: number;
  v2: number;
  versionA: CompareMeta;
  versionB: CompareMeta;
  fields: Record<
    string,
    { a: string | number | null; b: string | number | null; changed: boolean }
  >;
  diffs: CompareField[];
  changedCount: number;
  identical: boolean;
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

function displayActor(changedBy: string | null): string {
  if (!changedBy) return "Deleted User";
  return changedBy;
}

function displayReason(reason: string | null): string {
  if (!reason?.trim()) return "No reason";
  return reason;
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
  const [pickA, setPickA] = useState<number | "">("");
  const [pickB, setPickB] = useState<number | "">("");
  const [comparing, setComparing] = useState(false);
  const [compare, setCompare] = useState<CompareResult | null>(null);
  const [showChangedOnly, setShowChangedOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCompare(null);
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
      const rows = data.versions ?? [];
      setVersions(rows);
      if (rows.length >= 2) {
        setPickA(rows[1]?.versionNumber ?? "");
        setPickB(rows[0]?.versionNumber ?? "");
      } else if (rows.length === 1) {
        setPickA(rows[0]?.versionNumber ?? "");
        setPickB(rows[0]?.versionNumber ?? "");
      } else {
        setPickA("");
        setPickB("");
      }
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
    if (!next) {
      setCompare(null);
      setShowChangedOnly(false);
    }
  }

  async function runCompare() {
    if (pickA === "" || pickB === "") {
      setError("Select version A and version B to compare.");
      return;
    }
    setComparing(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/app/datapoints/${datapointId}/versions/compare?v1=${pickA}&v2=${pickB}`,
      );
      const data = (await res.json().catch(() => ({}))) as CompareResult & {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not compare versions.");
        setCompare(null);
        return;
      }
      setCompare(data);
    } catch {
      setError("Could not compare versions.");
      setCompare(null);
    } finally {
      setComparing(false);
    }
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
      setCompare(null);
      await load();
    } catch {
      setError("Rollback failed.");
    } finally {
      setRollingBackId(null);
    }
  }

  const compareRows: CompareField[] = compare
    ? showChangedOnly
      ? compare.diffs
      : Object.entries(compare.fields).map(([field, v]) => ({
          field,
          a: v.a,
          b: v.b,
          changed: v.changed,
        }))
    : [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[85vh] overflow-y-auto border-rule bg-surface-1 text-ink",
          compare ? "max-w-3xl" : "max-w-lg",
        )}
      >
        <DialogHeader>
          <DialogTitle className="font-display text-ink">Version history</DialogTitle>
          <DialogDescription className="text-ink-muted">
            Field-level changes for {metricLabel}. Pick two versions to compare
            side-by-side. Rollback restores the selected version&apos;s values; each
            rollback is itself versioned and audited.
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

        {!loading && versions.length >= 1 ? (
          <div className="border-y border-rule py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Compare versions
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="text-[12px] text-ink">
                <span className="text-ink-muted">A</span>
                <select
                  value={pickA === "" ? "" : String(pickA)}
                  onChange={(e) => setPickA(e.target.value ? Number(e.target.value) : "")}
                  className="ml-1.5 rounded-[4px] border border-rule bg-canvas px-2 py-1.5 font-data text-[12px] tabular-nums text-ink"
                >
                  <option value="">—</option>
                  {versions.map((v) => (
                    <option key={`a-${v.id}`} value={v.versionNumber}>
                      v{v.versionNumber}
                    </option>
                  ))}
                </select>
              </label>
              <span className="pb-1.5 text-[12px] text-ink-muted">|</span>
              <label className="text-[12px] text-ink">
                <span className="text-ink-muted">B</span>
                <select
                  value={pickB === "" ? "" : String(pickB)}
                  onChange={(e) => setPickB(e.target.value ? Number(e.target.value) : "")}
                  className="ml-1.5 rounded-[4px] border border-rule bg-canvas px-2 py-1.5 font-data text-[12px] tabular-nums text-ink"
                >
                  <option value="">—</option>
                  {versions.map((v) => (
                    <option key={`b-${v.id}`} value={v.versionNumber}>
                      v{v.versionNumber}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={comparing || pickA === "" || pickB === ""}
                onClick={() => void runCompare()}
              >
                {comparing ? "Comparing…" : "Compare"}
              </Button>
              {compare ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setCompare(null)}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {compare ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 border-b border-rule pb-3">
              <div>
                <p className="font-data text-[12px] font-medium tabular-nums text-ink">
                  Version A · v{compare.versionA.versionNumber}
                </p>
                <p className="mt-0.5 text-[11px] capitalize text-ink-muted">
                  {compare.versionA.changeType}
                </p>
                <p className="mt-0.5 font-data text-[11px] text-ink-muted tabular-nums">
                  {formatWhen(compare.versionA.changedAt)} ·{" "}
                  {displayActor(compare.versionA.changedBy)}
                </p>
                <p className="mt-1 text-[11px] text-ink-muted">
                  {displayReason(compare.versionA.reason)}
                </p>
              </div>
              <div>
                <p className="font-data text-[12px] font-medium tabular-nums text-ink">
                  Version B · v{compare.versionB.versionNumber}
                </p>
                <p className="mt-0.5 text-[11px] capitalize text-ink-muted">
                  {compare.versionB.changeType}
                </p>
                <p className="mt-0.5 font-data text-[11px] text-ink-muted tabular-nums">
                  {formatWhen(compare.versionB.changedAt)} ·{" "}
                  {displayActor(compare.versionB.changedBy)}
                </p>
                <p className="mt-1 text-[11px] text-ink-muted">
                  {displayReason(compare.versionB.reason)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="font-data text-[11px] tabular-nums text-ink-muted">
                {compare.identical
                  ? "No changes"
                  : `${compare.changedCount} field${compare.changedCount === 1 ? "" : "s"} changed`}
              </p>
              <label className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                <input
                  type="checkbox"
                  checked={showChangedOnly}
                  onChange={(e) => setShowChangedOnly(e.target.checked)}
                  className="rounded-[2px] border-rule"
                />
                Changed only
              </label>
            </div>

            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-rule text-left text-ink-muted">
                  <th className="py-1 pr-2 font-medium">Field</th>
                  <th className="py-1 pr-2 font-medium">A · v{compare.v1}</th>
                  <th className="py-1 font-medium">B · v{compare.v2}</th>
                </tr>
              </thead>
              <tbody>
                {compareRows.map((row) => (
                  <tr
                    key={row.field}
                    className={cn(
                      "border-b border-rule/60",
                      row.changed && "bg-accent-quiet/40",
                    )}
                  >
                    <td className="py-1.5 pr-2 text-ink">
                      {row.field}
                      {row.changed ? (
                        <span className="ml-1.5 text-[10px] uppercase tracking-[0.06em] text-accent">
                          Changed
                        </span>
                      ) : null}
                    </td>
                    <td
                      className={cn(
                        "py-1.5 pr-2 font-data tabular-nums",
                        row.changed ? "bg-rust/10 text-rust" : "text-ink-muted",
                      )}
                    >
                      {formatValue(row.a)}
                    </td>
                    <td
                      className={cn(
                        "py-1.5 font-data tabular-nums",
                        row.changed ? "bg-signal/10 text-signal" : "text-ink",
                      )}
                    >
                      {formatValue(row.b)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {error ? (
          <p className="border border-rust/40 bg-rust/10 px-3 py-2 text-[13px] text-rust">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="py-6 text-center text-[13px] text-ink-muted">Loading versions…</p>
        ) : versions.length === 0 && !error ? (
          <p className="py-6 text-center text-[13px] text-ink-muted">
            No versions recorded yet. Saves from the data grid create the first entry.
          </p>
        ) : versions.length > 0 ? (
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
                        {" · "}
                        {displayActor(v.changedBy)}
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
                      <p className="mt-1 text-[11px] text-ink-muted">
                        {displayReason(v.reason)}
                      </p>
                    </button>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setPickA(v.versionNumber)}
                          aria-label={`Set v${v.versionNumber} as compare A`}
                        >
                          A
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setPickB(v.versionNumber)}
                          aria-label={`Set v${v.versionNumber} as compare B`}
                        >
                          B
                        </Button>
                      </div>
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
                            <td className="py-1 pr-2 font-data tabular-nums text-ink-muted">
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
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
