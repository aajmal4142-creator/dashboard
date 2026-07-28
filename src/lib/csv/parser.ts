/**
 * CSV Parser for emissions data import
 * Supports CSRD, BRSR, and custom formats with comprehensive validation
 */

export interface CSVParseError {
  lineNumber: number;
  field: string;
  value: string;
  message: string;
}

export interface ParsedDatapoint {
  metricKey: string;
  value: number | null;
  unit: string | null;
  quality: "measured" | "calculated" | "estimated" | "missing";
  evidenceRef?: string;
  note?: string;
  frameworkCell?: string;
  supplierKey?: string;
  lineNumber: number;
}

export interface CSVParseResult {
  datapoints: ParsedDatapoint[];
  errors: CSVParseError[];
  summary: {
    totalLines: number;
    successCount: number;
    errorCount: number;
    duplicateMetrics: string[];
  };
}

export type CSVFormat = "auto" | "csrd" | "brsr" | "custom";

interface FormatMapper {
  metricKey: string[];
  value: string[];
  unit: string[];
  quality: string[];
  evidenceRef: string[];
  note: string[];
  frameworkCell: string[];
  supplierKey: string[];
}

const CSRD_FORMAT: FormatMapper = {
  metricKey: ["metric_key", "metrickey", "indicator_code"],
  value: ["value", "amount", "quantity"],
  unit: ["unit", "uom", "measurement_unit"],
  quality: ["quality", "data_quality", "confidence"],
  evidenceRef: ["evidence_ref", "evidence_reference", "document_ref"],
  note: ["note", "comment", "remarks"],
  frameworkCell: ["cell", "framework_cell", "csrd_cell"],
  supplierKey: ["supplier", "supplier_key", "vendor"],
};

const BRSR_FORMAT: FormatMapper = {
  metricKey: ["metric_key", "metrickey", "principle", "principle_indicator"],
  value: ["value", "amount", "reported_value"],
  unit: ["unit", "uom"],
  quality: ["quality", "assurance_type"],
  evidenceRef: ["evidence_ref", "evidence_link"],
  note: ["note", "comments"],
  frameworkCell: ["principle_cell", "framework_cell", "disclosure_point"],
  supplierKey: ["entity", "entity_key"],
};

function selectFormatter(format: CSVFormat, headers: string[]): FormatMapper {
  const normalized = headers.map((h) => h.toLowerCase().replace(/\s+/g, ""));

  // Auto-detect based on headers
  if (format === "auto") {
    const hasCsrdHeaders = normalized.some(
      (h) => h.includes("csrd") || h.includes("indicator"),
    );
    const hasBrsrHeaders = normalized.some(
      (h) => h.includes("brsr") || h.includes("principle"),
    );

    if (hasBrsrHeaders) return BRSR_FORMAT;
    if (hasCsrdHeaders) return CSRD_FORMAT;
  }

  if (format === "brsr") return BRSR_FORMAT;
  if (format === "csrd") return CSRD_FORMAT;

  return CSRD_FORMAT; // Default fallback
}

function findColumn(headers: string[], aliases: string[]): number {
  const normalized = aliases.map((a) => a.toLowerCase().replace(/\s+/g, ""));
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]!.toLowerCase().replace(/\s+/g, "");
    if (normalized.includes(h)) return i;
  }
  return -1;
}

function parseValue(raw: string | undefined): number | null {
  if (!raw || raw.trim() === "") return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : null;
}

function parseQuality(
  raw: string | undefined,
): "measured" | "calculated" | "estimated" | "missing" | null {
  if (!raw) return null;
  const q = raw.trim().toLowerCase();
  if (["measured", "calculated", "estimated", "missing"].includes(q)) {
    return q as "measured" | "calculated" | "estimated" | "missing";
  }
  // Map common variations
  if (q === "metered" || q === "actual") return "measured";
  if (q === "computed" || q === "derived") return "calculated";
  if (q === "assumed" || q === "forecasted") return "estimated";
  if (q === "n/a" || q === "not_applicable") return "missing";
  return null;
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
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function parseCSV(csvContent: string, format: CSVFormat = "auto"): CSVParseResult {
  const lines = csvContent
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      datapoints: [],
      errors: [
        {
          lineNumber: 1,
          field: "csv",
          value: "",
          message: "CSV must have header row and at least one data row",
        },
      ],
      summary: {
        totalLines: lines.length,
        successCount: 0,
        errorCount: 1,
        duplicateMetrics: [],
      },
    };
  }

  const headers = splitCsvLine(lines[0]!);
  const formatter = selectFormatter(format, headers);

  // Find column indices
  const keyCol = findColumn(headers, formatter.metricKey);
  const valCol = findColumn(headers, formatter.value);
  const unitCol = findColumn(headers, formatter.unit);
  const qualCol = findColumn(headers, formatter.quality);
  const evidCol = findColumn(headers, formatter.evidenceRef);
  const noteCol = findColumn(headers, formatter.note);
  const fwCol = findColumn(headers, formatter.frameworkCell);
  const supplierCol = findColumn(headers, formatter.supplierKey);

  if (keyCol === -1) {
    return {
      datapoints: [],
      errors: [
        {
          lineNumber: 1,
          field: "metricKey",
          value: "",
          message: `Could not find metric key column. Tried: ${formatter.metricKey.join(", ")}`,
        },
      ],
      summary: {
        totalLines: lines.length,
        successCount: 0,
        errorCount: 1,
        duplicateMetrics: [],
      },
    };
  }

  const datapoints: ParsedDatapoint[] = [];
  const errors: CSVParseError[] = [];
  const seenMetrics = new Set<string>();
  const duplicates = new Set<string>();

  for (let lineNum = 2; lineNum <= lines.length; lineNum++) {
    const line = lines[lineNum - 1]!;
    const cells = splitCsvLine(line);

    const metricKey = cells[keyCol]?.trim() ?? "";
    if (!metricKey) {
      errors.push({
        lineNumber: lineNum,
        field: "metricKey",
        value: "",
        message: "metricKey is required",
      });
      continue;
    }

    // Check for duplicates
    if (seenMetrics.has(metricKey)) {
      duplicates.add(metricKey);
    }
    seenMetrics.add(metricKey);

    const value = parseValue(cells[valCol]);
    const quality = parseQuality(cells[qualCol]);

    if (!quality) {
      errors.push({
        lineNumber: lineNum,
        field: "quality",
        value: cells[qualCol] ?? "",
        message: "quality must be one of: measured / calculated / estimated / missing",
      });
      continue;
    }

    // Validate missing quality constraint
    if (quality === "missing" && value !== null) {
      errors.push({
        lineNumber: lineNum,
        field: "value",
        value: String(value),
        message: "quality missing must have empty value (missing ≠ zero)",
      });
      continue;
    }

    datapoints.push({
      metricKey,
      value,
      unit: cells[unitCol]?.trim() ?? null,
      quality,
      evidenceRef: cells[evidCol]?.trim(),
      note: cells[noteCol]?.trim(),
      frameworkCell: cells[fwCol]?.trim(),
      supplierKey: cells[supplierCol]?.trim(),
      lineNumber: lineNum,
    });
  }

  return {
    datapoints,
    errors,
    summary: {
      totalLines: lines.length,
      successCount: datapoints.length,
      errorCount: errors.length,
      duplicateMetrics: Array.from(duplicates),
    },
  };
}

export function validateDatapoints(datapoints: ParsedDatapoint[]): CSVParseError[] {
  const errors: CSVParseError[] = [];
  const seenByKey = new Map<string, number>();

  for (const dp of datapoints) {
    // Check for duplicates within parse result
    if (seenByKey.has(dp.metricKey)) {
      errors.push({
        lineNumber: dp.lineNumber,
        field: "metricKey",
        value: dp.metricKey,
        message: `Duplicate metric key (also appears on line ${seenByKey.get(dp.metricKey)})`,
      });
    }
    seenByKey.set(dp.metricKey, dp.lineNumber);

    // Validate value ranges
    if (dp.value !== null && dp.value < 0) {
      errors.push({
        lineNumber: dp.lineNumber,
        field: "value",
        value: String(dp.value),
        message: "Negative values are not allowed",
      });
    }

    // Validate value bounds (>1e15 likely a data entry error)
    if (dp.value !== null && Math.abs(dp.value) > 1e15) {
      errors.push({
        lineNumber: dp.lineNumber,
        field: "value",
        value: String(dp.value),
        message: "Value exceeds reasonable bounds (>1e15)",
      });
    }
  }

  return errors;
}
