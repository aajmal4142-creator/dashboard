"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { BulkCsvUpdateModal } from "@/components/data/BulkCsvUpdateModal";
import { DatapointLineagePanel } from "@/components/data/DatapointLineagePanel";
import { DatapointVersionHistory } from "@/components/data/DatapointVersionHistory";
import { FrameworkChips } from "@/components/data/FrameworkChips";
import { FrameworkCoveragePanel } from "@/components/data/FrameworkCoveragePanel";
import { ApprovalChip } from "@/components/governance/ApprovalChip";
import { Button } from "@/components/ui/button";
import { Metric } from "@/components/ui/metric";
import type { FactorRecord, Quality } from "@/lib/calc";
import {
  DATA_METRICS,
  IMPORT_COLUMNS,
  QUALITY_VALUES,
  previewTco2e,
  type DiffRow,
  type ImportColumn,
} from "@/lib/data";
import { suggestMetricFromFilename } from "@/lib/data/suggestMetric";
import { DERIVED_METRICS } from "@/lib/derive/registry";
import {
  coverageFromData,
  type DatapointProvenance,
  type FrameworkId,
} from "@/lib/frameworks";
import { evidenceLabel, qualityLabel } from "@/lib/ui/displayLabels";
import { cn } from "@/lib/utils";
import { SAVE_DATAPOINT_EVENT } from "@/lib/keyboard";
import { toast } from "sonner";

const IMPORT_COLUMN_LABELS: Record<string, string> = {
  metricKey: "Metric ID",
  label: "Label",
  value: "Value",
  unit: "Unit",
  period: "Period",
  quality: "Quality",
  evidenceRef: "Evidence ref",
  note: "Note",
  frameworkCell: "Framework cell",
  assignee: "Assignee",
};

export type DataRowState = {
  id?: string | null;
  metricKey: string;
  value: number | null;
  quality: Quality;
  unit: string | null;
  approvalState: string;
  evidenceCount: number;
  assignedTo: string | null;
  provenance?: DatapointProvenance | null;
};

type RowViolation = {
  ruleName: string;
  message: string;
  severity: "error" | "warning";
  fieldName: string;
};

type Teammate = { id: string; email: string; name: string };
type Mode = "enter" | "spreadsheet";
type SortKey = "metric" | "value" | "quality" | "evidence" | "owner";

function qualityBadgeClass(q: Quality): string {
  if (q === "measured") return "bg-signal/10 text-signal";
  if (q === "estimated") return "bg-amber/15 text-ink";
  if (q === "calculated") return "bg-accent/10 text-accent";
  return "bg-rust/10 text-rust";
}

export function DataWorkspace({
  initialRows,
  periodLocked,
  factors,
  region,
  year,
  canWrite,
  canBulkActions = false,
  applicableFrameworks: applicable = [],
  emissionsStandard,
}: {
  initialRows: DataRowState[];
  periodLocked: boolean;
  factors: FactorRecord[];
  region: string;
  year: number;
  canWrite: boolean;
  /** Consultant bulk_actions entitlement — enables id-match CSV update. */
  canBulkActions?: boolean;
  applicableFrameworks?: FrameworkId[];
  emissionsStandard?: string;
}) {
  const [mode, setMode] = useState<Mode>("enter");
  const [rows, setRows] = useState<DataRowState[]>(() => {
    const byKey = new Map(initialRows.map((r) => [r.metricKey, r]));
    return DATA_METRICS.map((m) => {
      const existing = byKey.get(m.key);
      return (
        existing ?? {
          metricKey: m.key,
          value: null,
          quality: "missing" as Quality,
          unit: m.unit,
          approvalState: "pending",
          evidenceCount: 0,
          assignedTo: null,
          provenance: null,
        }
      );
    });
  });

  const coverage = useMemo(
    () =>
      coverageFromData({
        applicable,
        datapoints: rows.map((r) => ({
          metricKey: r.metricKey,
          quality: r.quality,
          provenance: r.provenance ?? null,
        })),
      }),
    [applicable, rows],
  );

  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"neutral" | "error" | "ok">("neutral");
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [diff, setDiff] = useState<DiffRow[] | null>(null);
  const [columns, setColumns] = useState<ImportColumn[]>([
    "metricKey",
    "label",
    "value",
    "unit",
    "quality",
  ]);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("metric");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [changeReason, setChangeReason] = useState("");
  const [historyTarget, setHistoryTarget] = useState<{
    id: string;
    label: string;
    metricKey: string;
  } | null>(null);
  const [lineageTarget, setLineageTarget] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [lastFocusedMetric, setLastFocusedMetric] = useState<string | null>(null);
  const [rowViolations, setRowViolations] = useState<Record<string, RowViolation[]>>({});
  const [validating, setValidating] = useState(false);
  const [bulkUpdateOpen, setBulkUpdateOpen] = useState(false);

  useEffect(() => {
    void fetch("/api/app/teammates")
      .then((r) => r.json())
      .then((d: { teammates?: Teammate[] }) => setTeammates(d.teammates ?? []))
      .catch(() => undefined);
  }, []);

  const validateRows = useCallback(
    async (targets?: DataRowState[]) => {
      const list = (targets ?? rows).filter(
        (r) => r.quality !== "missing" || r.value != null,
      );
      if (list.length === 0) {
        setRowViolations({});
        return;
      }
      setValidating(true);
      try {
        const res = await fetch("/api/app/data/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            list.map((r) => ({
              id: r.id ?? r.metricKey,
              metricKey: r.metricKey,
              value: r.value,
              quality: r.quality,
              unit: r.unit,
              approvalState: r.approvalState,
              provenance: r.provenance ?? null,
            })),
          ),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          results?: Array<{
            datapointId?: string | null;
            violations?: RowViolation[];
          }>;
        };
        if (!res.ok) {
          setStatusTone("error");
          setStatus(data.error ?? "Validation failed");
          return;
        }
        setRowViolations((prev) => {
          const next: Record<string, RowViolation[]> = targets ? { ...prev } : {};
          if (targets) {
            for (const r of targets) delete next[r.metricKey];
          }
          for (let i = 0; i < list.length; i++) {
            const key = list[i].metricKey;
            const result = data.results?.[i];
            const violations = result?.violations ?? [];
            if (violations.length > 0) next[key] = violations;
          }
          return next;
        });
        const failCount = (data.results ?? []).filter(
          (r) => (r.violations?.length ?? 0) > 0,
        ).length;
        setStatusTone(failCount > 0 ? "error" : "ok");
        setStatus(
          failCount > 0
            ? `${failCount} metric${failCount === 1 ? "" : "s"} failed validation rules`
            : "All checked metrics passed validation rules",
        );
      } catch {
        setStatusTone("error");
        setStatus("Validation request failed");
      } finally {
        setValidating(false);
      }
    },
    [rows],
  );

  const derivedKeys = useMemo(() => new Set(DERIVED_METRICS.map((d) => d.key)), []);

  const teammateName = useCallback(
    (id: string | null) => {
      if (!id) return "Unassigned";
      const t = teammates.find((x) => x.id === id);
      return t?.name || t?.email || id;
    },
    [teammates],
  );

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows.filter((row) => {
      if (!q) return true;
      const def = DATA_METRICS.find((m) => m.key === row.metricKey);
      const hay =
        `${row.metricKey} ${def?.label ?? ""} ${row.quality} ${teammateName(row.assignedTo)}`.toLowerCase();
      return hay.includes(q);
    });

    list = [...list].sort((a, b) => {
      const defA = DATA_METRICS.find((m) => m.key === a.metricKey);
      const defB = DATA_METRICS.find((m) => m.key === b.metricKey);
      let cmp = 0;
      if (sortKey === "metric") {
        cmp = (defA?.label ?? a.metricKey).localeCompare(defB?.label ?? b.metricKey);
      } else if (sortKey === "value") {
        cmp = (a.value ?? -Infinity) - (b.value ?? -Infinity);
      } else if (sortKey === "quality") {
        cmp = a.quality.localeCompare(b.quality);
      } else if (sortKey === "evidence") {
        cmp = a.evidenceCount - b.evidenceCount;
      } else {
        cmp = teammateName(a.assignedTo).localeCompare(teammateName(b.assignedTo));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [rows, search, sortKey, sortDir, teammateName]);

  const saveRow = useCallback(
    async (row: DataRowState) => {
      if (!canWrite || periodLocked) {
        setStatusTone("error");
        setStatus(
          periodLocked
            ? "Reporting period is locked or published. Writes are refused."
            : "You do not have permission to write datapoints.",
        );
        return;
      }
      setSavingKey(row.metricKey);
      setStatus(null);
      const res = await fetch("/api/datapoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metricKey: row.metricKey,
          value: row.quality === "missing" ? null : row.value,
          quality: row.quality,
          unit: row.unit,
          assignedTo: row.assignedTo,
          reason: changeReason.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        approvalReset?: boolean;
        id?: string;
      };
      setSavingKey(null);
      if (!res.ok) {
        setStatusTone("error");
        setStatus(data.error ?? "Save failed");
        return;
      }
      if (data.id) {
        setRows((prev) =>
          prev.map((r) => (r.metricKey === row.metricKey ? { ...r, id: data.id } : r)),
        );
      }
      if (data.approvalReset) {
        setRows((prev) =>
          prev.map((r) =>
            r.metricKey === row.metricKey ? { ...r, approvalState: "pending" } : r,
          ),
        );
        setStatusTone("neutral");
        setStatus("Saved. Approval reset to pending — re-validation required.");
      } else {
        const label =
          DATA_METRICS.find((m) => m.key === row.metricKey)?.label ?? row.metricKey;
        setStatusTone("ok");
        setStatus(`Saved ${label}`);
      }
      void validateRows([
        {
          ...row,
          id: data.id ?? row.id,
        },
      ]);
    },
    [canWrite, periodLocked, changeReason, validateRows],
  );

  useEffect(() => {
    const onSaveShortcut = () => {
      const active = document.activeElement;
      let metricKey: string | null = null;
      if (active instanceof HTMLElement) {
        metricKey = active.getAttribute("data-metric-key");
        if (!metricKey) {
          const host = active.closest("[data-metric-key]");
          if (host instanceof HTMLElement) {
            metricKey = host.getAttribute("data-metric-key");
          }
        }
      }
      metricKey = metricKey ?? lastFocusedMetric;
      if (!metricKey) return;
      const row = rows.find((r) => r.metricKey === metricKey);
      if (row) void saveRow(row);
    };
    window.addEventListener(SAVE_DATAPOINT_EVENT, onSaveShortcut);
    return () => window.removeEventListener(SAVE_DATAPOINT_EVENT, onSaveShortcut);
  }, [rows, saveRow, lastFocusedMetric]);

  function updateRow(metricKey: string, patch: Partial<DataRowState>) {
    setRows((prev) =>
      prev.map((r) => (r.metricKey === metricKey ? { ...r, ...patch } : r)),
    );
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toggleSelect(metricKey: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(metricKey)) next.delete(metricKey);
      else next.add(metricKey);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelected((prev) => {
      const keys = visibleRows.map((r) => r.metricKey);
      const allOn = keys.every((k) => prev.has(k));
      if (allOn) return new Set();
      return new Set(keys);
    });
  }

  function exportCsv() {
    const header = [
      "metricKey",
      "label",
      "value",
      "unit",
      "quality",
      "evidenceCount",
      "owner",
    ];
    const lines = [header.join(",")];
    for (const row of visibleRows) {
      const def = DATA_METRICS.find((m) => m.key === row.metricKey);
      lines.push(
        [
          row.metricKey,
          JSON.stringify(def?.label ?? row.metricKey),
          row.value ?? "",
          row.unit ?? "",
          row.quality,
          row.evidenceCount,
          JSON.stringify(teammateName(row.assignedTo)),
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "metrics-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onEvidenceDrop(metricKey: string, files: FileList | null) {
    const file = files?.[0];
    if (!file || !canWrite || periodLocked) return;
    const tip = suggestMetricFromFilename(file.name);
    if (tip && tip.metricKey !== metricKey) {
      const ok = window.confirm(
        `This file looks like “${tip.label}”. Attach to ${metricKey} anyway? Cancel to pick the suggested metric instead.`,
      );
      if (!ok) {
        setStatusTone("neutral");
        setStatus(
          `Suggested metric: ${tip.label} (${tip.metricKey}). Drop the file on that row.`,
        );
        return;
      }
    }
    const row = rows.find((r) => r.metricKey === metricKey);
    if (!row?.id) {
      setStatusTone("error");
      setStatus("Save the figure before attaching evidence so the link can be verified.");
      return;
    }
    const form = new FormData();
    form.set("file", file);
    form.set("metricKey", metricKey);
    form.set("datapointId", row.id);
    const why = window.prompt(
      "Why does this document prove the figure? (optional note for auditors)",
      "",
    );
    if (why) form.set("whyNote", why);
    const res = await fetch("/api/evidence", { method: "POST", body: form });
    if (!res.ok) {
      setStatusTone("error");
      setStatus("Evidence upload failed");
      return;
    }
    updateRow(metricKey, {
      evidenceCount: (row.evidenceCount ?? 0) + 1,
    });
    setStatusTone("ok");
    setStatus(`Evidence attached to ${metricKey}`);
  }

  async function duplicatePriorStructure() {
    if (!canWrite || periodLocked) return;
    setStatusTone("neutral");
    setStatus("Duplicating prior period structure…");
    const res = await fetch("/api/app/periods/duplicate", { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      created?: number;
    };
    if (!res.ok) {
      setStatusTone("error");
      setStatus(data.error ?? "Could not duplicate period structure");
      return;
    }
    setStatusTone("ok");
    setStatus(`Added ${data.created ?? 0} missing metric rows from the prior period.`);
    toast.message("Structure duplicated", {
      description: "Fill values in the new rows when you have the numbers.",
    });
    window.location.reload();
  }

  async function onPaste(e: React.ClipboardEvent, startKey: string) {
    const text = e.clipboardData.getData("text/plain");
    if (!text.includes("\n") && !text.includes("\t")) return;
    e.preventDefault();
    if (!canWrite || periodLocked) {
      setStatusTone("error");
      setStatus(
        periodLocked
          ? "Reporting period is locked. Paste refused."
          : "Viewers cannot paste datapoints.",
      );
      return;
    }

    const startIdx = rows.findIndex((r) => r.metricKey === startKey);
    const lines = text
      .trim()
      .split(/\r?\n/)
      .map((l) => l.split(/\t/)[0]?.trim() ?? "");
    const importRows = lines.map((val, i) => {
      const row = rows[startIdx + i];
      return {
        metricKey: row?.metricKey ?? "",
        value: val,
        unit: row?.unit ?? "",
        quality:
          row?.quality === "missing" && val ? "estimated" : (row?.quality ?? "estimated"),
      };
    });

    const res = await fetch("/api/app/data/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "dry-run", rows: importRows, source: "paste" }),
    });
    const data = (await res.json()) as { rows?: DiffRow[]; error?: string };
    if (!res.ok) {
      setStatusTone("error");
      setStatus(data.error ?? "Paste validation failed");
      return;
    }
    setDiff(data.rows ?? []);
    setMode("spreadsheet");
    setStatusTone("neutral");
    setStatus("Paste dry-run ready — review and commit.");
  }

  async function runFileDryRun(file: File) {
    setUploadName(file.name);
    const form = new FormData();
    form.set("file", file);
    form.set("mode", "dry-run");
    const res = await fetch("/api/app/data/import", { method: "POST", body: form });
    const data = (await res.json()) as { rows?: DiffRow[]; error?: string };
    if (!res.ok) {
      setStatusTone("error");
      setStatus(data.error ?? "Import dry-run failed");
      return;
    }
    setDiff(data.rows ?? []);
    setMode("spreadsheet");
    setStatusTone("neutral");
    setStatus("Dry-run complete — review before commit.");
  }

  async function commitDiff() {
    if (!diff) return;
    const rowsToCommit = diff
      .filter((r) => r.kind === "added" || r.kind === "changed")
      .map((r) => ({
        metricKey: r.metricKey,
        value: r.after?.value ?? null,
        unit: r.after?.unit ?? "",
        quality: r.after?.quality ?? "missing",
      }));
    const res = await fetch("/api/app/data/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "commit", rows: rowsToCommit, source: "import" }),
    });
    const data = (await res.json()) as { error?: string; written?: number };
    if (!res.ok) {
      setStatusTone("error");
      setStatus(data.error ?? "Commit failed");
      return;
    }
    setStatusTone("ok");
    setStatus(`Committed ${data.written ?? 0} row(s). Reloading…`);
    window.location.reload();
  }

  function downloadTemplate(kind: "smart" | "blank") {
    const q = new URLSearchParams({
      kind,
      columns: columns.join(","),
    });
    window.location.href = `/api/app/data/import?${q.toString()}`;
  }

  return (
    <div className="min-h-full bg-canvas">
      <div className="mx-auto w-full max-w-6xl p-4 md:p-6 lg:p-8">
        {/* Header */}
        <header className="border-b-2 border-accent pb-5" data-tour="metrics-header">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
                Metrics
              </p>
              <h1 className="mt-1 text-[28px] font-bold leading-tight text-ink">
                Enter metrics
              </h1>
              <p className="mt-2 max-w-[66ch] text-[13px] text-ink-muted">
                Interactive entry is the product. Spreadsheet import is an on-ramp — never
                the spine.
              </p>
            </div>
            {canWrite ? (
              <div className="flex flex-wrap gap-2" data-tour="metrics-mode">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "enter" ? "default" : "outline"}
                  onClick={() => setMode("enter")}
                >
                  Enter here
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "spreadsheet" ? "default" : "outline"}
                  onClick={() => setMode("spreadsheet")}
                >
                  Use a spreadsheet
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={periodLocked}
                  onClick={() => void duplicatePriorStructure()}
                >
                  Duplicate prior structure
                </Button>
                {canBulkActions ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={periodLocked}
                    onClick={() => setBulkUpdateOpen(true)}
                  >
                    Bulk CSV update
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-[13px] text-ink-muted">View only</p>
            )}
          </div>
          {status ? (
            <p
              role="status"
              className={cn(
                "mt-3 text-[13px]",
                statusTone === "error" && "text-rust",
                statusTone === "ok" && "text-signal",
                statusTone === "neutral" && "text-ink-muted",
              )}
            >
              {status}
            </p>
          ) : null}
        </header>

        <div className="mt-6 space-y-4">
          <div data-tour="metrics-coverage">
            <FrameworkCoveragePanel summaries={coverage.byFramework} />
          </div>
          {emissionsStandard ? (
            <p className="text-[12px] text-ink-muted">
              Applicable emission factors:{" "}
              <span className="font-data text-ink">{emissionsStandard}</span>
              {" · "}
              {factors.length} registry rows for this standard
            </p>
          ) : null}

          {mode === "enter" ? (
            <section
              className="w-full rounded-[6px] border border-rule bg-surface-1 p-4 md:p-5"
              data-tour="metrics-table"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">Search metrics</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search metrics…"
                    className="w-full rounded-md border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink placeholder:text-ink-muted"
                  />
                </label>
                <label className="min-w-0 sm:w-56">
                  <span className="sr-only">Change reason</span>
                  <input
                    type="text"
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    disabled={!canWrite || periodLocked}
                    placeholder="Change reason (optional)"
                    className="w-full rounded-md border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink placeholder:text-ink-muted disabled:opacity-50"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={validating}
                    onClick={() => void validateRows()}
                  >
                    {validating ? "Checking…" : "Check rules"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={exportCsv}>
                    Export
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setMode("spreadsheet")}
                  >
                    Bulk add
                  </Button>
                </div>
              </div>

              <div
                className="mt-4 overflow-x-auto"
                tabIndex={0}
                role="grid"
                aria-label="Metrics"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    (document.activeElement as HTMLElement | null)?.blur?.();
                  }
                }}
              >
                <table className="w-full min-w-[720px] text-left text-[12px]">
                  <thead>
                    <tr className="border-b-2 border-rule-strong">
                      <th className="w-8 py-2.5 pr-2">
                        <input
                          type="checkbox"
                          aria-label="Select all visible"
                          checked={
                            visibleRows.length > 0 &&
                            visibleRows.every((r) => selected.has(r.metricKey))
                          }
                          onChange={toggleSelectAllVisible}
                        />
                      </th>
                      {(
                        [
                          ["metric", "Metric"],
                          ["value", "Value"],
                          ["quality", "Quality"],
                          ["evidence", "Evidence"],
                          ["owner", "Owner"],
                        ] as const
                      ).map(([key, label]) => (
                        <th key={key} className="py-2.5 pr-2">
                          <button
                            type="button"
                            className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
                            onClick={() => toggleSort(key)}
                          >
                            {label}
                            {sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                          </button>
                        </th>
                      ))}
                      <th className="py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                        State
                      </th>
                      <th className="py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                        History
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => {
                      const def = DATA_METRICS.find((m) => m.key === row.metricKey)!;
                      const locked =
                        periodLocked || !canWrite || derivedKeys.has(row.metricKey);
                      const tco2e = previewTco2e({
                        metricKey: row.metricKey,
                        value: row.value,
                        factors,
                        region,
                        year,
                      });
                      return (
                        <tr
                          key={row.metricKey}
                          id={row.metricKey}
                          className={cn(
                            "group border-b border-rule bg-surface-1 transition-colors last:border-b-0",
                            "hover:bg-surface-2",
                            locked && "opacity-70",
                          )}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (!locked)
                              void onEvidenceDrop(row.metricKey, e.dataTransfer.files);
                          }}
                        >
                          <td className="py-2.5 pr-2 align-top">
                            <input
                              type="checkbox"
                              aria-label={`Select ${def.label}`}
                              checked={selected.has(row.metricKey)}
                              onChange={() => toggleSelect(row.metricKey)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="sticky left-0 z-[1] bg-inherit py-2.5 pr-2 align-top transition-colors">
                            <p className="font-medium text-ink">{def.label}</p>
                            <p className="text-[10px] text-ink-muted">
                              {def.unit ? def.unit : null}
                              {tco2e != null ? (
                                <>
                                  {" · "}
                                  <Metric
                                    value={tco2e}
                                    size="sm"
                                    decimals={3}
                                    className="inline"
                                    inView={false}
                                  />{" "}
                                  tCO₂e
                                </>
                              ) : null}
                              {locked && periodLocked ? " · locked" : null}
                            </p>
                            <FrameworkChips
                              metricKey={row.metricKey}
                              applicable={applicable}
                            />
                          </td>
                          <td className="py-2.5 pr-2 align-top">
                            {def.inputType === "boolean" ? (
                              <button
                                type="button"
                                disabled={locked}
                                className={cn(
                                  "rounded-md border border-rule px-2 py-1 text-[11px]",
                                  row.value === 1
                                    ? "bg-accent text-on-accent"
                                    : "bg-surface-1",
                                )}
                                onClick={() => {
                                  const next = row.value === 1 ? 0 : 1;
                                  const nextRow = {
                                    ...row,
                                    value: next,
                                    quality: "measured" as Quality,
                                  };
                                  updateRow(row.metricKey, nextRow);
                                  void saveRow(nextRow);
                                }}
                              >
                                {row.value === 1 ? "Yes" : "No"}
                              </button>
                            ) : (
                              <input
                                type="text"
                                inputMode="decimal"
                                disabled={locked}
                                data-metric-key={row.metricKey}
                                className="w-24 rounded-md border border-rule bg-surface-1 px-2 py-1 font-data text-ink tabular-nums disabled:cursor-not-allowed"
                                value={row.value ?? ""}
                                aria-label={def.label}
                                onFocus={() => setLastFocusedMetric(row.metricKey)}
                                onPaste={(e) => void onPaste(e, row.metricKey)}
                                onChange={(e) => {
                                  const raw = e.target.value.trim();
                                  const n = raw === "" ? null : Number(raw);
                                  updateRow(row.metricKey, {
                                    value:
                                      Number.isFinite(n as number) || n === null
                                        ? n
                                        : row.value,
                                    quality:
                                      raw === ""
                                        ? "missing"
                                        : row.quality === "missing"
                                          ? "estimated"
                                          : row.quality,
                                  });
                                }}
                                onBlur={() => {
                                  const current = rows.find(
                                    (r) => r.metricKey === row.metricKey,
                                  );
                                  if (current) void saveRow(current);
                                }}
                              />
                            )}
                            {savingKey === row.metricKey ? (
                              <span className="ml-1 text-[10px] text-ink-muted">…</span>
                            ) : null}
                          </td>
                          <td className="py-2.5 pr-2 align-top">
                            <div
                              role="group"
                              aria-label="Quality"
                              className="inline-flex flex-wrap gap-1"
                            >
                              {QUALITY_VALUES.map((q) => (
                                <button
                                  key={q}
                                  type="button"
                                  disabled={locked}
                                  title={qualityLabel(q)}
                                  aria-label={qualityLabel(q)}
                                  aria-pressed={row.quality === q}
                                  className={cn(
                                    "rounded-[4px] px-2 py-1 text-[10px] font-semibold",
                                    row.quality === q
                                      ? qualityBadgeClass(q)
                                      : "bg-surface-2 text-ink-muted hover:text-ink",
                                  )}
                                  onClick={() => {
                                    const next = {
                                      ...row,
                                      quality: q,
                                      value: q === "missing" ? null : row.value,
                                    };
                                    updateRow(row.metricKey, next);
                                    void saveRow(next);
                                  }}
                                >
                                  {qualityLabel(q)}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 pr-2 align-top">
                            <label className="inline-flex cursor-pointer items-center gap-1 text-[11px]">
                              <span
                                className={cn(
                                  "rounded-[4px] border px-1.5 py-0.5 text-[10px]",
                                  row.evidenceCount > 0
                                    ? "border-signal text-signal"
                                    : "border-amber text-ink",
                                )}
                              >
                                {evidenceLabel(
                                  row.evidenceCount > 0 ? "evidenced" : "bare",
                                )}
                              </span>
                              {!locked ? (
                                <input
                                  type="file"
                                  className="sr-only"
                                  onChange={(e) =>
                                    void onEvidenceDrop(row.metricKey, e.target.files)
                                  }
                                />
                              ) : null}
                            </label>
                          </td>
                          <td className="py-2.5 pr-2 align-top">
                            <select
                              disabled={locked || teammates.length === 0}
                              aria-label={`Owner for ${def.label}`}
                              className="max-w-[9rem] appearance-none rounded-md border border-rule bg-surface-1 px-2 py-1.5 text-[11px] text-ink disabled:opacity-50"
                              value={row.assignedTo ?? ""}
                              onChange={(e) => {
                                const assignedTo = e.target.value || null;
                                const next = { ...row, assignedTo };
                                updateRow(row.metricKey, next);
                                void saveRow(next);
                              }}
                            >
                              <option value="">
                                {teammates.length === 0
                                  ? "Invite teammates to assign"
                                  : "Unassigned"}
                              </option>
                              {teammates.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name || t.email || t.id}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 align-top">
                            <ApprovalChip state={row.approvalState} />
                            {rowViolations[row.metricKey]?.length ? (
                              <ul className="mt-1.5 space-y-1" role="list">
                                {rowViolations[row.metricKey].map((v, idx) => (
                                  <li
                                    key={`${v.ruleName}-${idx}`}
                                    className={cn(
                                      "text-[10px] leading-snug",
                                      v.severity === "error" ? "text-rust" : "text-amber",
                                    )}
                                  >
                                    <span className="font-semibold uppercase tracking-[0.06em]">
                                      {v.severity}
                                    </span>
                                    {": "}
                                    {v.message}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </td>
                          <td className="py-2.5 align-top">
                            {row.id ? (
                              <div className="flex flex-col items-start gap-1">
                                <button
                                  type="button"
                                  className="text-[11px] text-accent underline-offset-2 hover:underline"
                                  onClick={() =>
                                    setHistoryTarget({
                                      id: row.id!,
                                      label: def.label,
                                      metricKey: row.metricKey,
                                    })
                                  }
                                >
                                  Versions
                                </button>
                                <button
                                  type="button"
                                  className="text-[11px] text-accent underline-offset-2 hover:underline"
                                  onClick={() =>
                                    setLineageTarget({
                                      id: row.id!,
                                      label: def.label,
                                    })
                                  }
                                >
                                  Lineage
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-ink-muted">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {visibleRows.length === 0 ? (
                  <p className="py-8 text-center text-[13px] text-ink-muted">
                    No metrics match this search.
                  </p>
                ) : null}
              </div>
              <p className="mt-3 text-[11px] text-ink-muted">
                Tab moves between cells · Esc blurs · Drop evidence on a row
              </p>
            </section>
          ) : (
            <div data-tour="metrics-table">
              {/* Template */}
              <section
                id="metrics-template"
                className="rounded-[6px] border border-rule bg-surface-1 p-4 md:p-5"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Columns for smart template
                </p>
                <p className="mt-2 max-w-[66ch] text-[13px] text-ink-muted">
                  Download a template, fill it offline, re-upload for a dry-run diff.
                  Allowed quality values live on the Reference sheet — validation happens
                  on upload, not via Excel dropdowns.
                </p>
                <fieldset className="mt-4">
                  <legend className="sr-only">Template columns</legend>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {IMPORT_COLUMNS.map((c) => (
                      <label
                        key={c}
                        className="flex items-center gap-2 text-[12px] text-ink"
                      >
                        <input
                          type="checkbox"
                          checked={columns.includes(c)}
                          onChange={(e) => {
                            setColumns((prev) =>
                              e.target.checked
                                ? [...prev, c]
                                : prev.filter((x) => x !== c),
                            );
                          }}
                        />
                        {IMPORT_COLUMN_LABELS[c] ?? c}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => downloadTemplate("smart")}
                  >
                    Download smart template
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => downloadTemplate("blank")}
                  >
                    Download blank template
                  </Button>
                </div>
              </section>

              {/* Upload */}
              <section className="mt-4 rounded-[6px] border border-rule bg-surface-1 p-4 md:p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Upload XLSX or CSV
                </p>
                <p className="mt-2 max-w-[66ch] text-[13px] text-ink-muted">
                  Create or refresh rows by metric key. To change existing rows by
                  datapoint id, use Bulk CSV update
                  {canBulkActions ? " (header button)" : " (consultant plan)"}.
                </p>
                <label className="mt-3 block">
                  <span className="sr-only">Choose file</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                    className="block w-full text-[13px] text-ink-muted file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-on-accent"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void runFileDryRun(f);
                    }}
                  />
                </label>
                <p className="mt-2 text-[11px] text-ink-muted">
                  Supported formats: XLSX, CSV, XLS. Maximum file size: 10MB. Validation
                  happens on upload.
                  {uploadName ? (
                    <>
                      {" "}
                      Selected: <span className="font-data text-ink">{uploadName}</span>
                    </>
                  ) : (
                    " No file chosen."
                  )}
                </p>

                {diff ? (
                  <div className="mt-4 border-t border-rule pt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Dry-run diff
                    </p>
                    <ul className="mt-3 max-h-80 overflow-y-auto text-[12px]">
                      {diff.map((r, i) => (
                        <li
                          key={`${r.metricKey}-${i}`}
                          className={cn(
                            "border-b border-rule py-2 font-data",
                            r.kind === "rejected" && "text-rust",
                            r.kind === "added" && "text-signal",
                            r.kind === "changed" && "text-amber",
                          )}
                        >
                          <span className="uppercase">{r.kind}</span> · {r.metricKey}
                          {r.reason ? ` — ${r.reason}` : null}
                          {r.after
                            ? ` → ${r.after.value ?? "∅"} (${r.after.quality})`
                            : null}
                        </li>
                      ))}
                    </ul>
                    <Button
                      type="button"
                      className="mt-4"
                      size="sm"
                      disabled={!canWrite || periodLocked}
                      onClick={() => void commitDiff()}
                    >
                      Upload and validate
                    </Button>
                  </div>
                ) : null}
              </section>
            </div>
          )}
        </div>
      </div>

      {historyTarget ? (
        <DatapointVersionHistory
          datapointId={historyTarget.id}
          metricLabel={historyTarget.label}
          open={Boolean(historyTarget)}
          onOpenChange={(open) => {
            if (!open) setHistoryTarget(null);
          }}
          canWrite={canWrite}
          periodLocked={periodLocked}
          onRestored={(restored) => {
            setRows((prev) =>
              prev.map((r) =>
                r.id === restored.id || r.metricKey === historyTarget.metricKey
                  ? {
                      ...r,
                      id: restored.id,
                      value: restored.value,
                      quality: restored.quality as Quality,
                      unit: restored.unit,
                      approvalState: restored.approvalState,
                    }
                  : r,
              ),
            );
            setStatusTone("ok");
            setStatus(`Restored ${historyTarget.label} from prior version.`);
          }}
        />
      ) : null}

      {lineageTarget ? (
        <DatapointLineagePanel
          datapointId={lineageTarget.id}
          metricLabel={lineageTarget.label}
          open={Boolean(lineageTarget)}
          onOpenChange={(open) => {
            if (!open) setLineageTarget(null);
          }}
        />
      ) : null}

      {canBulkActions ? (
        <BulkCsvUpdateModal
          open={bulkUpdateOpen}
          onOpenChange={setBulkUpdateOpen}
          canWrite={canWrite}
          periodLocked={periodLocked}
          onApplied={() => {
            setStatusTone("ok");
            setStatus("Bulk CSV update applied. Reloading…");
            window.location.reload();
          }}
        />
      ) : null}
    </div>
  );
}
