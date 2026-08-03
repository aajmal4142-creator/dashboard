/**
 * Report Excel export (exceljs).
 * Spreadsheet RGB lives at this boundary only — React UI uses CSS tokens.
 * Token map (light print): ink → 1A1714, canvas cream → FBF9F5, accent → 7A2E2E.
 */

import ExcelJS from "exceljs";

import type { MachineExportDatapointRow } from "./machineExport";
import type { ReportSnapshot } from "./types";

/** Spreadsheet RGB — mirrored from ClearESG light PDF/print tokens. */
const SHEET = {
  headerBg: "1A1714",
  headerFg: "FBF9F5",
  accent: "7A2E2E",
  muted: "6B635A",
} as const;

export type SheetCell = string | number | null;
export type SheetRows = SheetCell[][];

export function buildSummarySheetRows(snapshot: ReportSnapshot): SheetRows {
  const yoy =
    snapshot.yoy?.changePct === null || snapshot.yoy?.changePct === undefined
      ? null
      : snapshot.yoy.changePct;
  return [
    ["Field", "Value"],
    ["Organisation", snapshot.organisationName],
    ["Period", snapshot.periodLabel],
    ["Framework", snapshot.framework],
    ["Version", snapshot.version],
    ["Published at", snapshot.publishedAt],
    ["Overall score", snapshot.scores.overall],
    ["Score E", snapshot.scores.e],
    ["Score S", snapshot.scores.s],
    ["Score G", snapshot.scores.g],
    ["Band", String(snapshot.band)],
    ["Scope 1 tCO2e", snapshot.emissions.scope1],
    [
      "Scope 2 location-based tCO2e",
      snapshot.emissions.scope2LocationBased ?? snapshot.emissions.scope2,
    ],
    ["Scope 2 market-based tCO2e", snapshot.emissions.scope2MarketBased ?? null],
    ["Scope 3 tCO2e", snapshot.emissions.scope3],
    ["Total tCO2e", snapshot.emissions.total],
    ["Data quality %", snapshot.emissions.dataQualityPct],
    ["YoY change %", yoy],
    ["Prior period", snapshot.yoy?.previousPeriodLabel ?? null],
    ["Prior total tCO2e", snapshot.yoy?.previousTotal ?? null],
    ["Disclaimer", snapshot.disclaimer],
  ];
}

/** Pure YoY ratio for tests / formula result — null when prior is missing or zero. */
export function computeYoyRatio(snapshot: ReportSnapshot): number | null {
  const prior = snapshot.yoy?.previousTotal;
  if (prior === undefined || prior === null || prior <= 0) return null;
  return snapshot.emissions.total / prior;
}

export function buildEmissionsSheetRows(snapshot: ReportSnapshot): SheetRows {
  const rows: SheetRows = [
    ["Scope", "Value tCO2e", "Quality", "Methodology", "Uncertainties", "Sources"],
    [
      "Scope 1",
      snapshot.emissions.scope1,
      snapshot.scopeBreakdown?.scope1.quality ?? null,
      snapshot.scopeBreakdown?.scope1.methodology ?? null,
      snapshot.scopeBreakdown?.scope1.uncertainties ?? null,
      snapshot.scopeBreakdown?.scope1.sources.join("; ") ?? null,
    ],
    [
      "Scope 2 (location-based)",
      snapshot.emissions.scope2LocationBased ?? snapshot.emissions.scope2,
      snapshot.scopeBreakdown?.scope2.quality ?? null,
      snapshot.scopeBreakdown?.scope2.methodology ?? null,
      snapshot.scopeBreakdown?.scope2.uncertainties ?? null,
      snapshot.scopeBreakdown?.scope2.sources.join("; ") ?? null,
    ],
    [
      "Scope 2 (market-based)",
      snapshot.emissions.scope2MarketBased ?? null,
      snapshot.scopeBreakdown?.scope2Market?.quality ?? null,
      snapshot.scopeBreakdown?.scope2Market?.methodology ?? null,
      snapshot.scopeBreakdown?.scope2Market?.uncertainties ?? null,
      snapshot.scopeBreakdown?.scope2Market?.sources.join("; ") ?? null,
    ],
    [
      "Scope 3",
      snapshot.emissions.scope3,
      snapshot.scopeBreakdown?.scope3.quality ?? null,
      snapshot.scopeBreakdown?.scope3.methodology ?? null,
      snapshot.scopeBreakdown?.scope3.uncertainties ?? null,
      snapshot.scopeBreakdown?.scope3.sources.join("; ") ?? null,
    ],
    ["Total", snapshot.emissions.total, null, null, null, null],
    ["Prior total", snapshot.yoy?.previousTotal ?? null, null, null, null, null],
  ];
  return rows;
}

export function buildBreakdownSheetRows(snapshot: ReportSnapshot): SheetRows {
  const rows: SheetRows = [["Component", "Contribution", "Explanation"]];
  for (const item of snapshot.breakdown) {
    rows.push([item.component, item.contribution, item.explanation]);
  }
  return rows;
}

export function buildMaterialitySheetRows(snapshot: ReportSnapshot): SheetRows {
  const rows: SheetRows = [["ESRS topic", "Material", "Impact score", "Financial score"]];
  for (const p of snapshot.materiality.points) {
    rows.push([
      p.esrsTopic,
      p.material ? "material" : "below",
      p.impactScore,
      p.financialScore,
    ]);
  }
  return rows;
}

export function buildDataGapsSheetRows(snapshot: ReportSnapshot): SheetRows {
  const rows: SheetRows = [["Code", "Label", "Severity", "Message"]];
  for (const g of snapshot.dataGaps ?? []) {
    rows.push([g.code, g.label, g.severity, g.message]);
  }
  return rows;
}

export function buildFactorsSheetRows(snapshot: ReportSnapshot): SheetRows {
  const rows: SheetRows = [["Factor ID", "Key", "Year", "Value"]];
  for (const f of snapshot.factorsUsed) {
    rows.push([f.factorId, f.key, f.year, f.value]);
  }
  return rows;
}

export function buildAuditTrailSheetRows(snapshot: ReportSnapshot): SheetRows {
  const rows: SheetRows = [["Label", "Detail"]];
  for (const entry of snapshot.dataIntegrity?.auditTrail ?? []) {
    rows.push([entry.label, entry.detail]);
  }
  return rows;
}

export function buildDatapointsSheetRows(
  datapoints: MachineExportDatapointRow[],
): SheetRows {
  const rows: SheetRows = [["ID", "Value", "Unit", "Category", "Quality", "Timestamp"]];
  for (const dp of datapoints) {
    rows.push([dp.id, dp.value, dp.unit, dp.category, dp.quality, dp.timestamp]);
  }
  return rows;
}

function styleHeaderRow(sheet: ExcelJS.Worksheet): void {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: `FF${SHEET.headerFg}` } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: `FF${SHEET.headerBg}` },
  };
  headerRow.alignment = { vertical: "middle" };
}

function writeSheet(
  wb: ExcelJS.Workbook,
  name: string,
  rows: SheetRows,
  freezeHeader = true,
): void {
  const sheet = wb.addWorksheet(name, {
    views: freezeHeader ? [{ state: "frozen", ySplit: 1 }] : [],
  });
  for (const row of rows) {
    sheet.addRow(row.map((c) => (c === null ? "" : c)));
  }
  if (rows.length > 0) {
    styleHeaderRow(sheet);
    const colCount = rows[0]?.length ?? 1;
    for (let i = 1; i <= colCount; i++) {
      const col = sheet.getColumn(i);
      let max = 10;
      for (const row of rows) {
        const cell = row[i - 1];
        const len = cell === null || cell === undefined ? 0 : String(cell).length;
        if (len > max) max = len;
      }
      col.width = Math.min(Math.max(max + 2, 12), 48);
    }
    if (rows.length > 1) {
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: rows.length, column: colCount },
      };
    }
  }
}

export type ReportExcelInput = {
  snapshot: ReportSnapshot;
  datapoints?: MachineExportDatapointRow[];
};

/** Multi-sheet workbook: Summary, Emissions, Breakdown, Materiality, DataGaps, Factors, Audit, Datapoints. */
export async function buildReportExcelBuffer(input: ReportExcelInput): Promise<Buffer> {
  const { snapshot, datapoints = [] } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = "ClearESG";
  wb.created = new Date(snapshot.publishedAt);

  writeSheet(wb, "Summary", buildSummarySheetRows(snapshot), false);
  writeSheet(wb, "Emissions", buildEmissionsSheetRows(snapshot));
  writeSheet(wb, "Breakdown", buildBreakdownSheetRows(snapshot));
  writeSheet(wb, "Materiality", buildMaterialitySheetRows(snapshot));
  writeSheet(wb, "DataGaps", buildDataGapsSheetRows(snapshot));
  writeSheet(wb, "Factors", buildFactorsSheetRows(snapshot));
  writeSheet(wb, "AuditTrail", buildAuditTrailSheetRows(snapshot));
  if (datapoints.length > 0) {
    writeSheet(wb, "Datapoints", buildDatapointsSheetRows(datapoints));
  }

  // Emissions!B5 = Total, B6 = Prior — YoY ratio formula when prior exists
  const emissions = wb.getWorksheet("Emissions");
  const yoyRatio = computeYoyRatio(snapshot);
  if (emissions && yoyRatio !== null) {
    emissions.addRow(["YoY ratio", { formula: "B5/B6", result: yoyRatio }]);
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
