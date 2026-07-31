import type { Quality } from "@/lib/calc";

import { DATA_METRIC_BY_KEY, QUALITY_VALUES } from "./metrics";

/** One raw row from a bulk-update CSV (id-match, not create-by-metric). */
export type BulkUpdateCsvRow = {
  datapointId: string;
  newValue: string;
  reason?: string;
  quality?: string;
  unit?: string;
};

export type ExistingDatapointById = {
  id: string;
  metricKey: string;
  value: number | null;
  unit: string | null;
  quality: Quality;
  approvalState?: string | null;
};

export type BulkUpdateDiffKind = "changed" | "unchanged" | "rejected";

export type BulkUpdatePreviewRow = {
  kind: BulkUpdateDiffKind;
  datapointId: string;
  metricKey: string;
  reason?: string;
  changeReason?: string;
  before?: { value: number | null; quality: Quality; unit: string | null };
  after?: { value: number | null; quality: Quality; unit: string | null };
};

export type BulkUpdatePreview = {
  rows: BulkUpdatePreviewRow[];
  validated: number;
  changed: number;
  unchanged: number;
  rejected: number;
  periodLocked: boolean;
};

/** Proposed writes stored on a pending bulk-operation for apply. */
export type BulkUpdateApplyRow = {
  datapointId: string;
  metricKey: string;
  value: number | null;
  quality: Quality;
  unit: string | null;
  reason: string | null;
};

export type BulkUpdateChangesPayload = {
  kind: "csv-value-update";
  rows: BulkUpdateApplyRow[];
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function normalizeHeader(h: string): keyof BulkUpdateCsvRow | null {
  const key = h.toLowerCase().replace(/\s+/g, "").replace(/-/g, "_");
  const map: Record<string, keyof BulkUpdateCsvRow> = {
    datapoint_id: "datapointId",
    datapointid: "datapointId",
    id: "datapointId",
    new_value: "newValue",
    newvalue: "newValue",
    value: "newValue",
    reason: "reason",
    quality: "quality",
    unit: "unit",
  };
  return map[key] ?? null;
}

function parseValue(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const trimmed = String(raw).trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : Number.NaN;
}

function parseQuality(raw: string | null | undefined): Quality | null {
  if (!raw || !raw.trim()) return null;
  const q = raw.trim().toLowerCase() as Quality;
  return QUALITY_VALUES.includes(q) ? q : null;
}

/**
 * Parse bulk-update CSV text. Header row required.
 * Expected columns: datapoint_id, new_value [, reason, quality, unit]
 */
export function parseBulkUpdateCsv(text: string): BulkUpdateCsvRow[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const mapped = headers.map(normalizeHeader);
  if (!mapped.includes("datapointId") || !mapped.includes("newValue")) {
    throw new Error(
      "CSV must include datapoint_id and new_value columns (header row required)",
    );
  }

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: BulkUpdateCsvRow = { datapointId: "", newValue: "" };
    mapped.forEach((field, i) => {
      if (!field) return;
      const cell = cells[i] ?? "";
      if (field === "datapointId") row.datapointId = cell.trim();
      else if (field === "newValue") row.newValue = cell.trim();
      else if (field === "reason") row.reason = cell.trim() || undefined;
      else if (field === "quality") row.quality = cell.trim() || undefined;
      else if (field === "unit") row.unit = cell.trim() || undefined;
    });
    return row;
  });
}

export function isBulkUpdateChangesPayload(
  value: unknown,
): value is BulkUpdateChangesPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  if (obj.kind !== "csv-value-update" || !Array.isArray(obj.rows)) return false;
  return obj.rows.every((row) => {
    if (typeof row !== "object" || row === null) return false;
    const r = row as Record<string, unknown>;
    return (
      typeof r.datapointId === "string" &&
      typeof r.metricKey === "string" &&
      (typeof r.value === "number" || r.value === null) &&
      typeof r.quality === "string" &&
      (typeof r.unit === "string" || r.unit === null) &&
      (typeof r.reason === "string" || r.reason === null)
    );
  });
}

/**
 * Validate CSV rows against existing datapoints by id.
 * Does not create rows — missing ids are rejected.
 */
export function previewBulkUpdate(opts: {
  rows: BulkUpdateCsvRow[];
  existing: ExistingDatapointById[];
  periodLocked: boolean;
}): BulkUpdatePreview {
  const byId = new Map(opts.existing.map((e) => [e.id, e]));
  const seen = new Set<string>();
  const diffs: BulkUpdatePreviewRow[] = [];

  if (opts.periodLocked) {
    for (const row of opts.rows) {
      const id = row.datapointId.trim();
      const existing = byId.get(id);
      diffs.push({
        kind: "rejected",
        datapointId: id || "(blank)",
        metricKey: existing?.metricKey ?? "",
        reason: "Reporting period is locked or published. Writes are refused.",
      });
    }
    return summarise(diffs, true);
  }

  for (const row of opts.rows) {
    const datapointId = row.datapointId.trim();
    if (!datapointId) {
      diffs.push({
        kind: "rejected",
        datapointId: "(blank)",
        metricKey: "",
        reason: "datapoint_id is required",
      });
      continue;
    }

    if (seen.has(datapointId)) {
      diffs.push({
        kind: "rejected",
        datapointId,
        metricKey: byId.get(datapointId)?.metricKey ?? "",
        reason: "Duplicate datapoint_id in CSV",
      });
      continue;
    }
    seen.add(datapointId);

    const prev = byId.get(datapointId);
    if (!prev) {
      diffs.push({
        kind: "rejected",
        datapointId,
        metricKey: "",
        reason: "Datapoint not found in this organisation",
      });
      continue;
    }

    let quality: Quality = prev.quality;
    if (row.quality !== undefined && row.quality !== "") {
      const parsed = parseQuality(row.quality);
      if (!parsed) {
        diffs.push({
          kind: "rejected",
          datapointId,
          metricKey: prev.metricKey,
          reason: `quality must be one of: ${QUALITY_VALUES.join(" / ")}`,
        });
        continue;
      }
      quality = parsed;
    }

    const value = parseValue(row.newValue);
    if (Number.isNaN(value)) {
      diffs.push({
        kind: "rejected",
        datapointId,
        metricKey: prev.metricKey,
        reason: "new_value is not a number",
      });
      continue;
    }

    if (quality === "missing" && value !== null) {
      diffs.push({
        kind: "rejected",
        datapointId,
        metricKey: prev.metricKey,
        reason: "quality missing must have empty value (missing ≠ zero)",
      });
      continue;
    }

    const def = DATA_METRIC_BY_KEY[prev.metricKey];
    if (quality !== "missing" && value === null && def?.inputType === "number") {
      diffs.push({
        kind: "rejected",
        datapointId,
        metricKey: prev.metricKey,
        reason: "non-missing quality requires a numeric value",
      });
      continue;
    }

    let unit = prev.unit;
    if (row.unit !== undefined && row.unit !== "") {
      const nextUnit = row.unit.trim() || null;
      if (def?.unit && nextUnit && nextUnit !== def.unit) {
        diffs.push({
          kind: "rejected",
          datapointId,
          metricKey: prev.metricKey,
          reason: `unit must be ${def.unit} (got ${nextUnit})`,
        });
        continue;
      }
      unit = nextUnit ?? def?.unit ?? null;
    }

    const after = {
      value: quality === "missing" ? null : value,
      quality,
      unit: unit ?? def?.unit ?? null,
    };
    const before = {
      value: prev.value,
      quality: prev.quality,
      unit: prev.unit,
    };
    const changeReason = row.reason?.trim() || undefined;

    const same =
      before.value === after.value &&
      before.quality === after.quality &&
      (before.unit ?? null) === (after.unit ?? null);

    if (same) {
      diffs.push({
        kind: "unchanged",
        datapointId,
        metricKey: prev.metricKey,
        before,
        after,
        changeReason,
      });
    } else {
      diffs.push({
        kind: "changed",
        datapointId,
        metricKey: prev.metricKey,
        before,
        after,
        changeReason,
      });
    }
  }

  return summarise(diffs, false);
}

/** Build apply payload from preview rows that will change. */
export function applyRowsFromPreview(preview: BulkUpdatePreview): BulkUpdateApplyRow[] {
  return preview.rows
    .filter((r) => r.kind === "changed" && r.after)
    .map((r) => ({
      datapointId: r.datapointId,
      metricKey: r.metricKey,
      value: r.after!.value,
      quality: r.after!.quality,
      unit: r.after!.unit,
      reason: r.changeReason ?? null,
    }));
}

function summarise(
  rows: BulkUpdatePreviewRow[],
  periodLocked: boolean,
): BulkUpdatePreview {
  return {
    rows,
    validated: rows.filter((r) => r.kind !== "rejected").length,
    changed: rows.filter((r) => r.kind === "changed").length,
    unchanged: rows.filter((r) => r.kind === "unchanged").length,
    rejected: rows.filter((r) => r.kind === "rejected").length,
    periodLocked,
  };
}
