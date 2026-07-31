/** Ephemeral PDF export options (query / modal). Not persisted on Reports. */

export type PdfPageFormat = "a4" | "letter";

/** react-pdf Page size tokens. */
export type PdfReactPageSize = "A4" | "LETTER";

export type ReportPdfExportSettings = {
  pageFormat: PdfPageFormat;
  /** Custom overlay (e.g. CONFIDENTIAL). Independent of plan draft watermark. */
  watermark: string | null;
  includeCharts: boolean;
};

export const DEFAULT_PDF_EXPORT_SETTINGS: ReportPdfExportSettings = {
  pageFormat: "a4",
  watermark: null,
  includeCharts: true,
};

export function pageFormatToReactSize(format: PdfPageFormat): PdfReactPageSize {
  return format === "letter" ? "LETTER" : "A4";
}

/**
 * Plan draft watermark + optional custom label.
 * Free-plan exports stay watermarked even when a custom label is set.
 */
export function resolvePdfWatermarkText(
  planWatermarked: boolean,
  customLabel: string | null | undefined,
): string | null {
  const custom = customLabel?.trim() || null;
  if (planWatermarked && custom) return `ClearESG · ${custom}`;
  if (planWatermarked) return "ClearESG";
  if (custom) return custom;
  return null;
}

function parseBool(raw: string | null, fallback: boolean): boolean {
  if (raw === null || raw === "") return fallback;
  const v = raw.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return fallback;
}

function parsePageFormat(raw: string | null): PdfPageFormat {
  if (!raw) return "a4";
  const v = raw.trim().toLowerCase();
  if (v === "letter" || v === "us-letter") return "letter";
  return "a4";
}

function sanitizeWatermark(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().slice(0, 48);
  return trimmed.length > 0 ? trimmed : null;
}

/** Parse GET /pdf?pageSize=a4|letter&watermark=CONFIDENTIAL&includeCharts=0|1 */
export function parseReportPdfSettings(
  searchParams: URLSearchParams,
): ReportPdfExportSettings {
  const pageRaw =
    searchParams.get("pageSize") ??
    searchParams.get("format") ??
    searchParams.get("page");
  return {
    pageFormat: parsePageFormat(pageRaw),
    watermark: sanitizeWatermark(searchParams.get("watermark")),
    includeCharts: parseBool(searchParams.get("includeCharts"), true),
  };
}

/** Build query string for modal → PDF download link. */
export function buildPdfExportQuery(settings: ReportPdfExportSettings): string {
  const params = new URLSearchParams();
  if (settings.pageFormat !== "a4") {
    params.set("pageSize", settings.pageFormat);
  }
  if (settings.watermark) {
    params.set("watermark", settings.watermark);
  }
  if (!settings.includeCharts) {
    params.set("includeCharts", "0");
  }
  const q = params.toString();
  return q ? `?${q}` : "";
}
