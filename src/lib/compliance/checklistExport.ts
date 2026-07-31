/**
 * Pure builders for compliance obligation checklist export.
 * Status uses ComplianceObligations.checklistStatus (pending|complete).
 * Export defaults to confirmed obligations only (`confirmedAt` set).
 */

import type { ObligationStandard } from "@/lib/obligations/types";

/** Collection checklistStatus options — keep in sync with ComplianceObligations. */
export const CHECKLIST_STATUSES = ["pending", "complete"] as const;
export type ChecklistStatus = (typeof CHECKLIST_STATUSES)[number];

export type ChecklistExportFormat = "pdf" | "excel";

/** Excel urgency colour band (deadline-derived; not a collection enum). */
export type ChecklistUrgencyBand = "overdue" | "due_soon" | "complete" | "neutral";

export type ObligationExportSource = {
  id: string;
  standardVersion: ObligationStandard;
  wave: string;
  jurisdiction: string;
  firstReportingFY: string;
  filingDeadline?: string | null;
  notes?: string | null;
  derivationReason?: string | null;
  checklistStatus?: ChecklistStatus | null;
  confidence?: "derived" | "needs_confirmation" | null;
  source?: "engine" | "manual" | null;
  confirmedAt?: string | null;
  owner?: string | null;
  evidenceLink?: string | null;
};

export type ChecklistExportRow = {
  id: string;
  obligation: string;
  category: string;
  status: ChecklistStatus;
  dueDate: string | null;
  owner: string;
  notes: string;
  evidenceLink: string;
  urgencyBand: ChecklistUrgencyBand;
};

export type ChecklistExportSummary = {
  total: number;
  complete: number;
  pending: number;
  percentComplete: number;
  label: string;
};

export type ChecklistExportSnapshot = {
  organisationName: string;
  exportDate: string;
  period: string;
  rows: ChecklistExportRow[];
  summary: ChecklistExportSummary;
  sections: Array<{ category: string; rows: ChecklistExportRow[] }>;
};

const STANDARD_LABELS: Record<ObligationStandard, string> = {
  CSRD_SET1: "CSRD Set 1",
  CSRD_SIMPLIFIED: "CSRD Simplified",
  BRSR: "BRSR",
  VSME: "VSME",
  GRI: "GRI",
};

const WAVE_LABELS: Record<string, string> = {
  "1": "Wave 1",
  "2": "Wave 2",
  "3": "Wave 3",
  brsr_listed: "BRSR listed",
  brsr_supply: "BRSR supply chain",
  other: "Other",
};

/** Days ahead counted as "due soon" for Excel colouring. */
export const DUE_SOON_DAYS = 30;

/**
 * Map collection checklistStatus — unknown/missing → pending.
 */
export function mapObligationStatus(
  checklistStatus: string | null | undefined,
): ChecklistStatus {
  if (checklistStatus === "complete") return "complete";
  return "pending";
}

/** Group standardVersion into category sections (CSRD, BRSR, …). */
export function categoryFromStandard(standard: ObligationStandard): string {
  if (standard === "CSRD_SET1" || standard === "CSRD_SIMPLIFIED") return "CSRD";
  return STANDARD_LABELS[standard];
}

export function obligationDisplayName(source: ObligationExportSource): string {
  const standard = STANDARD_LABELS[source.standardVersion] ?? source.standardVersion;
  const wave = WAVE_LABELS[source.wave] ?? source.wave;
  return `${standard} · ${wave} · ${source.jurisdiction}`;
}

export function formatDueDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

export function urgencyBandForRow(
  status: ChecklistStatus,
  dueDate: string | null,
  asOf: Date,
): ChecklistUrgencyBand {
  if (status === "complete") return "complete";
  if (!dueDate) return "neutral";
  const due = new Date(`${dueDate}T00:00:00.000Z`);
  if (Number.isNaN(due.getTime())) return "neutral";
  const start = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  const dueMs = due.getTime();
  const diffDays = Math.floor((dueMs - start) / 86_400_000);
  if (diffDays < 0) return "overdue";
  if (diffDays <= DUE_SOON_DAYS) return "due_soon";
  return "neutral";
}

export function buildChecklistSummary(
  rows: ChecklistExportRow[],
): ChecklistExportSummary {
  const total = rows.length;
  const complete = rows.filter((r) => r.status === "complete").length;
  const pending = total - complete;
  const percentComplete = total === 0 ? 0 : Math.round((complete / total) * 100);
  return {
    total,
    complete,
    pending,
    percentComplete,
    label: `${complete}/${total} items complete (${percentComplete}%)`,
  };
}

export function matchesPeriod(
  source: ObligationExportSource,
  period: string | null | undefined,
): boolean {
  if (!period || !period.trim()) return true;
  const p = period.trim();
  if (source.firstReportingFY === p) return true;
  if (source.firstReportingFY.includes(p)) return true;
  const due = formatDueDate(source.filingDeadline);
  if (due && due.startsWith(p)) return true;
  if (/^\d{4}-\d{2}$/.test(p)) {
    const year = p.slice(0, 4);
    if (source.firstReportingFY.includes(year)) return true;
    if (due && due.startsWith(year)) return true;
  }
  if (/^\d{4}$/.test(p)) {
    if (source.firstReportingFY.includes(p)) return true;
    if (due && due.startsWith(p)) return true;
  }
  return false;
}

/** Collection verification flag: confirmedAt set. */
export function isConfirmedObligation(source: ObligationExportSource): boolean {
  return Boolean(source.confirmedAt);
}

export function buildChecklistRows(
  sources: ObligationExportSource[],
  options: {
    period?: string | null;
    /** Default true — only export obligations with confirmedAt. */
    confirmedOnly?: boolean;
    asOf?: Date;
  } = {},
): ChecklistExportRow[] {
  const asOf = options.asOf ?? new Date();
  const confirmedOnly = options.confirmedOnly !== false;

  return sources
    .filter((s) => matchesPeriod(s, options.period))
    .filter((s) => (confirmedOnly ? isConfirmedObligation(s) : true))
    .map((s) => {
      const status = mapObligationStatus(s.checklistStatus);
      const dueDate = formatDueDate(s.filingDeadline);
      const notes = [s.notes, s.derivationReason].filter(Boolean).join(" — ");
      return {
        id: s.id,
        obligation: obligationDisplayName(s),
        category: categoryFromStandard(s.standardVersion),
        status,
        dueDate,
        owner: (s.owner ?? "").trim(),
        notes,
        evidenceLink: (s.evidenceLink ?? "").trim(),
        urgencyBand: urgencyBandForRow(status, dueDate, asOf),
      };
    })
    .sort((a, b) => {
      const cat = a.category.localeCompare(b.category);
      if (cat !== 0) return cat;
      const dueA = a.dueDate ?? "9999-99-99";
      const dueB = b.dueDate ?? "9999-99-99";
      return dueA.localeCompare(dueB);
    });
}

export function groupRowsByCategory(
  rows: ChecklistExportRow[],
): Array<{ category: string; rows: ChecklistExportRow[] }> {
  const map = new Map<string, ChecklistExportRow[]>();
  for (const row of rows) {
    const list = map.get(row.category) ?? [];
    list.push(row);
    map.set(row.category, list);
  }
  return [...map.entries()].map(([category, sectionRows]) => ({
    category,
    rows: sectionRows,
  }));
}

export function buildChecklistSnapshot(input: {
  organisationName: string;
  period: string;
  sources: ObligationExportSource[];
  exportDate?: Date;
  confirmedOnly?: boolean;
}): ChecklistExportSnapshot {
  const exportDate = input.exportDate ?? new Date();
  const rows = buildChecklistRows(input.sources, {
    period: input.period,
    confirmedOnly: input.confirmedOnly,
    asOf: exportDate,
  });
  const summary = buildChecklistSummary(rows);
  return {
    organisationName: input.organisationName,
    exportDate: exportDate.toISOString().slice(0, 10),
    period: input.period,
    rows,
    summary,
    sections: groupRowsByCategory(rows),
  };
}

/** Sanitise org name for download filenames: ACME_Compliance_2026-07.pdf */
export function buildChecklistFilename(
  organisationName: string,
  period: string,
  format: ChecklistExportFormat,
): string {
  const safeOrg =
    organisationName
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 48) || "ClearESG";
  const safePeriod =
    period
      .trim()
      .replace(/[^a-zA-Z0-9.-]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || new Date().toISOString().slice(0, 7);
  const ext = format === "pdf" ? "pdf" : "xlsx";
  return `${safeOrg}_Compliance_${safePeriod}.${ext}`;
}

export function defaultExportPeriod(asOf: Date = new Date()): string {
  const y = asOf.getUTCFullYear();
  const m = String(asOf.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function parseExportFormat(
  value: string | null | undefined,
): ChecklistExportFormat | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === "pdf") return "pdf";
  if (v === "excel" || v === "xlsx") return "excel";
  return null;
}
