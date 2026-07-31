import type { SearchResult, SearchResultType } from "@/lib/search/types";

function str(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function previewParts(parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}

export function hrefForResult(
  type: SearchResultType,
  id: string,
  meta: { metricKey?: string } = {},
): string {
  switch (type) {
    case "datapoint":
      return meta.metricKey ? `/data#${encodeURIComponent(meta.metricKey)}` : "/data";
    case "report":
      return "/reports";
    case "supplier":
      return `/suppliers/${encodeURIComponent(id)}/risk-breakdown`;
    case "compliance":
      return "/compliance-templates";
    case "evidence":
      return "/assurance";
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

export function mapDatapointToResult(doc: {
  id: string | number;
  metricKey?: string | null;
  value?: number | null;
  unit?: string | null;
  quality?: string | null;
  source?: string | null;
}): SearchResult {
  const metricKey = str(doc.metricKey) || "Datapoint";
  const valueLabel =
    doc.value == null || Number.isNaN(Number(doc.value))
      ? null
      : `${doc.value}${doc.unit ? ` ${doc.unit}` : ""}`;

  return {
    id: String(doc.id),
    type: "datapoint",
    title: metricKey,
    preview: previewParts([valueLabel, doc.quality, doc.source]),
    href: hrefForResult("datapoint", String(doc.id), { metricKey }),
  };
}

export function mapReportToResult(doc: {
  id: string | number;
  framework?: string | null;
  status?: string | null;
  version?: number | null;
  dataQualityPct?: number | null;
}): SearchResult {
  const framework = str(doc.framework) || "Report";
  const version =
    doc.version != null && Number.isFinite(doc.version) ? `v${doc.version}` : null;
  const dq =
    doc.dataQualityPct != null && Number.isFinite(doc.dataQualityPct)
      ? `DQ ${doc.dataQualityPct}%`
      : null;

  return {
    id: String(doc.id),
    type: "report",
    title: framework,
    preview: previewParts([doc.status, version, dq]),
    href: hrefForResult("report", String(doc.id)),
  };
}

export function mapSupplierToResult(doc: {
  id: string | number;
  name?: string | null;
  category?: string | null;
  naceCode?: string | null;
  requestStatus?: string | null;
  tier?: number | null;
}): SearchResult {
  const name = str(doc.name) || "Supplier";
  const tier = doc.tier != null && Number.isFinite(doc.tier) ? `Tier ${doc.tier}` : null;

  return {
    id: String(doc.id),
    type: "supplier",
    title: name,
    preview: previewParts([doc.category, doc.naceCode, tier, doc.requestStatus]),
    href: hrefForResult("supplier", String(doc.id)),
  };
}

export function mapComplianceAssessmentToResult(doc: {
  id: string | number;
  title?: string | null;
  status?: string | null;
  reportingYear?: number | null;
}): SearchResult {
  const title = str(doc.title) || "Assessment";
  const year =
    doc.reportingYear != null && Number.isFinite(doc.reportingYear)
      ? String(doc.reportingYear)
      : null;

  return {
    id: String(doc.id),
    type: "compliance",
    title,
    preview: previewParts(["Assessment", doc.status, year]),
    href: "/compliance-templates",
  };
}

export function mapComplianceObligationToResult(doc: {
  id: string | number;
  standardVersion?: string | null;
  jurisdiction?: string | null;
  firstReportingFY?: string | null;
  checklistStatus?: string | null;
}): SearchResult {
  const standard = str(doc.standardVersion) || "Obligation";

  return {
    id: String(doc.id),
    type: "compliance",
    title: standard,
    preview: previewParts([
      "Obligation",
      doc.jurisdiction,
      doc.firstReportingFY,
      doc.checklistStatus,
    ]),
    href: "/compliance/calendar",
  };
}

export function mapEvidenceToResult(doc: {
  id: string | number;
  filename?: string | null;
  mimeType?: string | null;
  ocrStatus?: string | null;
  whyNote?: string | null;
}): SearchResult {
  const filename = str(doc.filename) || "Evidence";
  const note = str(doc.whyNote);
  const notePreview = note.length > 80 ? `${note.slice(0, 77)}…` : note || null;

  return {
    id: String(doc.id),
    type: "evidence",
    title: filename,
    preview: previewParts([doc.mimeType, doc.ocrStatus, notePreview]),
    href: hrefForResult("evidence", String(doc.id)),
  };
}

/** Stable merge: keep type order, then truncate to limit. */
export function mergeSearchResults(
  groups: SearchResult[][],
  limit: number,
): { results: SearchResult[]; totalCount: number } {
  const merged = groups.flat();
  return {
    results: merged.slice(0, limit),
    totalCount: merged.length,
  };
}

export function typeLabel(type: SearchResultType): string {
  switch (type) {
    case "datapoint":
      return "Datapoint";
    case "report":
      return "Report";
    case "supplier":
      return "Supplier";
    case "compliance":
      return "Compliance";
    case "evidence":
      return "Evidence";
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}
