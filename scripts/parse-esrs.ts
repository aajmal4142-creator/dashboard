/**
 * Phase 1c Step 2 — Parse ESRS IG 3 datapoints.
 *
 * Extract only. Never infer. Empty cell → null.
 * Confirmed layout: row 1 = instructions (skip), row 2 = header, data from row 3.
 * Sheets: ESRS 2 → G1. Skip Index.
 * ID = dpId.
 *
 * Addendum (Dec 2024) is a SEPARATE pass with its own diff log.
 * Do not run Step 3 from this script.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PDFParse } from "pdf-parse";
import * as XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const docsDir = path.join(root, "docs");
const dataDir = path.join(root, "data");

const WORKBOOK = path.join(docsDir, "EFRAG-IG3-datapoints.xlsx");
const ADDENDUM_PDF = path.join(docsDir, "EFRAG-IG3-addendum-2024-12.pdf");

const SHEETS_TO_PARSE = [
  "ESRS 2",
  "ESRS 2 MDR",
  "ESRS E1",
  "ESRS E2",
  "ESRS E3",
  "ESRS E4",
  "ESRS E5",
  "ESRS S1",
  "ESRS S2",
  "ESRS S3",
  "ESRS S4",
  "ESRS G1",
] as const;

/** Canonical header meanings — matched by substring against row-2 labels. */
const HEADER_MATCHERS = {
  id: (n: string) => n === "id",
  esrs: (n: string) => n === "esrs",
  dr: (n: string) => n === "dr",
  paragraph: (n: string) => n.startsWith("paragraph"),
  relatedAr: (n: string) => n.startsWith("related ar"),
  name: (n: string) => n === "name",
  dataType: (n: string) => n.startsWith("data type"),
  conditionalOrAlternative: (n: string) => n.includes("conditional or alternative"),
  mayV: (n: string) => n.startsWith("may") && n.includes("[v]"),
  appendixB: (n: string) => n.includes("appendix b"),
  phaseInUnder750: (n: string) => n.includes("appendix c") && n.includes("750"),
  phaseInAll: (n: string) =>
    n.includes("appendix c") &&
    (n.includes("all undertakings") || (n.includes("phased-in") && !n.includes("750"))),
} as const;

export interface EsrsDatapoint {
  dpId: string;
  standard: string | null;
  disclosureRequirement: string | null;
  paragraph: string | null;
  relatedAr: string | null;
  name: string | null;
  dataType: string | null;
  /** Verbatim cell from "Conditional or alternative DP". */
  conditionalOrAlternative: string | null;
  /** First-class flag: true if conditionalOrAlternative is non-empty, else null. */
  conditional: boolean | null;
  /** Verbatim May [V] cell. */
  mayVoluntaryRaw: string | null;
  /**
   * First-class voluntary flag from May [V].
   * true if cell non-empty; null if empty.
   * Simplified ESRS eliminates voluntary disclosures — drives validUntil later.
   */
  voluntary: boolean | null;
  /** Verbatim Appendix B - ESRS 2 (SFDR / Pillar 3 / Benchmark / CL). */
  appendixB: string | null;
  /** Verbatim Appendix C phase-in for undertakings <750 employees. */
  phaseInUnder750Employees: string | null;
  /** Verbatim Appendix C phase-in for all undertakings. */
  phaseInAllUndertakings: string | null;
  sourceSheet: string;
  sourceRow: number;
  rawCells: Record<string, string | null>;
  /** Present only when the row originates from / was touched by the addendum pass. */
  addendum?: {
    action: "added" | "amended" | "removed-reinstated";
    qaId: string | null;
    notes: string | null;
  };
}

type SkipReason =
  "missing_dp_id" | "header_row_repeated" | "empty_row" | "sheet_not_found";

type SkipLog = {
  reason: SkipReason;
  sourceSheet: string;
  sourceRow: number;
  detail?: string;
};

function cellToNullString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value)
    .replace(/\u00a0/g, " ")
    .trim();
  return text === "" ? null : text;
}

function normalizeHeaderLabel(label: string | null): string {
  if (!label) return "";
  return label
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Map workbook header cells to canonical keys.
 * Matching is by distinctive substrings — labels wrap across lines in the xlsx.
 */
function resolveHeaderIndexes(headerRow: unknown[]): Record<string, number> {
  const indexes: Record<string, number> = {};
  headerRow.forEach((cell, i) => {
    const n = normalizeHeaderLabel(cellToNullString(cell));
    if (!n) return;
    for (const [key, match] of Object.entries(HEADER_MATCHERS)) {
      if (match(n) && indexes[key] === undefined) {
        indexes[key] = i;
      }
    }
  });
  return indexes;
}

function buildRawCells(
  headerRow: unknown[],
  dataRow: unknown[],
): Record<string, string | null> {
  const raw: Record<string, string | null> = {};
  const width = Math.max(headerRow.length, dataRow.length);
  for (let i = 0; i < width; i++) {
    const key = cellToNullString(headerRow[i])?.replace(/\s+/g, " ") ?? `col_${i}`;
    raw[key] = cellToNullString(dataRow[i]);
  }
  return raw;
}

function flagFromNonEmpty(value: string | null): boolean | null {
  if (value === null) return null;
  return true;
}

function parseWorkbook(): {
  datapoints: EsrsDatapoint[];
  stats: { rowsRead: number; rowsEmitted: number; skips: SkipLog[] };
} {
  const readFile =
    XLSX.readFile ??
    (XLSX as { default?: { readFile: typeof XLSX.readFile } }).default?.readFile;
  const sheet_to_json =
    XLSX.utils?.sheet_to_json ??
    (XLSX as { default?: { utils: typeof XLSX.utils } }).default?.utils.sheet_to_json;

  if (!readFile || !sheet_to_json) {
    throw new Error("xlsx read helpers unavailable");
  }

  const workbook = readFile(WORKBOOK, { cellDates: true });
  const datapoints: EsrsDatapoint[] = [];
  const skips: SkipLog[] = [];
  let rowsRead = 0;

  for (const sheetName of SHEETS_TO_PARSE) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      skips.push({
        reason: "sheet_not_found",
        sourceSheet: sheetName,
        sourceRow: 0,
        detail: "Sheet missing from workbook",
      });
      continue;
    }

    const rows = sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      raw: false,
    });

    // Row 1 (index 0) = instructions — skip
    // Row 2 (index 1) = header
    const headerRow = rows[1] ?? [];
    const indexes = resolveHeaderIndexes(headerRow);

    if (indexes.id === undefined) {
      throw new Error(
        `Sheet "${sheetName}": could not locate ID column in row 2 header. Headers: ${JSON.stringify(headerRow)}`,
      );
    }

    for (let r = 2; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const sourceRow = r + 1; // 1-indexed Excel row
      rowsRead += 1;

      const allEmpty = row.every((c) => cellToNullString(c) === null);
      if (allEmpty) {
        skips.push({ reason: "empty_row", sourceSheet: sheetName, sourceRow });
        continue;
      }

      const dpId = cellToNullString(row[indexes.id]);
      if (!dpId) {
        skips.push({
          reason: "missing_dp_id",
          sourceSheet: sheetName,
          sourceRow,
          detail: "ID cell empty",
        });
        continue;
      }

      if (normalizeHeaderLabel(dpId) === "id") {
        skips.push({
          reason: "header_row_repeated",
          sourceSheet: sheetName,
          sourceRow,
        });
        continue;
      }

      const conditionalOrAlternative = cellToNullString(
        row[indexes.conditionalOrAlternative ?? -1],
      );
      const mayVoluntaryRaw = cellToNullString(row[indexes.mayV ?? -1]);

      datapoints.push({
        dpId,
        standard: cellToNullString(row[indexes.esrs ?? -1]),
        disclosureRequirement: cellToNullString(row[indexes.dr ?? -1]),
        paragraph: cellToNullString(row[indexes.paragraph ?? -1]),
        relatedAr: cellToNullString(row[indexes.relatedAr ?? -1]),
        name: cellToNullString(row[indexes.name ?? -1]),
        dataType: cellToNullString(row[indexes.dataType ?? -1]),
        conditionalOrAlternative,
        conditional: flagFromNonEmpty(conditionalOrAlternative),
        mayVoluntaryRaw,
        voluntary: flagFromNonEmpty(mayVoluntaryRaw),
        appendixB: cellToNullString(row[indexes.appendixB ?? -1]),
        phaseInUnder750Employees: cellToNullString(row[indexes.phaseInUnder750 ?? -1]),
        phaseInAllUndertakings: cellToNullString(row[indexes.phaseInAll ?? -1]),
        sourceSheet: sheetName,
        sourceRow,
        rawCells: buildRawCells(headerRow, row),
      });
    }
  }

  return {
    datapoints,
    stats: { rowsRead, rowsEmitted: datapoints.length, skips },
  };
}

function groupSkips(skips: SkipLog[]): Record<string, number> {
  const grouped: Record<string, number> = {};
  for (const s of skips) {
    grouped[s.reason] = (grouped[s.reason] ?? 0) + 1;
  }
  return grouped;
}

// ─── Addendum pass (separate) ───────────────────────────────────────────────

type AddendumDiffEntry = {
  action: "add" | "remove" | "amend" | "skipped";
  dpId: string;
  qaId: string | null;
  detail: string;
  applied: boolean;
  before?: Partial<EsrsDatapoint> | null;
  after?: Partial<EsrsDatapoint> | null;
};

type AddendumCorrection =
  | {
      kind: "add";
      qaId: string | null;
      dpId: string;
      standard: string | null;
      paragraph: string | null;
      relatedAr: string | null;
      name: string | null;
      dataType: string | null;
      conditionalOrAlternative: string | null;
      mayVoluntaryRaw: string | null;
      phaseIn: string | null;
      rawLine: string;
    }
  | { kind: "remove"; qaId: string | null; dpId: string; rawLine: string }
  | {
      kind: "amend";
      qaId: string | null;
      dpIds: string[];
      nature: string;
      oldVersion: string | null;
      adjustedVersion: string | null;
      rawLine: string;
    };

/**
 * Extract Table 1 / Table 2 operations from Addendum PDF text.
 * getTable() returned empty — text extraction is best-effort and every
 * unparseable line is logged, not silently invented.
 */
function extractAddendumCorrections(page2Text: string): {
  corrections: AddendumCorrection[];
  parseNotes: string[];
} {
  const corrections: AddendumCorrection[] = [];
  const parseNotes: string[] = [
    "PDF getTable() returned zero tables — using page-2 text extraction.",
  ];

  const lines = page2Text
    .split(/\n/)
    .map((l) => l.replace(/\u00a0/g, " ").trim())
    .filter(Boolean);

  // Join wrapped continuation lines that don't start with Added/Removed/Q&A pattern
  const joined: string[] = [];
  for (const line of lines) {
    const startsNew =
      /^(Added|Removed)\b/.test(line) ||
      /^\d{3,4}(\/\d{3,4})?\s+[A-Z0-9]/.test(line) ||
      /^(SBM-1_0[34]\*|G1-4_03|TABLE|Q&A|\* IDs)/.test(line);
    if (joined.length > 0 && !startsNew && !line.startsWith("Table 2")) {
      joined[joined.length - 1] = `${joined[joined.length - 1]} ${line}`;
    } else {
      joined.push(line);
    }
  }

  let inTable1 = false;
  let inTable2 = false;

  for (const line of joined) {
    if (line.includes("TABLE 1")) {
      inTable1 = true;
      inTable2 = false;
      continue;
    }
    if (line.includes("Table 2") || line.includes("TABLE 2")) {
      inTable1 = false;
      inTable2 = true;
      continue;
    }
    if (line.startsWith("* IDs amended")) {
      parseNotes.push(line);
      continue;
    }

    if (inTable1 && /^(Added|Removed)\b/.test(line)) {
      const removeMatch = line.match(/^Removed\s+(\d+)?\s*([A-Za-z0-9._*-]+)\s*$/);
      if (removeMatch) {
        corrections.push({
          kind: "remove",
          qaId: removeMatch[1] ?? null,
          dpId: removeMatch[2].replace(/\*$/, ""),
          rawLine: line,
        });
        continue;
      }

      // Added [qaId?] dpId ESRS paragraph... name dataType conditional? may? phase?
      const addedMatch = line.match(/^Added\s+(?:(\d+)\s+)?([A-Za-z0-9._*-]+)\s+(.+)$/);
      if (!addedMatch) {
        parseNotes.push(`Table 1 line not parsed: ${line}`);
        continue;
      }

      const qaId = addedMatch[1] ?? null;
      const dpId = addedMatch[2].replace(/\*$/, "");
      const rest = addedMatch[3].trim();

      // Trailing tokens often: DataType [Conditional|-] [-]
      // We keep name/fields as best-effort splits; anything uncertain stays in rawLine.
      const trailing = rest.match(
        /\s(Table\/volume|Semi-narrative|Narrative|Boolean|percent|Percentage|Intensity|Integer|Monetary|Decimal|Date|Mass|Volume|Area|Energy|GHG emission)\s*(Conditional(?:\/Alternative)?)?\s*-?\s*$/i,
      );

      let dataType: string | null = null;
      let conditionalOrAlternative: string | null = null;
      let body = rest;

      if (trailing) {
        dataType = trailing[1];
        conditionalOrAlternative = trailing[2] ?? null;
        body = rest.slice(0, trailing.index).trim();
      }

      // body starts with ESRS token then paragraph/AR/name — keep coarse fields
      const bodyParts = body.match(/^(ESRS 2|E1|E2|E3|E4|E5|S1|S2|S3|S4|G1)\s+(.+)$/);
      let standard: string | null = null;
      let remainder = body;
      if (bodyParts) {
        standard = bodyParts[1];
        remainder = bodyParts[2];
      }

      corrections.push({
        kind: "add",
        qaId,
        dpId,
        standard,
        paragraph: null,
        relatedAr: null,
        name: remainder || null,
        dataType,
        conditionalOrAlternative,
        mayVoluntaryRaw: null,
        phaseIn: null,
        rawLine: line,
      });
      parseNotes.push(
        `Table 1 add ${dpId}: paragraph/relatedAr left null — PDF text does not cleanly separate them from Name. Name field holds remaining verbatim text after standard.`,
      );
      continue;
    }

    if (inTable2) {
      // Skip header
      if (line.startsWith("Q&A ID")) continue;

      // G1-4_03 Moved to G1-3 (no Q&A prefix in text)
      if (/^G1-4_03\b/.test(line)) {
        corrections.push({
          kind: "amend",
          qaId: null,
          dpIds: ["G1-4_03"],
          nature: "Moved to G1-3",
          oldVersion: null,
          adjustedVersion: null,
          rawLine: line,
        });
        continue;
      }

      if (/^SBM-1_0[34]\*/.test(line)) {
        const m = line.match(/^(SBM-1_0[34])\*\s+(.+)$/);
        if (m) {
          const natureMatch = m[2].match(
            /^(.+?)\s+['‘]([^‘’']*)['’]\s+['‘]([^‘’']*)['’]\s*$/,
          );
          corrections.push({
            kind: "amend",
            qaId: null,
            dpIds: [m[1]],
            nature: natureMatch?.[1]?.trim() ?? m[2],
            oldVersion: natureMatch?.[2] ?? null,
            adjustedVersion: natureMatch?.[3] ?? null,
            rawLine: line,
          });
        }
        continue;
      }

      if (/^1379\b/.test(line)) {
        corrections.push({
          kind: "amend",
          qaId: "1379",
          dpIds: [],
          nature:
            "All MDR related DPs in G1 — moved to top of table (structural, not a field edit)",
          oldVersion: null,
          adjustedVersion: null,
          rawLine: line,
        });
        continue;
      }

      const amendMatch = line.match(
        /^(\d{3,4}(?:\/\d{3,4})?)\s+(.+?)\s+(Renamed(?: and classified as alternative)?|Change of AR reference|Change of data type|Change of paragraph reference|Classified as voluntary|Classified as mandatory|Classified as 'conditional\/alternative'|Classified as ‘conditional\/alternative’|Moved to G1-3)\s*(.*)$/i,
      );
      if (amendMatch) {
        const qaId = amendMatch[1];
        const dpPart = amendMatch[2].trim();
        const nature = `${amendMatch[3]} ${amendMatch[4]}`.trim();

        let dpIds: string[] = [];
        if (/through/i.test(dpPart)) {
          const range = dpPart.match(
            /([A-Za-z0-9._-]+_(\d+))\s+through\s+([A-Za-z0-9._-]+_(\d+))/i,
          );
          if (range) {
            const prefix = range[1].replace(/_\d+$/, "_");
            const from = Number(range[2]);
            const to = Number(range[4]);
            for (let n = from; n <= to; n++) {
              dpIds.push(`${prefix}${String(n).padStart(2, "0")}`);
            }
          } else {
            parseNotes.push(`Could not expand range: ${dpPart}`);
            dpIds = [dpPart];
          }
        } else if (dpPart.includes(" and ")) {
          dpIds = dpPart
            .split(/\s*,\s*|\s+and\s+/i)
            .map((s) => s.trim())
            .filter(Boolean);
        } else {
          dpIds = [dpPart.replace(/\*$/, "")];
        }

        // Try to pull quoted old/new (straight or curly quotes from the PDF)
        const quotes = [...nature.matchAll(/['‘’]([^‘’']*)['‘’]/g)].map((m) => m[1]);
        let oldVersion: string | null = null;
        let adjustedVersion: string | null = null;
        if (quotes.length >= 2) {
          oldVersion = quotes[0];
          adjustedVersion = quotes[1];
        } else {
          // Unquoted pairs e.g. "AR 5 No AR reference" / "Percentage Intensity" / "Mandatory Voluntary"
          const tail = amendMatch[4].trim();
          const known = [
            [/^AR 5\s+No AR reference$/i, "AR 5", "No AR reference"],
            [/^No AR reference\s+AR 5$/i, "No AR reference", "AR 5"],
            [/^AR 33\s+AR 34$/i, "AR 33", "AR 34"],
            [/^Percentage\s+Intensity$/i, "Percentage", "Intensity"],
            [/^Mandatory\s+Voluntary$/i, "Mandatory", "Voluntary"],
            [/^Voluntary\s+Mandatory$/i, "Voluntary", "Mandatory"],
            [
              /^Conditional\s+Conditional\/Alternative$/i,
              "Conditional",
              "Conditional/Alternative",
            ],
            [/^AR 46 d\s+Paragraph 51$/i, "AR 46 d", "Paragraph 51"],
            [/^AR 50\s+Paragraph 51$/i, "AR 50", "Paragraph 51"],
          ] as const;
          for (const [re, oldV, newV] of known) {
            if (re.test(tail)) {
              oldVersion = oldV;
              adjustedVersion = newV;
              break;
            }
          }
        }

        corrections.push({
          kind: "amend",
          qaId,
          dpIds,
          nature: amendMatch[3],
          oldVersion,
          adjustedVersion,
          rawLine: line,
        });
        continue;
      }

      if (inTable2 && !line.startsWith("Table 2") && line.length > 10) {
        parseNotes.push(`Table 2 line not parsed: ${line.slice(0, 200)}`);
      }
    }
  }

  return { corrections, parseNotes };
}

function applyAddendum(
  base: EsrsDatapoint[],
  page2Text: string,
): {
  datapoints: EsrsDatapoint[];
  diff: AddendumDiffEntry[];
  parseNotes: string[];
} {
  const { corrections, parseNotes } = extractAddendumCorrections(page2Text);
  const byId = new Map(base.map((d) => [d.dpId, { ...d }]));
  const diff: AddendumDiffEntry[] = [];

  for (const correction of corrections) {
    if (correction.kind === "remove") {
      const existing = byId.get(correction.dpId);
      if (!existing) {
        diff.push({
          action: "remove",
          dpId: correction.dpId,
          qaId: correction.qaId,
          detail: "DP not present in base workbook — nothing to remove",
          applied: false,
          before: null,
        });
        continue;
      }
      byId.delete(correction.dpId);
      diff.push({
        action: "remove",
        dpId: correction.dpId,
        qaId: correction.qaId,
        detail: "Removed per Addendum Table 1",
        applied: true,
        before: { dpId: existing.dpId, name: existing.name },
        after: null,
      });
      continue;
    }

    if (correction.kind === "add") {
      if (byId.has(correction.dpId)) {
        diff.push({
          action: "add",
          dpId: correction.dpId,
          qaId: correction.qaId,
          detail: "Already present in workbook — add skipped",
          applied: false,
        });
        continue;
      }

      const conditionalOrAlternative = correction.conditionalOrAlternative;
      const added: EsrsDatapoint = {
        dpId: correction.dpId,
        standard: correction.standard,
        disclosureRequirement: null,
        paragraph: correction.paragraph,
        relatedAr: correction.relatedAr,
        name: correction.name,
        dataType: correction.dataType,
        conditionalOrAlternative,
        conditional: flagFromNonEmpty(conditionalOrAlternative),
        mayVoluntaryRaw: correction.mayVoluntaryRaw,
        voluntary: flagFromNonEmpty(correction.mayVoluntaryRaw),
        appendixB: null,
        phaseInUnder750Employees: correction.phaseIn,
        phaseInAllUndertakings: null,
        sourceSheet: "Addendum-2024-12",
        sourceRow: 0,
        rawCells: { addendumRawLine: correction.rawLine },
        addendum: {
          action: "added",
          qaId: correction.qaId,
          notes:
            "Added from Addendum Table 1 text extract. paragraph/relatedAr/DR may be null — PDF text boundaries were ambiguous.",
        },
      };
      byId.set(correction.dpId, added);
      diff.push({
        action: "add",
        dpId: correction.dpId,
        qaId: correction.qaId,
        detail: "Added from Addendum Table 1",
        applied: true,
        after: {
          dpId: added.dpId,
          name: added.name,
          dataType: added.dataType,
          standard: added.standard,
        },
      });
      continue;
    }

    // amend
    if (correction.dpIds.length === 0) {
      diff.push({
        action: "skipped",
        dpId: "(structural)",
        qaId: correction.qaId,
        detail: correction.nature,
        applied: false,
      });
      continue;
    }

    for (const dpId of correction.dpIds) {
      const existing = byId.get(dpId);
      if (!existing) {
        diff.push({
          action: "amend",
          dpId,
          qaId: correction.qaId,
          detail: `Target DP not in dataset — ${correction.nature}`,
          applied: false,
        });
        continue;
      }

      const before = {
        name: existing.name,
        relatedAr: existing.relatedAr,
        paragraph: existing.paragraph,
        dataType: existing.dataType,
        voluntary: existing.voluntary,
        mayVoluntaryRaw: existing.mayVoluntaryRaw,
        conditionalOrAlternative: existing.conditionalOrAlternative,
        conditional: existing.conditional,
      };

      const nature = correction.nature.toLowerCase();
      let applied = false;

      if (nature.includes("renamed") && correction.adjustedVersion) {
        existing.name = correction.adjustedVersion;
        applied = true;
      }
      if (nature.includes("change of ar reference")) {
        existing.relatedAr =
          correction.adjustedVersion === "No AR reference"
            ? null
            : correction.adjustedVersion;
        applied = true;
      }
      if (nature.includes("change of data type") && correction.adjustedVersion) {
        existing.dataType = correction.adjustedVersion;
        applied = true;
      }
      if (
        nature.includes("change of paragraph reference") &&
        correction.adjustedVersion
      ) {
        // Addendum says old was AR ref wrongly stored; adjusted is Paragraph N
        existing.paragraph = correction.adjustedVersion.replace(/^Paragraph\s+/i, "");
        applied = true;
      }
      if (nature.includes("classified as voluntary")) {
        existing.voluntary = true;
        existing.mayVoluntaryRaw = "V";
        applied = true;
      }
      if (nature.includes("classified as mandatory")) {
        existing.voluntary = null;
        existing.mayVoluntaryRaw = null;
        applied = true;
      }
      if (nature.includes("conditional")) {
        existing.conditionalOrAlternative =
          correction.adjustedVersion ?? "Conditional/Alternative";
        existing.conditional = true;
        applied = true;
      }
      if (nature.includes("moved to")) {
        // Structural move — record in addendum notes only
        existing.addendum = {
          action: "amended",
          qaId: correction.qaId,
          notes: correction.rawLine,
        };
        applied = true;
      }
      if (
        nature.includes("renamed and classified as alternative") &&
        correction.adjustedVersion
      ) {
        existing.name = correction.adjustedVersion;
        existing.conditionalOrAlternative = "Alternative";
        existing.conditional = true;
        applied = true;
      }

      if (applied) {
        existing.addendum = {
          action: "amended",
          qaId: correction.qaId,
          notes: correction.rawLine,
        };
      }

      diff.push({
        action: "amend",
        dpId,
        qaId: correction.qaId,
        detail: `${correction.nature}: ${correction.oldVersion ?? "?"} → ${correction.adjustedVersion ?? "?"}`,
        applied,
        before,
        after: {
          name: existing.name,
          relatedAr: existing.relatedAr,
          paragraph: existing.paragraph,
          dataType: existing.dataType,
          voluntary: existing.voluntary,
          mayVoluntaryRaw: existing.mayVoluntaryRaw,
          conditionalOrAlternative: existing.conditionalOrAlternative,
          conditional: existing.conditional,
        },
      });
    }
  }

  return {
    datapoints: [...byId.values()],
    diff,
    parseNotes,
  };
}

async function loadAddendumPage2Text(): Promise<string> {
  const buffer = fs.readFileSync(ADDENDUM_PDF);
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "_addendum-raw-text.txt"), result.text);

  const page2 = result.pages?.[1]?.text;
  if (page2) return page2;

  const split = result.text.split(/--\s*2 of 2\s*--/);
  return split[1] ?? result.text;
}

async function main() {
  fs.mkdirSync(dataDir, { recursive: true });

  console.log("=== PASS 1: Workbook parse ===");
  console.log(`Workbook: ${WORKBOOK}`);
  console.log(`Sheets: ${SHEETS_TO_PARSE.join(", ")}`);

  const { datapoints: base, stats } = parseWorkbook();
  const skipGrouped = groupSkips(stats.skips);

  console.log(`Rows read:    ${stats.rowsRead}`);
  console.log(`Rows emitted: ${stats.rowsEmitted}`);
  console.log(`Rows skipped: ${stats.skips.length}`);
  console.log("Skip reasons:", skipGrouped);

  const basePath = path.join(dataDir, "esrs-set1-datapoints.base.json");
  fs.writeFileSync(
    basePath,
    JSON.stringify(
      {
        source: "EFRAG IG 3 List of ESRS Datapoints (May 2024 workbook)",
        extractedAt: new Date().toISOString(),
        stats: {
          rowsRead: stats.rowsRead,
          rowsEmitted: stats.rowsEmitted,
          rowsSkipped: stats.skips.length,
          skipReasons: skipGrouped,
        },
        skips: stats.skips,
        datapoints: base,
      },
      null,
      2,
    ),
  );
  console.log(`Wrote ${basePath}`);

  console.log("\n=== PASS 2: Addendum (separate) ===");
  console.log(`Addendum: ${ADDENDUM_PDF}`);
  const page2Text = await loadAddendumPage2Text();
  const { datapoints: finalPoints, diff, parseNotes } = applyAddendum(base, page2Text);

  const applied = diff.filter((d) => d.applied).length;
  const notApplied = diff.filter((d) => !d.applied).length;
  console.log(
    `Addendum operations: ${diff.length} (${applied} applied, ${notApplied} not applied)`,
  );
  for (const note of parseNotes) {
    console.log(`  note: ${note}`);
  }

  const diffPath = path.join(dataDir, "esrs-set1-addendum-diff.json");
  fs.writeFileSync(
    diffPath,
    JSON.stringify(
      {
        source: "EFRAG Addendum to IG3: Technical adjustments (20 December 2024)",
        extractedAt: new Date().toISOString(),
        parseNotes,
        summary: {
          operations: diff.length,
          applied,
          notApplied,
          byAction: {
            add: diff.filter((d) => d.action === "add").length,
            remove: diff.filter((d) => d.action === "remove").length,
            amend: diff.filter((d) => d.action === "amend").length,
            skipped: diff.filter((d) => d.action === "skipped").length,
          },
        },
        diff,
      },
      null,
      2,
    ),
  );
  console.log(`Wrote ${diffPath}`);

  const outPath = path.join(dataDir, "esrs-set1-datapoints.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        source: "EFRAG IG 3 Set 1 datapoints + Dec 2024 Addendum",
        workbook: "docs/EFRAG-IG3-datapoints.xlsx",
        addendum: "docs/EFRAG-IG3-addendum-2024-12.pdf",
        extractedAt: new Date().toISOString(),
        baseStats: {
          rowsRead: stats.rowsRead,
          rowsEmitted: stats.rowsEmitted,
          rowsSkipped: stats.skips.length,
          skipReasons: skipGrouped,
        },
        addendumSummary: {
          operations: diff.length,
          applied,
          notApplied,
        },
        count: finalPoints.length,
        datapoints: finalPoints,
      },
      null,
      2,
    ),
  );
  console.log(`Wrote ${outPath} (${finalPoints.length} datapoints)`);
  console.log("\n=== STOP — Step 2 complete. Not running Step 3. ===");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
