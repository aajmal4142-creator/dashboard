export type FactorImportRow = {
  factorName: string;
  category: string;
  subcategory?: string;
  value: number;
  unit: string;
  source: string;
  region?: string;
  effectiveDate: string;
  confidence?: "low" | "medium" | "high";
  uncertainty?: number;
};

export type ValidationError = {
  rowNumber: number;
  field: string;
  value: unknown;
  error: string;
};

const VALID_CATEGORIES = [
  "energy",
  "transport",
  "water",
  "waste",
  "procurement",
  "manufacturing",
  "travel",
  "commuting",
  "raw_materials",
  "packaging",
  "fuel_energy",
  "services",
  "transportation",
  "facilities",
  "it",
];

const VALID_UNITS = [
  "kg_co2e_kwh",
  "kg_co2e_liter",
  "kg_co2e_kg",
  "kg_co2e_m3",
  "kg_co2e_mile",
  "kg_co2e_km",
  "kg_co2e_usd",
  "kg_co2e_eur",
  "kg_co2e_gbp",
  "kg_co2e_inr",
  "kg_co2e_employee",
];

export function validateFactorRow(
  row: Record<string, unknown>,
  rowNumber: number,
): { valid: boolean; errors: ValidationError[]; data?: FactorImportRow } {
  const errors: ValidationError[] = [];

  // Required fields
  if (!row.factorName || typeof row.factorName !== "string") {
    errors.push({
      rowNumber,
      field: "factorName",
      value: row.factorName,
      error: "factorName is required and must be a string",
    });
  }

  if (!row.category || !VALID_CATEGORIES.includes(String(row.category))) {
    errors.push({
      rowNumber,
      field: "category",
      value: row.category,
      error: `category is required and must be one of: ${VALID_CATEGORIES.join(", ")}`,
    });
  }

  if (row.value === undefined || row.value === null || typeof row.value !== "number") {
    errors.push({
      rowNumber,
      field: "value",
      value: row.value,
      error: "value is required and must be a number",
    });
  } else if (row.value < 0) {
    errors.push({
      rowNumber,
      field: "value",
      value: row.value,
      error: "value cannot be negative",
    });
  }

  if (!row.unit || !VALID_UNITS.includes(String(row.unit))) {
    errors.push({
      rowNumber,
      field: "unit",
      value: row.unit,
      error: `unit is required and must be one of: ${VALID_UNITS.join(", ")}`,
    });
  }

  if (!row.source || typeof row.source !== "string") {
    errors.push({
      rowNumber,
      field: "source",
      value: row.source,
      error: "source is required and must be a string",
    });
  }

  if (row.effectiveDate) {
    const date = new Date(String(row.effectiveDate));
    if (isNaN(date.getTime())) {
      errors.push({
        rowNumber,
        field: "effectiveDate",
        value: row.effectiveDate,
        error: "effectiveDate must be a valid ISO date string",
      });
    }
  }

  if (row.confidence && !["low", "medium", "high"].includes(String(row.confidence))) {
    errors.push({
      rowNumber,
      field: "confidence",
      value: row.confidence,
      error: "confidence must be one of: low, medium, high",
    });
  }

  if (row.uncertainty !== undefined) {
    if (typeof row.uncertainty !== "number") {
      errors.push({
        rowNumber,
        field: "uncertainty",
        value: row.uncertainty,
        error: "uncertainty must be a number",
      });
    } else if (row.uncertainty < 0 || row.uncertainty > 100) {
      errors.push({
        rowNumber,
        field: "uncertainty",
        value: row.uncertainty,
        error: "uncertainty must be between 0 and 100",
      });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      factorName: String(row.factorName),
      category: String(row.category),
      subcategory: typeof row.subcategory === "string" ? row.subcategory : "",
      value: Number(row.value),
      unit: String(row.unit),
      source: String(row.source),
      region: typeof row.region === "string" ? row.region : "Global",
      effectiveDate:
        typeof row.effectiveDate === "string"
          ? row.effectiveDate
          : new Date().toISOString(),
      confidence:
        row.confidence === "low" ||
        row.confidence === "medium" ||
        row.confidence === "high"
          ? row.confidence
          : "medium",
      uncertainty: typeof row.uncertainty === "number" ? row.uncertainty : 25,
    },
  };
}

export function validateBatch(rows: unknown[]): {
  valid: boolean;
  errors: ValidationError[];
  data?: FactorImportRow[];
} {
  const errors: ValidationError[] = [];
  const data: FactorImportRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const record = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    const result = validateFactorRow(record, i + 2); // Row numbers start at 2 (header = 1)

    if (!result.valid) {
      errors.push(...result.errors);
    } else if (result.data) {
      data.push(result.data);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : undefined,
  };
}

export function deduplicateFactors(factors: FactorImportRow[]): {
  deduplicated: FactorImportRow[];
  duplicates: Array<{ factor: FactorImportRow; count: number }>;
} {
  const seen = new Map<string, number>();
  const deduplicated: FactorImportRow[] = [];
  const duplicates: Array<{ factor: FactorImportRow; count: number }> = [];

  for (const factor of factors) {
    const key = `${factor.category}|${factor.subcategory}|${factor.unit}|${factor.region}`;
    const count = (seen.get(key) || 0) + 1;
    seen.set(key, count);

    if (count === 1) {
      deduplicated.push(factor);
    } else {
      // Track as duplicate
      const existing = duplicates.find((d) => d.factor === factor);
      if (existing) {
        existing.count++;
      } else {
        duplicates.push({ factor, count });
      }
    }
  }

  return { deduplicated, duplicates };
}
