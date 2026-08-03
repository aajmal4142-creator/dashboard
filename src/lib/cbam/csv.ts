import type {
  CbamImportParseResult,
  CbamImportRow,
  CbamImportValidationError,
  CbamQuantityUnit,
  CbamQuarter,
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

function parseOptionalNumber(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n)) return Number.NaN;
  return n;
}

function parseUnit(raw: string): CbamQuantityUnit | null {
  const v = raw.trim().toLowerCase();
  if (!v || v === "t" || v === "tonne" || v === "tonnes" || v === "mt") return "t";
  if (v === "kg" || v === "kilogram" || v === "kilograms") return "kg";
  if (v === "mwh" || v === "mw_h" || v === "megawatt_hour") return "mwh";
  return null;
}

function parseQuarter(raw: string): CbamQuarter | null {
  const v = raw.trim().toLowerCase().replace(/^q/, "");
  if (v === "1" || v === "2" || v === "3" || v === "4") return v;
  return null;
}

function parseBool(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "y";
}

/**
 * Parse CBAM goods CSV for dry-run / apply.
 * Required headers: cn_code, quantity, installation_country, reporting_year, reporting_quarter
 * Optional: description, quantity_unit, direct_emissions, indirect_emissions, uses_default_values, notes
 */
export function parseCbamImportCsv(csvContent: string): CbamImportParseResult {
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
    cnCode: headerIndex(headers, ["cn_code", "cncode", "cn", "commodity_code"]),
    description: headerIndex(headers, ["description", "goods_description", "name"]),
    quantity: headerIndex(headers, ["quantity", "net_mass", "mass", "qty"]),
    quantityUnit: headerIndex(headers, ["quantity_unit", "unit", "uom"]),
    direct: headerIndex(headers, ["direct_emissions", "direct", "see_direct"]),
    indirect: headerIndex(headers, ["indirect_emissions", "indirect", "see_indirect"]),
    defaults: headerIndex(headers, ["uses_default_values", "default_values", "defaults"]),
    country: headerIndex(headers, [
      "installation_country",
      "country",
      "country_code",
      "origin",
    ]),
    year: headerIndex(headers, ["reporting_year", "year"]),
    quarter: headerIndex(headers, ["reporting_quarter", "quarter", "q"]),
  };

  const errors: CbamImportValidationError[] = [];
  if (col.cnCode < 0) {
    errors.push({
      rowNumber: 1,
      field: "cn_code",
      value: "",
      error: "Missing required column cn_code",
    });
  }
  if (col.quantity < 0) {
    errors.push({
      rowNumber: 1,
      field: "quantity",
      value: "",
      error: "Missing required column quantity",
    });
  }
  if (col.country < 0) {
    errors.push({
      rowNumber: 1,
      field: "installation_country",
      value: "",
      error: "Missing required column installation_country",
    });
  }
  if (col.year < 0) {
    errors.push({
      rowNumber: 1,
      field: "reporting_year",
      value: "",
      error: "Missing required column reporting_year",
    });
  }
  if (col.quarter < 0) {
    errors.push({
      rowNumber: 1,
      field: "reporting_quarter",
      value: "",
      error: "Missing required column reporting_quarter",
    });
  }
  if (errors.length > 0) {
    return { valid: false, rows: [], errors };
  }

  const rows: CbamImportRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const rowNumber = i + 1;
    const cols = splitCsvLine(lines[i]!);
    const cnCode = cell(cols, col.cnCode);
    const quantityRaw = cell(cols, col.quantity);
    const country = cell(cols, col.country).toUpperCase();
    const yearRaw = cell(cols, col.year);
    const quarterRaw = cell(cols, col.quarter);
    const unitRaw = cell(cols, col.quantityUnit);
    const directRaw = cell(cols, col.direct);
    const indirectRaw = cell(cols, col.indirect);
    const description = cell(cols, col.description);

    if (!cnCode) {
      errors.push({
        rowNumber,
        field: "cn_code",
        value: cnCode,
        error: "CN code is required",
      });
      continue;
    }

    const quantity = parseOptionalNumber(quantityRaw);
    if (quantity === null || Number.isNaN(quantity) || quantity < 0) {
      errors.push({
        rowNumber,
        field: "quantity",
        value: quantityRaw,
        error: "quantity must be a non-negative number",
      });
      continue;
    }

    const unit = parseUnit(unitRaw);
    if (unit === null) {
      errors.push({
        rowNumber,
        field: "quantity_unit",
        value: unitRaw,
        error: "quantity_unit must be t, kg, or mwh",
      });
      continue;
    }

    if (!/^[A-Z]{2}$/.test(country)) {
      errors.push({
        rowNumber,
        field: "installation_country",
        value: country,
        error: "installation_country must be ISO 3166-1 alpha-2 (e.g. IN, TR, CN)",
      });
      continue;
    }

    const year = Number(yearRaw);
    if (!Number.isInteger(year) || year < 2023 || year > 2100) {
      errors.push({
        rowNumber,
        field: "reporting_year",
        value: yearRaw,
        error: "reporting_year must be an integer between 2023 and 2100",
      });
      continue;
    }

    const quarter = parseQuarter(quarterRaw);
    if (!quarter) {
      errors.push({
        rowNumber,
        field: "reporting_quarter",
        value: quarterRaw,
        error: "reporting_quarter must be 1–4 (or Q1–Q4)",
      });
      continue;
    }

    const directEmissions = parseOptionalNumber(directRaw);
    if (directEmissions !== null && Number.isNaN(directEmissions)) {
      errors.push({
        rowNumber,
        field: "direct_emissions",
        value: directRaw,
        error: "direct_emissions must be a number or empty",
      });
      continue;
    }

    const indirectEmissions = parseOptionalNumber(indirectRaw);
    if (indirectEmissions !== null && Number.isNaN(indirectEmissions)) {
      errors.push({
        rowNumber,
        field: "indirect_emissions",
        value: indirectRaw,
        error: "indirect_emissions must be a number or empty",
      });
      continue;
    }

    rows.push({
      rowNumber,
      cnCode,
      description: description || null,
      quantity,
      quantityUnit: unit,
      directEmissions,
      indirectEmissions,
      usesDefaultValues: parseBool(cell(cols, col.defaults)),
      installationCountry: country,
      reportingYear: year,
      reportingQuarter: quarter,
    });
  }

  return {
    valid: errors.length === 0,
    rows,
    errors,
  };
}

export const CBAM_CSV_TEMPLATE = [
  "cn_code,description,quantity,quantity_unit,direct_emissions,indirect_emissions,uses_default_values,installation_country,reporting_year,reporting_quarter",
  "7208,Hot-rolled coil,120.5,t,1.85,0.12,false,IN,2026,1",
  "7601,Unwrought aluminium,40,t,,,true,CN,2026,1",
].join("\n");
