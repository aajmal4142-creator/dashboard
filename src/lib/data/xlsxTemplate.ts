import * as XLSX from "xlsx";

import {
  DATA_METRICS,
  IMPORT_COLUMNS,
  QUALITY_VALUES,
  type ImportColumn,
} from "./metrics";
import { parseCsvToImportRows, type ImportRowInput } from "./importValidate";

/**
 * Build a real .xlsx template (smart or blank).
 * No fake Excel data-validation dropdowns — Reference sheet holds allowed values.
 */
export function buildImportWorkbook(opts: {
  kind: "smart" | "blank";
  columns: ImportColumn[];
  periodLabel?: string;
}): ArrayBuffer {
  const cols = opts.columns.length > 0 ? opts.columns : [...IMPORT_COLUMNS];
  const wb = XLSX.utils.book_new();

  const headers = cols as string[];
  const dataRows: string[][] = [headers];

  if (opts.kind === "smart") {
    for (const m of DATA_METRICS) {
      const row = cols.map((c) => {
        switch (c) {
          case "metricKey":
            return m.key;
          case "label":
            return m.label;
          case "unit":
            return m.unit ?? "";
          case "quality":
            return "missing";
          case "value":
            return "";
          case "period":
            return opts.periodLabel ?? "";
          case "frameworkCell":
            return m.category;
          default:
            return "";
        }
      });
      dataRows.push(row);
    }
  }

  const dataSheet = XLSX.utils.aoa_to_sheet(dataRows);
  XLSX.utils.book_append_sheet(wb, dataSheet, "Data");

  const ref = XLSX.utils.aoa_to_sheet([
    ["Reference — allowed values (enter exactly)"],
    [],
    ["quality"],
    ...QUALITY_VALUES.map((q) => [q]),
    [],
    ["metricKey", "label", "unit"],
    ...DATA_METRICS.map((m) => [m.key, m.label, m.unit ?? ""]),
  ]);
  XLSX.utils.book_append_sheet(wb, ref, "Reference");

  const instructions = XLSX.utils.aoa_to_sheet([
    ["ClearESG data import template"],
    [],
    [
      "1. Enter values on the Data sheet. Do not rename metricKey rows on a smart template.",
    ],
    ["2. quality must be one of: measured / calculated / estimated / missing"],
    ["3. missing ≠ zero — leave value blank when quality is missing."],
    ["4. Units must match the Reference sheet. Bad units are rejected on upload."],
    [
      "5. Re-upload for a dry-run diff before commit. Unedited smart templates produce zero changes.",
    ],
    [
      "6. This file does not use Excel dropdown validation — the upload dry-run is the safety net.",
    ],
  ]);
  XLSX.utils.book_append_sheet(wb, instructions, "Instructions");

  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

export function parseWorkbookToImportRows(buffer: ArrayBuffer): ImportRowInput[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames.includes("Data") ? "Data" : wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  return rows.map((r) => ({
    metricKey: String(r.metricKey ?? r.metric_key ?? r.key ?? ""),
    label: String(r.label ?? ""),
    value: r.value === "" ? null : (r.value as string | number),
    unit: String(r.unit ?? ""),
    period: String(r.period ?? ""),
    quality: String(r.quality ?? ""),
    evidenceRef: String(r.evidenceRef ?? r.evidence_ref ?? ""),
    note: String(r.note ?? ""),
    frameworkCell: String(r.frameworkCell ?? r.framework_cell ?? ""),
    assignee: String(r.assignee ?? ""),
  }));
}

export function parseFileToImportRows(
  buffer: ArrayBuffer,
  filename: string,
): ImportRowInput[] {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) {
    const text = new TextDecoder("utf-8").decode(buffer);
    return parseCsvToImportRows(text);
  }
  return parseWorkbookToImportRows(buffer);
}
