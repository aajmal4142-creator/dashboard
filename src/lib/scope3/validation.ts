import type { ValidationError, ActivityDataField } from "./types";

export class Scope3Validator {
  // Validate activity data against source schema
  async validateActivity(
    activityData: Record<string, string | number>,
    requiredFields: ActivityDataField[],
  ): Promise<{
    valid: boolean;
    errors: ValidationError[];
    normalizedData?: Record<string, number>;
  }> {
    const errors: ValidationError[] = [];
    const normalizedData: Record<string, number> = {};

    // Check required fields
    for (const field of requiredFields) {
      if (
        field.required &&
        !Object.prototype.hasOwnProperty.call(activityData, field.name)
      ) {
        errors.push({
          field: field.name,
          message: `Required field missing: ${field.name}`,
        });
        continue;
      }

      const value = activityData[field.name];
      if (value === null || value === undefined) {
        if (field.required) {
          errors.push({
            field: field.name,
            message: `Field cannot be empty: ${field.name}`,
            value,
          });
        }
        continue;
      }

      // Validate data type
      if (typeof value !== "number" && typeof value !== "string") {
        errors.push({
          field: field.name,
          message: `Invalid data type for ${field.name}: expected number or string, got ${typeof value}`,
          value,
        });
        continue;
      }

      // Try to convert to number
      const numValue = typeof value === "string" ? parseFloat(value) : value;
      if (isNaN(numValue)) {
        errors.push({
          field: field.name,
          message: `Cannot convert ${field.name} to number: "${value}"`,
          value,
        });
        continue;
      }

      // Check for reasonable range (no negative values)
      if (numValue < 0) {
        errors.push({
          field: field.name,
          message: `${field.name} cannot be negative: ${numValue}`,
          value: numValue,
        });
        continue;
      }

      normalizedData[field.name] = numValue;
    }

    // Check for unexpected fields (optional - warn but don't fail)
    for (const key of Object.keys(activityData)) {
      if (!requiredFields.some((f) => f.name === key)) {
        // Ignore unknown fields (extra columns in CSV)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      normalizedData: errors.length === 0 ? normalizedData : undefined,
    };
  }

  // Detect anomalies using statistical methods
  detectAnomalies(
    activityValue: number,
    historicalData: number[],
  ): {
    isAnomaly: boolean;
    reason?: string;
    zscore?: number;
  } {
    if (historicalData.length === 0) {
      return { isAnomaly: false };
    }

    // Calculate mean and std dev
    const mean = historicalData.reduce((a, b) => a + b, 0) / historicalData.length;
    const variance =
      historicalData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      historicalData.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) {
      // All historical values are the same
      if (activityValue !== mean) {
        return {
          isAnomaly: false, // Different but not statistically anomalous
        };
      }
      return { isAnomaly: false };
    }

    // Calculate z-score
    const zscore = Math.abs((activityValue - mean) / stdDev);

    // Threshold: 3 standard deviations (0.3% probability)
    if (zscore > 3) {
      return {
        isAnomaly: true,
        reason: `Activity value (${activityValue}) is ${zscore.toFixed(2)}σ from historical mean (${mean.toFixed(2)})`,
        zscore,
      };
    }

    // Warning threshold: 2 standard deviations
    if (zscore > 2) {
      return {
        isAnomaly: false, // Not a hard anomaly, but warn
        reason: `Activity value (${activityValue}) is ${zscore.toFixed(2)}σ from historical mean (${mean.toFixed(2)}) - review recommended`,
        zscore,
      };
    }

    return { isAnomaly: false, zscore };
  }

  // Check for duplicates (same source/period/activity data)
  isDuplicate(
    activityData: Record<string, number>,
    historicalEntries: Array<Record<string, number>>,
  ): boolean {
    return historicalEntries.some((entry) => {
      return Object.keys(activityData).every((key) => entry[key] === activityData[key]);
    });
  }

  // Validate CSV row (multiple rows at once)
  validateCSVRow(
    row: Record<string, string | number>,
    requiredFields: ActivityDataField[],
    rowIndex: number,
  ): {
    valid: boolean;
    errors: ValidationError[];
    normalizedData?: Record<string, number>;
  } {
    const errors: ValidationError[] = [];
    const normalizedData: Record<string, number> = {};

    for (const field of requiredFields) {
      if (!(field.name in row)) {
        if (field.required) {
          errors.push({
            field: field.name,
            message: `Row ${rowIndex}: Missing required field`,
          });
        }
        continue;
      }

      const value = row[field.name];

      if (value === "" || value === null || value === undefined) {
        if (field.required) {
          errors.push({
            field: field.name,
            message: `Row ${rowIndex}: Empty value for required field`,
          });
        }
        continue;
      }

      const numValue = typeof value === "string" ? parseFloat(value) : value;
      if (isNaN(numValue)) {
        errors.push({
          field: field.name,
          message: `Row ${rowIndex}: Cannot convert "${value}" to number`,
          value,
        });
        continue;
      }

      if (numValue < 0) {
        errors.push({
          field: field.name,
          message: `Row ${rowIndex}: Negative value not allowed (${numValue})`,
          value: numValue,
        });
        continue;
      }

      normalizedData[field.name] = numValue;
    }

    return {
      valid: errors.length === 0,
      errors,
      normalizedData: errors.length === 0 ? normalizedData : undefined,
    };
  }
}
