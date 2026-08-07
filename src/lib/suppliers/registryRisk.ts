/**
 * Public-registry risk enrichment — Feature Y08.
 *
 * Pure. Zero I/O. Documented flags only, entered by an operator or imported
 * from a CSV of publicly available registry data (e.g. the SBTi companies
 * "taking action" list, a regulator's public enforcement register). This
 * module NEVER invents a numeric risk score — it only carries and labels the
 * flags an operator has already sourced. It is intentionally separate from
 * `riskFormula.ts` (the locked, unit-tested internal ESG risk score) so the
 * two are never confused.
 */

export const SBTI_STATUSES = ["committed", "targets_set", "none", "unknown"] as const;
export type SbtiStatus = (typeof SBTI_STATUSES)[number];

/** Tri-state: true (flagged), false (checked, clear), or "unknown" (not checked). */
export type EnforcementFlag = boolean | "unknown";

export interface RegistryRiskFlags {
  sbtiStatus: SbtiStatus;
  enforcementFlag: EnforcementFlag;
  /** One entry per source registry/URL the flags were drawn from. */
  sources: string[];
  notes: string | null;
  /** When the flags were last checked against the source(s). */
  lastReviewedAt: string | null;
}

export function isSbtiStatus(value: unknown): value is SbtiStatus {
  return (
    typeof value === "string" && (SBTI_STATUSES as readonly string[]).includes(value)
  );
}

/** Parses the Payload select string ("true" | "false" | "unknown") into the tri-state type. */
export function parseEnforcementFlag(value: unknown): EnforcementFlag {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return "unknown";
}

/** Serialises the tri-state type back to the Payload select string value. */
export function serializeEnforcementFlag(
  flag: EnforcementFlag,
): "true" | "false" | "unknown" {
  if (flag === true) return "true";
  if (flag === false) return "false";
  return "unknown";
}

export const SBTI_STATUS_LABELS: Record<SbtiStatus, string> = {
  committed: "SBTi committed",
  targets_set: "SBTi targets set",
  none: "No SBTi commitment on record",
  unknown: "SBTi status unknown",
};

export function describeSbtiStatus(status: SbtiStatus): string {
  return SBTI_STATUS_LABELS[status];
}

export function describeEnforcementFlag(flag: EnforcementFlag): string {
  if (flag === true) return "Known public enforcement action";
  if (flag === false) return "Checked — no known enforcement action";
  return "Not checked against a public register";
}

/**
 * Whether the flags, taken together, warrant operator attention.
 * Deliberately coarse and documented — a boolean signal, never a score.
 * True only when there is a known enforcement action, or SBTi status is
 * explicitly "none" (checked and found absent) — "unknown" is never treated
 * as a concern, since that would silently invent a judgement from missing data.
 */
export function isRegistryRiskConcern(
  flags: Pick<RegistryRiskFlags, "sbtiStatus" | "enforcementFlag">,
): boolean {
  return flags.enforcementFlag === true || flags.sbtiStatus === "none";
}

export function emptyRegistryRiskFlags(): RegistryRiskFlags {
  return {
    sbtiStatus: "unknown",
    enforcementFlag: "unknown",
    sources: [],
    notes: null,
    lastReviewedAt: null,
  };
}

/** Splits the textarea "one source per line" storage format into a clean list. */
export function parseSourcesText(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function sourcesToText(sources: string[]): string {
  return sources.join("\n");
}

export interface RegistryRiskCsvRow {
  rowNumber: number;
  /** Matches a supplier by exact id, or case-insensitive exact name when id is absent. */
  supplierId: string | null;
  supplierName: string | null;
  sbtiStatus: SbtiStatus;
  enforcementFlag: EnforcementFlag;
  sources: string[];
  notes: string | null;
}

export interface RegistryRiskCsvError {
  rowNumber: number;
  field: string;
  value: unknown;
  error: string;
}

export interface RegistryRiskCsvParseResult {
  valid: boolean;
  rows: RegistryRiskCsvRow[];
  errors: RegistryRiskCsvError[];
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

function headerIndex(headers: string[], aliases: string[]): number {
  const normalised = headers.map((h) => h.toLowerCase().replace(/[\s-]+/g, "_"));
  for (const alias of aliases) {
    const idx = normalised.indexOf(alias);
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseSbtiCell(raw: string): SbtiStatus {
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (isSbtiStatus(key)) return key;
  return "unknown";
}

function parseEnforcementCell(raw: string): EnforcementFlag {
  const key = raw.trim().toLowerCase();
  if (["true", "yes", "y", "1", "flagged"].includes(key)) return true;
  if (["false", "no", "n", "0", "clear"].includes(key)) return false;
  return "unknown";
}

/**
 * Parses an operator-supplied CSV of public-registry flags.
 * Required columns: supplier_id or supplier_name. Optional: sbti_status,
 * enforcement_flag, sources (semicolon-separated), notes.
 * Unknown / missing cells resolve to "unknown" — never invented as true/false.
 */
export function parseRegistryRiskCsv(csvContent: string): RegistryRiskCsvParseResult {
  const lines = csvContent
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      valid: false,
      rows: [],
      errors: [
        {
          rowNumber: 1,
          field: "csv",
          value: "",
          error: "CSV must include a header row and at least one data row",
        },
      ],
    };
  }

  const headers = splitCsvLine(lines[0]!);
  const col = {
    supplierId: headerIndex(headers, ["supplier_id", "id"]),
    supplierName: headerIndex(headers, ["supplier_name", "name", "supplier"]),
    sbtiStatus: headerIndex(headers, ["sbti_status", "sbti"]),
    enforcementFlag: headerIndex(headers, ["enforcement_flag", "enforcement"]),
    sources: headerIndex(headers, ["sources", "source"]),
    notes: headerIndex(headers, ["notes", "note"]),
  };

  if (col.supplierId < 0 && col.supplierName < 0) {
    return {
      valid: false,
      rows: [],
      errors: [
        {
          rowNumber: 1,
          field: "supplier_id",
          value: null,
          error: "CSV must include supplier_id or supplier_name",
        },
      ],
    };
  }

  const rows: RegistryRiskCsvRow[] = [];
  const errors: RegistryRiskCsvError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowNumber = i + 1;
    const cells = splitCsvLine(lines[i]!);
    const cell = (idx: number): string => (idx >= 0 ? (cells[idx] ?? "").trim() : "");

    const supplierId = cell(col.supplierId) || null;
    const supplierName = cell(col.supplierName) || null;

    if (!supplierId && !supplierName) {
      errors.push({
        rowNumber,
        field: "supplier_id",
        value: null,
        error: "Row is missing supplier_id and supplier_name",
      });
      continue;
    }

    const sourcesRaw = cell(col.sources);
    rows.push({
      rowNumber,
      supplierId,
      supplierName,
      sbtiStatus: col.sbtiStatus >= 0 ? parseSbtiCell(cell(col.sbtiStatus)) : "unknown",
      enforcementFlag:
        col.enforcementFlag >= 0
          ? parseEnforcementCell(cell(col.enforcementFlag))
          : "unknown",
      sources: sourcesRaw
        ? sourcesRaw
            .split(";")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      notes: cell(col.notes) || null,
    });
  }

  return { valid: errors.length === 0, rows, errors };
}
