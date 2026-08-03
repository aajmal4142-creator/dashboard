import { isCertificateStatus, isCertificateType } from "./aggregate";
import type {
  CertificateImportParseResult,
  CertificateImportRow,
  CertificateImportValidationError,
  CertificateStatus,
  CertificateType,
} from "./types";

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function headerIndex(headers: string[], aliases: string[]): number {
  const normalised = headers.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  for (const alias of aliases) {
    const idx = normalised.indexOf(alias);
    if (idx >= 0) return idx;
  }
  return -1;
}

function cell(cols: string[], idx: number): string {
  if (idx < 0) return "";
  return cols[idx] ?? "";
}

function parseType(raw: string): CertificateType | null {
  const v = raw.trim();
  if (isCertificateType(v)) return v;
  const lower = v.toLowerCase().replace(/\s+/g, "_");
  if (lower === "rec") return "REC";
  if (lower === "go" || lower === "guarantee_of_origin" || lower === "rego") return "GO";
  if (lower === "eac" || lower === "i-rec" || lower === "irec") return "EAC";
  if (lower === "ppa") return "PPA";
  if (lower === "green_tariff" || lower === "green-tariff" || lower === "tariff") {
    return "green_tariff";
  }
  return null;
}

function parseStatus(raw: string): CertificateStatus | null {
  if (!raw.trim()) return "active";
  const v = raw.trim().toLowerCase();
  if (isCertificateStatus(v)) return v;
  return null;
}

/**
 * Parse energy-certificate CSV for dry-run / apply.
 * Required: certificate_type, volume_kwh, vintage_year, region, period
 * Optional: label, country, status, supplier, notes
 */
export function parseCertificateImportCsv(
  csvContent: string,
): CertificateImportParseResult {
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
    label: headerIndex(headers, ["label", "serial", "certificate_id", "name"]),
    certificateType: headerIndex(headers, [
      "certificate_type",
      "type",
      "instrument",
      "cert_type",
    ]),
    volumeKwh: headerIndex(headers, ["volume_kwh", "volume", "kwh", "mwh"]),
    vintageYear: headerIndex(headers, ["vintage_year", "vintage", "year"]),
    region: headerIndex(headers, ["region", "geography", "grid", "location"]),
    country: headerIndex(headers, ["country", "country_code", "iso_country"]),
    status: headerIndex(headers, ["status", "retirement_status"]),
    period: headerIndex(headers, [
      "period",
      "period_id",
      "reporting_period",
      "period_label",
    ]),
    supplier: headerIndex(headers, ["supplier", "issuer", "counterparty"]),
    notes: headerIndex(headers, ["notes", "comment", "comments"]),
  };

  const errors: CertificateImportValidationError[] = [];
  if (col.certificateType < 0) {
    errors.push({
      rowNumber: 1,
      field: "certificate_type",
      value: "",
      error: "Missing required column certificate_type",
    });
  }
  if (col.volumeKwh < 0) {
    errors.push({
      rowNumber: 1,
      field: "volume_kwh",
      value: "",
      error: "Missing required column volume_kwh",
    });
  }
  if (col.vintageYear < 0) {
    errors.push({
      rowNumber: 1,
      field: "vintage_year",
      value: "",
      error: "Missing required column vintage_year",
    });
  }
  if (col.region < 0) {
    errors.push({
      rowNumber: 1,
      field: "region",
      value: "",
      error: "Missing required column region",
    });
  }
  if (col.period < 0) {
    errors.push({
      rowNumber: 1,
      field: "period",
      value: "",
      error: "Missing required column period (id or label)",
    });
  }
  if (errors.length > 0) {
    return { valid: false, rows: [], errors };
  }

  const volumeHeader = headers[col.volumeKwh]?.trim().toLowerCase() ?? "";
  const volumeIsMwh = volumeHeader === "mwh";

  const rows: CertificateImportRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const rowNumber = i + 1;
    const cols = splitCsvLine(lines[i]!);
    const typeRaw = cell(cols, col.certificateType);
    const volumeRaw = cell(cols, col.volumeKwh);
    const vintageRaw = cell(cols, col.vintageYear);
    const region = cell(cols, col.region);
    const periodRef = cell(cols, col.period);
    const countryRaw = cell(cols, col.country);
    const statusRaw = cell(cols, col.status);
    const labelRaw = cell(cols, col.label);
    const supplierRaw = cell(cols, col.supplier);
    const notesRaw = cell(cols, col.notes);

    const certificateType = parseType(typeRaw);
    if (!certificateType) {
      errors.push({
        rowNumber,
        field: "certificate_type",
        value: typeRaw,
        error: "certificate_type must be REC, GO, EAC, PPA, or green_tariff",
      });
      continue;
    }

    const volumeParsed = Number(volumeRaw.replace(/,/g, ""));
    if (!Number.isFinite(volumeParsed) || volumeParsed < 0) {
      errors.push({
        rowNumber,
        field: "volume_kwh",
        value: volumeRaw,
        error: "volume_kwh must be a non-negative number",
      });
      continue;
    }
    const volumeKwh = volumeIsMwh ? volumeParsed * 1000 : volumeParsed;

    const vintageYear = Number(vintageRaw);
    if (!Number.isInteger(vintageYear) || vintageYear < 1990 || vintageYear > 2100) {
      errors.push({
        rowNumber,
        field: "vintage_year",
        value: vintageRaw,
        error: "vintage_year must be an integer between 1990 and 2100",
      });
      continue;
    }

    if (!region) {
      errors.push({
        rowNumber,
        field: "region",
        value: region,
        error: "region is required",
      });
      continue;
    }

    if (!periodRef) {
      errors.push({
        rowNumber,
        field: "period",
        value: periodRef,
        error: "period (id or label) is required",
      });
      continue;
    }

    const status = parseStatus(statusRaw);
    if (!status) {
      errors.push({
        rowNumber,
        field: "status",
        value: statusRaw,
        error: "status must be active, retired, or expired",
      });
      continue;
    }

    let country: string | null = null;
    if (countryRaw) {
      const c = countryRaw.trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(c)) {
        errors.push({
          rowNumber,
          field: "country",
          value: countryRaw,
          error: "country must be ISO 3166-1 alpha-2 when provided",
        });
        continue;
      }
      country = c;
    }

    rows.push({
      rowNumber,
      label: labelRaw || null,
      certificateType,
      volumeKwh,
      vintageYear,
      region,
      country,
      status,
      periodRef,
      supplier: supplierRaw || null,
      notes: notesRaw || null,
    });
  }

  return {
    valid: errors.length === 0,
    rows,
    errors,
  };
}

export const CERTIFICATE_CSV_TEMPLATE = [
  "certificate_type,volume_kwh,vintage_year,region,country,status,period,label,supplier,notes",
  "REC,50000,2025,IN-W,IN,active,FY2025-26,REC-2025-001,GreenCo,User-entered inventory",
  "GO,12000,2024,EU-ENTSOE,DE,retired,FY2025-26,GO-DE-8841,,",
].join("\n");
