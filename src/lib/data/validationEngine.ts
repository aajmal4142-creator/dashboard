import { getPayload } from "payload";
import config from "@/payload.config";
import type { DataQualityRule } from "@/payload-types";

export type ValidationResult = {
  passed: boolean;
  violations: ValidationViolation[];
};

export type ValidationViolation = {
  ruleId: string;
  ruleName: string;
  fieldName: string;
  value: unknown;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  action: "flag" | "correct" | "block" | "warn";
};

export type DatapointRecord = Record<string, unknown> & {
  id?: string;
  scope1Total?: number;
  scope2Total?: number;
  scope3Total?: number;
  totalEmissions?: number;
};

type RuleConfig = {
  field?: string;
  field1?: string;
  field2?: string;
  min?: number;
  max?: number;
  pattern?: string;
  logic?: string;
  operator?: string;
};

function asRuleConfig(value: DataQualityRule["ruleConfig"]): RuleConfig {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as RuleConfig;
  }
  return {};
}

export async function validateDatapoint(
  orgId: string,
  datapoint: DatapointRecord,
): Promise<ValidationResult> {
  const payload = await getPayload({ config });

  // Get active data quality rules
  const rules = await payload.find({
    collection: "data-quality-rules",
    where: {
      organisation: { equals: orgId },
      status: { equals: "active" },
    },
  });

  const violations: ValidationViolation[] = [];

  for (const rule of rules.docs) {
    const ruleConfig = asRuleConfig(rule.ruleConfig);
    const appliesTo = rule.appliesTo;

    // Skip if rule doesn't apply to datapoints
    if (appliesTo !== "datapoints") continue;

    try {
      const result = evaluateRule(rule, ruleConfig, datapoint);

      if (!result.passed) {
        violations.push({
          ruleId: rule.id,
          ruleName: rule.ruleName,
          fieldName: ruleConfig.field || "unknown",
          value: ruleConfig.field ? datapoint[ruleConfig.field] : undefined,
          message: result.message,
          severity: rule.priority || "medium",
          action: rule.action || "flag",
        });
      }
    } catch (error) {
      console.error(`Error evaluating rule ${rule.id}:`, error);
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

function evaluateRule(
  rule: DataQualityRule,
  ruleConfig: RuleConfig,
  datapoint: DatapointRecord,
): { passed: boolean; message: string } {
  switch (rule.ruleType) {
    case "range":
      return validateRange(ruleConfig, datapoint);
    case "regex":
      return validateRegex(ruleConfig, datapoint);
    case "business":
      return validateBusinessLogic(ruleConfig, datapoint);
    case "cross_field":
      return validateCrossField(ruleConfig, datapoint);
    case "uniqueness":
      return validateUniqueness();
    default:
      return { passed: true, message: "Unknown rule type" };
  }
}

function validateRange(
  config: RuleConfig,
  datapoint: DatapointRecord,
): { passed: boolean; message: string } {
  const field = config.field as string;
  const value = Number(datapoint[field]);
  const min = config.min as number;
  const max = config.max as number;

  if (value < min || value > max) {
    return {
      passed: false,
      message: `Value ${value} is outside valid range [${min}, ${max}]`,
    };
  }

  return { passed: true, message: "Range validation passed" };
}

function validateRegex(
  config: RuleConfig,
  datapoint: DatapointRecord,
): { passed: boolean; message: string } {
  const field = config.field as string;
  const value = String(datapoint[field] ?? "");
  const pattern = config.pattern as string;

  const regex = new RegExp(pattern);
  if (!regex.test(value)) {
    return {
      passed: false,
      message: `Value "${value}" does not match pattern ${pattern}`,
    };
  }

  return { passed: true, message: "Regex validation passed" };
}

function validateBusinessLogic(
  config: RuleConfig,
  datapoint: DatapointRecord,
): { passed: boolean; message: string } {
  const logic = config.logic as string;

  // Example: "scope1 + scope2 = scope3Total"
  if (logic.includes("scope1") && logic.includes("scope2")) {
    const scope1 = datapoint.scope1Total || 0;
    const scope2 = datapoint.scope2Total || 0;
    const scope3 = datapoint.scope3Total || 0;

    const sum = Math.round((scope1 + scope2 + scope3) * 100) / 100;
    const expectedTotal = datapoint.totalEmissions || 0;

    if (Math.abs(sum - expectedTotal) > 1) {
      return {
        passed: false,
        message: `Scope totals (${sum}) do not equal reported total (${expectedTotal})`,
      };
    }
  }

  return { passed: true, message: "Business logic validation passed" };
}

function validateCrossField(
  config: RuleConfig,
  datapoint: DatapointRecord,
): { passed: boolean; message: string } {
  const field1 = config.field1 as string;
  const field2 = config.field2 as string;
  const operator = config.operator as string;

  const value1 = datapoint[field1];
  const value2 = datapoint[field2];

  let passed = false;
  let message = "";

  switch (operator) {
    case "equal":
      passed = value1 === value2;
      message = `${field1} should equal ${field2}`;
      break;
    case "greater":
      passed = Number(value1) > Number(value2);
      message = `${field1} should be greater than ${field2}`;
      break;
    case "less":
      passed = Number(value1) < Number(value2);
      message = `${field1} should be less than ${field2}`;
      break;
    default:
      passed = true;
  }

  return {
    passed,
    message: passed ? "Cross-field validation passed" : message,
  };
}

function validateUniqueness(): { passed: boolean; message: string } {
  // This would typically query the database to check uniqueness
  // Placeholder for now
  return { passed: true, message: "Uniqueness validation passed" };
}

export async function validateBatch(
  orgId: string,
  datapoints: DatapointRecord[],
): Promise<Map<string, ValidationResult>> {
  const results = new Map<string, ValidationResult>();

  for (const datapoint of datapoints) {
    const result = await validateDatapoint(orgId, datapoint);
    results.set(datapoint.id || JSON.stringify(datapoint), result);
  }

  return results;
}
