export interface HistoricalDataRow {
  year: number;
  metricKey: string;
  value: number;
  quality?: string;
  supplier?: string;
  notes?: string;
}

export interface BackfillValidationError {
  row: number;
  field: string;
  value: unknown;
  message: string;
}

export interface BackfillResult {
  imported: number;
  errors: BackfillValidationError[];
  yearRange: { min: number; max: number };
  summary: {
    byYear: Record<number, number>;
    byMetric: Record<string, number>;
  };
}

const VALID_YEARS = Array.from({ length: 6 }, (_, i) => 2020 + i); // 2020-2025
const METRIC_REGEX = /^[a-z_]+\.?[a-z0-9_]*$/i;

export function validateHistoricalRow(
  row: HistoricalDataRow,
  rowIndex: number,
  validMetrics: Set<string>,
): BackfillValidationError[] {
  const errors: BackfillValidationError[] = [];

  // Validate year
  if (!row.year || !VALID_YEARS.includes(row.year)) {
    errors.push({
      row: rowIndex,
      field: "year",
      value: row.year,
      message: `Year must be between 2020-2025, got ${row.year}`,
    });
  }

  // Validate metricKey
  if (!row.metricKey || !METRIC_REGEX.test(row.metricKey)) {
    errors.push({
      row: rowIndex,
      field: "metricKey",
      value: row.metricKey,
      message: `Invalid metric key format: ${row.metricKey}`,
    });
  } else if (!validMetrics.has(row.metricKey)) {
    errors.push({
      row: rowIndex,
      field: "metricKey",
      value: row.metricKey,
      message: `Unknown metric key: ${row.metricKey}. Not in current metric definitions.`,
    });
  }

  // Validate value
  if (typeof row.value !== "number" || row.value < 0) {
    errors.push({
      row: rowIndex,
      field: "value",
      value: row.value,
      message: `Value must be a non-negative number, got ${row.value}`,
    });
  }

  // Validate quality if present
  if (row.quality) {
    const validQualities = ["measured", "metered", "estimated", "supplier"];
    if (!validQualities.includes(row.quality.toLowerCase())) {
      errors.push({
        row: rowIndex,
        field: "quality",
        value: row.quality,
        message: `Quality must be one of: ${validQualities.join(", ")}, got ${row.quality}`,
      });
    }
  }

  return errors;
}

export async function validateHistoricalBackfill(
  rows: HistoricalDataRow[],
  validMetrics: Set<string>,
): Promise<{ isValid: boolean; errors: BackfillValidationError[] }> {
  const allErrors: BackfillValidationError[] = [];

  rows.forEach((row, idx) => {
    const rowErrors = validateHistoricalRow(row, idx + 2, validMetrics); // row 2 is first data row
    allErrors.push(...rowErrors);
  });

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
}

export function calculateBackfillSummary(rows: HistoricalDataRow[]): {
  yearRange: { min: number; max: number };
  summary: { byYear: Record<number, number>; byMetric: Record<string, number> };
} {
  const byYear: Record<number, number> = {};
  const byMetric: Record<string, number> = {};
  let minYear = 2025;
  let maxYear = 2020;

  rows.forEach((row) => {
    if (row.year >= 2020 && row.year <= 2025) {
      byYear[row.year] = (byYear[row.year] || 0) + 1;
      byMetric[row.metricKey] = (byMetric[row.metricKey] || 0) + 1;
      minYear = Math.min(minYear, row.year);
      maxYear = Math.max(maxYear, row.year);
    }
  });

  return {
    yearRange: { min: minYear, max: maxYear },
    summary: { byYear, byMetric },
  };
}
