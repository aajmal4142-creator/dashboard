/**
 * ESRS Set 1 XBRL / iXBRL structural tagging — pure, zero I/O.
 *
 * This is a *structural tagging beachhead*, not an ESEF-certified filing:
 * - Concept names live under a ClearESG-owned placeholder namespace, not the
 *   official EFRAG-licensed ESRS XBRL taxonomy (which requires taxonomy files
 *   ClearESG does not redistribute).
 * - Every concept is derived directly from the existing {@link CSRD_DISCLOSURES}
 *   catalog — no new disclosure logic, no invented figures.
 * - A disclosure is only tagged (present in the iXBRL body) when its coverage
 *   state is "covered" or "partial". Gaps (missing data / unmapped) are never
 *   tagged with a fabricated value — they are listed as open gaps instead.
 * - Numeric facts (ix:nonFraction) are only emitted when the caller supplies
 *   an actual measured value via `numericFacts`. Absent a supplied value,
 *   covered/partial disclosures fall back to an `ix:nonNumeric` text stub
 *   describing the disclosure state — never a silent zero.
 */

import { CSRD_SECTIONS } from "./catalog";
import type {
  CsrdCoverageResult,
  CsrdDisclosureState,
  CsrdGapKind,
  CsrdSectionId,
} from "./types";

/** Placeholder namespace — not the official EFRAG ESRS XBRL taxonomy. */
export const CSRD_XBRL_NAMESPACE =
  "https://clearesg.example/xbrl/esrs-structural-beachhead/2026";
export const CSRD_XBRL_PREFIX = "esrs-beachhead";

export type CsrdXbrlDataType = "nonNumeric" | "nonFraction";

/** Disclosure codes eligible for a numeric (ix:nonFraction) tag when a value is supplied. */
const NUMERIC_CONCEPT_UNITS: Record<string, string> = {
  "E1-5": "MWh",
  "E1-6-S1": "tCO2e",
  "E1-6-S2": "tCO2e",
  "E1-6-S3": "tCO2e",
  "E1-Intensity": "tCO2e",
  "E3-Water": "m3",
  "E5-Waste": "t",
};

/** One caller-supplied numeric fact — never invented by this module. */
export type CsrdXbrlNumericFact = {
  code: string;
  value: number;
  unit: string;
  decimals?: number;
};

export type CsrdXbrlConceptDef = {
  code: string;
  sectionId: CsrdSectionId;
  conceptName: string;
  label: string;
  eligibleDataType: CsrdXbrlDataType;
  unit: string | null;
};

function conceptSuffix(code: string): string {
  return code.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/** Maps every catalogued CSRD disclosure to a structural XBRL concept name. */
export function csrdXbrlConcepts(
  disclosures: ReadonlyArray<{
    code: string;
    sectionId: CsrdSectionId;
    label: string;
  }>,
): CsrdXbrlConceptDef[] {
  return disclosures.map((d) => {
    const unit = NUMERIC_CONCEPT_UNITS[d.code] ?? null;
    return {
      code: d.code,
      sectionId: d.sectionId,
      conceptName: `${CSRD_XBRL_PREFIX}:${conceptSuffix(d.code)}`,
      label: d.label,
      eligibleDataType: unit ? "nonFraction" : "nonNumeric",
      unit,
    };
  });
}

export type CsrdXbrlTagRow = {
  code: string;
  sectionId: CsrdSectionId;
  conceptName: string;
  contextRef: string;
  dataType: CsrdXbrlDataType;
  /** True when the concept is actually written into the iXBRL body. */
  tagged: boolean;
  value: string | number | null;
  unit: string | null;
  state: CsrdDisclosureState;
  gapKind: CsrdGapKind | null;
  note: string | null;
};

export type CsrdXbrlTagInventory = {
  periodId: string;
  periodLabel: string;
  entityName: string;
  generatedAt: string;
  contextRef: string;
  rows: CsrdXbrlTagRow[];
  taggedCount: number;
  totalCount: number;
  pctTagged: number;
};

function stateStub(state: CsrdDisclosureState, label: string): string {
  if (state === "covered") return `Covered — ${label}`;
  if (state === "partial") return `Partial — ${label}`;
  return `Gap — ${label}`;
}

/**
 * Builds the tag inventory from a computed CSRD coverage result. Pure —
 * takes coverage that has already resolved metric quality, applies no I/O.
 */
export function buildCsrdXbrlTagInventory(input: {
  coverage: CsrdCoverageResult;
  entityName: string;
  periodLabel?: string | null;
  numericFacts?: CsrdXbrlNumericFact[];
  generatedAt?: string;
}): CsrdXbrlTagInventory {
  const { coverage } = input;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const periodLabel = input.periodLabel?.trim() || coverage.periodId;
  const contextRef = `ctx-${conceptSuffix(coverage.periodId)}`;
  const factByCode = new Map((input.numericFacts ?? []).map((f) => [f.code, f]));

  const rows: CsrdXbrlTagRow[] = coverage.disclosures.map((d) => {
    const unit = NUMERIC_CONCEPT_UNITS[d.code] ?? null;
    const conceptName = `${CSRD_XBRL_PREFIX}:${conceptSuffix(d.code)}`;
    const isOpenGap = d.state === "gap";

    if (isOpenGap) {
      return {
        code: d.code,
        sectionId: d.sectionId,
        conceptName,
        contextRef,
        dataType: unit ? "nonFraction" : "nonNumeric",
        tagged: false,
        value: null,
        unit: null,
        state: d.state,
        gapKind: d.gapKind,
        note:
          d.gapKind === "unmapped"
            ? "Not tracked in ClearESG — no structural tag emitted."
            : "Missing metric data — no structural tag emitted.",
      };
    }

    const fact = factByCode.get(d.code);
    if (fact && unit) {
      return {
        code: d.code,
        sectionId: d.sectionId,
        conceptName,
        contextRef,
        dataType: "nonFraction",
        tagged: true,
        value: fact.value,
        unit: fact.unit,
        state: d.state,
        gapKind: d.gapKind,
        note: null,
      };
    }

    // Covered/partial but no numeric fact supplied — structural text stub,
    // never a fabricated number.
    return {
      code: d.code,
      sectionId: d.sectionId,
      conceptName,
      contextRef,
      dataType: "nonNumeric",
      tagged: true,
      value: stateStub(d.state, d.label),
      unit: null,
      state: d.state,
      gapKind: d.gapKind,
      note:
        unit && !fact
          ? "Numeric value not supplied to tagger — tagged as text stub."
          : null,
    };
  });

  const taggedCount = rows.filter((r) => r.tagged).length;

  return {
    periodId: coverage.periodId,
    periodLabel,
    entityName: input.entityName,
    generatedAt,
    contextRef,
    rows,
    taggedCount,
    totalCount: rows.length,
    pctTagged: rows.length > 0 ? Math.round((100 * taggedCount) / rows.length) : 0,
  };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const XBRL_DISCLAIMER =
  "Structural ESRS tagging beachhead generated by ClearESG. This document is " +
  "NOT an ESEF-certified filing and does not use the official EFRAG ESRS XBRL " +
  "taxonomy. Concept names are placeholders under a ClearESG namespace intended " +
  "to demonstrate tag structure and readiness only. Verify against the official " +
  "taxonomy and obtain assurance before regulatory submission.";

/**
 * Renders a well-formed Inline XBRL–style XHTML skeleton from a tag
 * inventory. Every emitted fact traces back to a row that was either
 * "covered"/"partial" with a value, or explicitly listed as an untagged gap
 * in a visible HTML comment — nothing is silently omitted from the document.
 */
export function buildCsrdIxbrlDocument(inventory: CsrdXbrlTagInventory): string {
  const rowsBySection = new Map<CsrdSectionId, CsrdXbrlTagRow[]>();
  for (const row of inventory.rows) {
    const list = rowsBySection.get(row.sectionId) ?? [];
    list.push(row);
    rowsBySection.set(row.sectionId, list);
  }

  const factLines: string[] = [];
  const gapLines: string[] = [];

  for (const section of CSRD_SECTIONS) {
    const rows = rowsBySection.get(section.id) ?? [];
    if (rows.length === 0) continue;
    factLines.push(
      `      <tr class="csrd-section"><td colspan="3">${escapeXml(section.title)}</td></tr>`,
    );
    for (const row of rows) {
      if (!row.tagged) {
        gapLines.push(
          `    <!-- gap: ${escapeXml(row.code)} (${escapeXml(row.gapKind ?? "gap")}) — ${escapeXml(
            row.note ?? "",
          )} -->`,
        );
        factLines.push(
          `      <tr class="csrd-gap"><td>${escapeXml(row.code)}</td><td colspan="2">Not tagged — ${escapeXml(
            row.gapKind ?? "gap",
          )}</td></tr>`,
        );
        continue;
      }
      const tag =
        row.dataType === "nonFraction"
          ? `<ix:nonFraction contextRef="${escapeXml(row.contextRef)}" name="${escapeXml(
              row.conceptName,
            )}" unitRef="unit-${escapeXml(String(row.unit ?? "unit"))}" decimals="2" format="ixt:num-dot-decimal">${escapeXml(
              String(row.value ?? ""),
            )}</ix:nonFraction>`
          : `<ix:nonNumeric contextRef="${escapeXml(row.contextRef)}" name="${escapeXml(
              row.conceptName,
            )}">${escapeXml(String(row.value ?? ""))}</ix:nonNumeric>`;
      factLines.push(
        `      <tr class="csrd-fact"><td>${escapeXml(row.code)}</td><td>${escapeXml(
          row.conceptName,
        )}</td><td>${tag}</td></tr>`,
      );
    }
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<html xmlns="http://www.w3.org/1999/xhtml"',
    '      xmlns:ix="http://www.xbrl.org/2013/inlineXBRL"',
    '      xmlns:xbrli="http://www.xbrl.org/2003/instance"',
    `      xmlns:${CSRD_XBRL_PREFIX}="${CSRD_XBRL_NAMESPACE}">`,
    "  <head>",
    `    <title>${escapeXml(inventory.entityName)} — CSRD/ESRS structural tag pack (${escapeXml(
      inventory.periodLabel,
    )})</title>
    <meta charset="utf-8" />
  </head>
  <body>
    <!-- ${escapeXml(XBRL_DISCLAIMER)} -->
    <ix:header>
      <ix:hidden>
        <ix:references>
          <!-- Placeholder schemaRef — no official ESRS taxonomy file bundled. -->
        </ix:references>
      </ix:hidden>
      <ix:resources>
        <xbrli:context id="${escapeXml(inventory.contextRef)}">
          <xbrli:entity>
            <xbrli:identifier scheme="https://clearesg.example/entity">${escapeXml(
              inventory.entityName,
            )}</xbrli:identifier>
          </xbrli:entity>
          <xbrli:period>
            <xbrli:instant>${escapeXml(inventory.generatedAt.slice(0, 10))}</xbrli:instant>
          </xbrli:period>
        </xbrli:context>
      </ix:resources>
    </ix:header>
    <h1>${escapeXml(inventory.entityName)} — CSRD / ESRS structural tag pack</h1>
    <p>Period: ${escapeXml(inventory.periodLabel)} · Generated: ${escapeXml(
      inventory.generatedAt,
    )} · Tagged ${inventory.taggedCount}/${inventory.totalCount} disclosures.</p>
    <p><strong>Disclaimer:</strong> ${escapeXml(XBRL_DISCLAIMER)}</p>`,
    gapLines.length > 0 ? gapLines.join("\n") : "    <!-- no open gaps -->",
    "    <table>",
    "      <thead><tr><th>Code</th><th>Concept</th><th>Value</th></tr></thead>",
    "      <tbody>",
    ...factLines,
    "      </tbody>",
    "    </table>",
    "  </body>",
    "</html>",
    "",
  ].join("\n");
}

/** Flat CSV of the tag inventory, mirroring the SECR/SFDR/CSRD export pattern. */
export function csrdXbrlInventoryToCsv(inventory: CsrdXbrlTagInventory): string {
  const header = [
    "code",
    "sectionId",
    "conceptName",
    "dataType",
    "tagged",
    "value",
    "unit",
    "state",
    "gapKind",
    "note",
  ];
  const rows = inventory.rows.map((r) => [
    r.code,
    r.sectionId,
    r.conceptName,
    r.dataType,
    String(r.tagged),
    r.value === null ? "" : String(r.value),
    r.unit ?? "",
    r.state,
    r.gapKind ?? "",
    r.note ?? "",
  ]);
  return [header, ...rows]
    .map((cols) => cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export { XBRL_DISCLAIMER as CSRD_XBRL_DISCLAIMER };
