import type { Quality } from "@/lib/calc";

import { DATA_METRIC_BY_KEY, QUALITY_VALUES, type ImportColumn } from "./metrics";

export type ImportRowInput = {
  metricKey?: string;
  label?: string;
  value?: string | number | null;
  unit?: string | null;
  period?: string | null;
  quality?: string | null;
  evidenceRef?: string | null;
  note?: string | null;
  frameworkCell?: string | null;
  assignee?: string | null;
};

export type ExistingDatapoint = {
  metricKey: string;
  value: number | null;
  unit: string | null;
  quality: Quality;
  approvalState?: string | null;
};

export type DiffKind = "added" | "changed" | "unchanged" | "rejected";

export type DiffRow = {
  kind: DiffKind;
  metricKey: string;
  reason?: string;
  before?: { value: number | null; quality: Quality; unit: string | null };
  after?: { value: number | null; quality: Quality; unit: string | null };
};

export type DryRunResult = {
  rows: DiffRow[];
  added: number;
  changed: number;
  unchanged: number;
  rejected: number;
  periodLocked: boolean;
};

function parseValue(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const trimmed = String(raw).trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : Number.NaN;
}

function parseQuality(raw: string | null | undefined): Quality | null {
  if (!raw) return null;
  const q = raw.trim().toLowerCase() as Quality;
  return QUALITY_VALUES.includes(q) ? q : null;
}

/**
 * One validation layer for xlsx, csv, and bulk clipboard paste.
 * Never silently coerces. Missing stays missing.
 */
export function dryRunImport(opts: {
  rows: ImportRowInput[];
  existing: ExistingDatapoint[];
  periodLocked: boolean;
  allowedColumns?: ImportColumn[];
}): DryRunResult {
  const existingByKey = new Map(opts.existing.map((e) => [e.metricKey, e]));
  const diffs: DiffRow[] = [];

  if (opts.periodLocked) {
    for (const row of opts.rows) {
      const key = row.metricKey?.trim() ?? "";
      diffs.push({
        kind: "rejected",
        metricKey: key || "(blank)",
        reason: "Reporting period is locked or published. Writes are refused.",
      });
    }
    return summarise(diffs, true);
  }

  for (const row of opts.rows) {
    const metricKey = row.metricKey?.trim() ?? "";
    if (!metricKey) {
      diffs.push({
        kind: "rejected",
        metricKey: "(blank)",
        reason: "metricKey is required",
      });
      continue;
    }

    const def = DATA_METRIC_BY_KEY[metricKey];
    if (!def) {
      diffs.push({
        kind: "rejected",
        metricKey,
        reason: "Unknown metric key",
      });
      continue;
    }

    const quality = parseQuality(row.quality ?? undefined);
    if (!quality) {
      diffs.push({
        kind: "rejected",
        metricKey,
        reason: `quality must be one of: ${QUALITY_VALUES.join(" / ")}`,
      });
      continue;
    }

    const value = parseValue(row.value);
    if (Number.isNaN(value)) {
      diffs.push({
        kind: "rejected",
        metricKey,
        reason: "value is not a number",
      });
      continue;
    }

    if (quality === "missing" && value !== null) {
      diffs.push({
        kind: "rejected",
        metricKey,
        reason: "quality missing must have empty value (missing ≠ zero)",
      });
      continue;
    }

    if (quality !== "missing" && value === null && def.inputType === "number") {
      diffs.push({
        kind: "rejected",
        metricKey,
        reason: "non-missing quality requires a numeric value",
      });
      continue;
    }

    const unit = (row.unit ?? def.unit ?? "").toString().trim() || null;
    if (def.unit && unit && unit !== def.unit) {
      diffs.push({
        kind: "rejected",
        metricKey,
        reason: `unit must be ${def.unit} (got ${unit})`,
      });
      continue;
    }

    const prev = existingByKey.get(metricKey);
    const after = {
      value: quality === "missing" ? null : value,
      quality,
      unit: unit ?? def.unit,
    };

    if (!prev) {
      diffs.push({ kind: "added", metricKey, after });
      continue;
    }

    const same =
      prev.value === after.value &&
      prev.quality === after.quality &&
      (prev.unit ?? null) === (after.unit ?? null);

    if (same) {
      diffs.push({
        kind: "unchanged",
        metricKey,
        before: {
          value: prev.value,
          quality: prev.quality,
          unit: prev.unit,
        },
        after,
      });
    } else {
      diffs.push({
        kind: "changed",
        metricKey,
        before: {
          value: prev.value,
          quality: prev.quality,
          unit: prev.unit,
        },
        after,
      });
    }
  }

  return summarise(diffs, false);
}

function summarise(rows: DiffRow[], periodLocked: boolean): DryRunResult {
  return {
    rows,
    added: rows.filter((r) => r.kind === "added").length,
    changed: rows.filter((r) => r.kind === "changed").length,
    unchanged: rows.filter((r) => r.kind === "unchanged").length,
    rejected: rows.filter((r) => r.kind === "rejected").length,
    periodLocked,
  };
}

/** Parse CSV text into import rows (header row required). */
export function parseCsvToImportRows(text: string): ImportRowInput[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: ImportRowInput = {};
    headers.forEach((h, i) => {
      const key = normalizeHeader(h);
      if (key) (row as Record<string, string>)[key] = cells[i] ?? "";
    });
    return row;
  });
}

function normalizeHeader(h: string): keyof ImportRowInput | null {
  const map: Record<string, keyof ImportRowInput> = {
    metrickey: "metricKey",
    metric_key: "metricKey",
    key: "metricKey",
    label: "label",
    value: "value",
    unit: "unit",
    period: "period",
    quality: "quality",
    evidenceref: "evidenceRef",
    evidence_ref: "evidenceRef",
    note: "note",
    frameworkcell: "frameworkCell",
    framework_cell: "frameworkCell",
    assignee: "assignee",
  };
  return map[h.toLowerCase().replace(/\s+/g, "")] ?? null;
}

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
