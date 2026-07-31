import type {
  ApiRuleCondition,
  AppRuleType,
  CrossFieldOperator,
  DatapointRecord,
  EvaluableRule,
  PatternConfig,
  RangeConfig,
  RequiredConfig,
  RuleSeverity,
  StoredRuleType,
  ValidationResult,
  ValidationViolation,
} from "./types";
import { CROSS_FIELD_OPERATORS, RULE_TYPES, SEVERITIES } from "./types";

export function isAppRuleType(value: string): value is AppRuleType {
  return (RULE_TYPES as readonly string[]).includes(value);
}

export function isRuleSeverity(value: string): value is RuleSeverity {
  return (SEVERITIES as readonly string[]).includes(value);
}

export function normalizeStoredRuleType(
  ruleType: StoredRuleType | string,
): StoredRuleType {
  if (ruleType === "regex") return "pattern";
  return ruleType as StoredRuleType;
}

export function toAppRuleType(ruleType: StoredRuleType | string): AppRuleType {
  const normalized = normalizeStoredRuleType(ruleType);
  if (isAppRuleType(normalized)) return normalized;
  // Legacy business/uniqueness/referential → treat as cross_field for API surface
  return "cross_field";
}

export function toStoredRuleType(ruleType: AppRuleType): StoredRuleType {
  return ruleType;
}

export function severityFromLegacy(opts: {
  severity?: string | null;
  priority?: string | null;
  action?: string | null;
}): RuleSeverity {
  if (opts.severity === "error" || opts.severity === "warning") return opts.severity;
  if (opts.action === "block") return "error";
  if (opts.action === "warn") return "warning";
  if (opts.priority === "critical" || opts.priority === "high") return "error";
  return "warning";
}

export function actionFromSeverity(severity: RuleSeverity): "block" | "warn" {
  return severity === "error" ? "block" : "warn";
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  return true;
}

function fieldValue(datapoint: DatapointRecord, field: string): unknown {
  return datapoint[field];
}

export function parseRuleConfig(raw: unknown): ApiRuleCondition {
  const obj = asObject(raw);
  const condition: ApiRuleCondition = {};

  const field = asString(obj.field);
  if (field) condition.field = field;

  const field1 = asString(obj.field1);
  if (field1) condition.field1 = field1;

  const field2 = asString(obj.field2);
  if (field2) condition.field2 = field2;

  const operator = asString(obj.operator);
  if (operator) condition.operator = operator;

  if ("value" in obj) condition.value = obj.value;
  if ("secondValue" in obj) condition.secondValue = obj.secondValue;

  const min = asNumber(obj.min);
  if (min !== undefined) condition.min = min;
  const max = asNumber(obj.max);
  if (max !== undefined) condition.max = max;

  // Support sprint between-style via value/secondValue
  if (min === undefined && asNumber(obj.value) !== undefined) {
    condition.min = asNumber(obj.value);
  }
  if (max === undefined && asNumber(obj.secondValue) !== undefined) {
    condition.max = asNumber(obj.secondValue);
  }

  const pattern = asString(obj.pattern);
  if (pattern) condition.pattern = pattern;

  const whenField = asString(obj.whenField);
  if (whenField) condition.whenField = whenField;
  if ("whenValue" in obj) {
    const wv = obj.whenValue;
    if (
      wv === null ||
      typeof wv === "string" ||
      typeof wv === "number" ||
      typeof wv === "boolean"
    ) {
      condition.whenValue = wv;
    }
  }

  return condition;
}

/** Normalize API condition into storable ruleConfig. */
export function buildRuleConfig(
  ruleType: AppRuleType,
  condition: ApiRuleCondition,
): Record<string, unknown> {
  switch (ruleType) {
    case "range": {
      const field = condition.field ?? "value";
      const min = condition.min ?? asNumber(condition.value) ?? undefined;
      const max = condition.max ?? asNumber(condition.secondValue) ?? undefined;
      const config: Record<string, unknown> = { field };
      if (min !== undefined) config.min = min;
      if (max !== undefined) config.max = max;
      return config;
    }
    case "required": {
      const config: Record<string, unknown> = {
        field: condition.field ?? "value",
      };
      if (condition.whenField) {
        config.whenField = condition.whenField;
        if ("whenValue" in condition) config.whenValue = condition.whenValue ?? null;
      }
      return config;
    }
    case "pattern": {
      return {
        field: condition.field ?? "value",
        pattern: condition.pattern ?? "",
      };
    }
    case "cross_field": {
      return {
        field1: condition.field1 ?? condition.field ?? "value",
        field2: condition.field2 ?? "",
        operator: condition.operator ?? "equal",
      };
    }
  }
}

function validateRange(
  config: RangeConfig,
  datapoint: DatapointRecord,
): { passed: boolean; message: string; fieldName: string; value: unknown } {
  const field = config.field;
  const raw = fieldValue(datapoint, field);
  const value = Number(raw);
  const min = config.min;
  const max = config.max;

  if (!isPresent(raw) || !Number.isFinite(value)) {
    return {
      passed: false,
      message: `${field} must be a number`,
      fieldName: field,
      value: raw,
    };
  }

  if (min !== undefined && value < min) {
    return {
      passed: false,
      message: `Value ${value} is below minimum ${min}`,
      fieldName: field,
      value,
    };
  }
  if (max !== undefined && value > max) {
    return {
      passed: false,
      message: `Value ${value} is above maximum ${max}`,
      fieldName: field,
      value,
    };
  }
  if (min !== undefined && max !== undefined && (value < min || value > max)) {
    return {
      passed: false,
      message: `Value ${value} is outside valid range [${min}, ${max}]`,
      fieldName: field,
      value,
    };
  }

  return {
    passed: true,
    message: "Range validation passed",
    fieldName: field,
    value,
  };
}

function validateRequired(
  config: RequiredConfig,
  datapoint: DatapointRecord,
): { passed: boolean; message: string; fieldName: string; value: unknown } {
  const field = config.field;
  const raw = fieldValue(datapoint, field);

  if (config.whenField) {
    const trigger = fieldValue(datapoint, config.whenField);
    const expected = config.whenValue;
    const matches =
      expected === undefined ? isPresent(trigger) : String(trigger) === String(expected);
    if (!matches) {
      return {
        passed: true,
        message: "Conditional required skipped",
        fieldName: field,
        value: raw,
      };
    }
  }

  if (!isPresent(raw)) {
    return {
      passed: false,
      message: `${field} is required`,
      fieldName: field,
      value: raw,
    };
  }

  return {
    passed: true,
    message: "Required validation passed",
    fieldName: field,
    value: raw,
  };
}

function validatePattern(
  config: PatternConfig,
  datapoint: DatapointRecord,
): { passed: boolean; message: string; fieldName: string; value: unknown } {
  const field = config.field;
  const value = String(fieldValue(datapoint, field) ?? "");
  const pattern = config.pattern;

  if (!pattern) {
    return {
      passed: true,
      message: "No pattern configured",
      fieldName: field,
      value,
    };
  }

  try {
    const regex = new RegExp(pattern);
    if (!regex.test(value)) {
      return {
        passed: false,
        message: `Value "${value}" does not match pattern ${pattern}`,
        fieldName: field,
        value,
      };
    }
  } catch {
    return {
      passed: false,
      message: `Invalid pattern ${pattern}`,
      fieldName: field,
      value,
    };
  }

  return {
    passed: true,
    message: "Pattern validation passed",
    fieldName: field,
    value,
  };
}

function isCrossFieldOperator(value: string): value is CrossFieldOperator {
  return (CROSS_FIELD_OPERATORS as readonly string[]).includes(value);
}

function validateCrossField(
  config: { field1: string; field2: string; operator: string },
  datapoint: DatapointRecord,
): { passed: boolean; message: string; fieldName: string; value: unknown } {
  const field1 = config.field1;
  const field2 = config.field2;
  const value1 = fieldValue(datapoint, field1);
  const value2 = fieldValue(datapoint, field2);
  const operator = config.operator;

  let passed = true;
  let message = "Cross-field validation passed";

  switch (operator) {
    case "equal":
      passed = value1 === value2 || String(value1) === String(value2);
      message = `${field1} should equal ${field2}`;
      break;
    case "not_equal":
      passed = !(value1 === value2 || String(value1) === String(value2));
      message = `${field1} should not equal ${field2}`;
      break;
    case "greater":
      passed = Number(value1) > Number(value2);
      message = `${field1} should be greater than ${field2}`;
      break;
    case "less":
      passed = Number(value1) < Number(value2);
      message = `${field1} should be less than ${field2}`;
      break;
    case "gte":
      passed = Number(value1) >= Number(value2);
      message = `${field1} should be greater than or equal to ${field2}`;
      break;
    case "lte":
      passed = Number(value1) <= Number(value2);
      message = `${field1} should be less than or equal to ${field2}`;
      break;
    default:
      passed = true;
      message = "Unknown cross-field operator";
  }

  return {
    passed,
    message: passed ? "Cross-field validation passed" : message,
    fieldName: field1,
    value: value1,
  };
}

function validateBusinessLogic(
  config: Record<string, unknown>,
  datapoint: DatapointRecord,
): { passed: boolean; message: string; fieldName: string; value: unknown } {
  const logic = asString(config.logic) ?? "";

  if (logic.includes("scope1") && logic.includes("scope2")) {
    const scope1 = Number(datapoint.scope1Total ?? 0);
    const scope2 = Number(datapoint.scope2Total ?? 0);
    const scope3 = Number(datapoint.scope3Total ?? 0);
    const sum = Math.round((scope1 + scope2 + scope3) * 100) / 100;
    const expectedTotal = Number(datapoint.totalEmissions ?? 0);

    if (Math.abs(sum - expectedTotal) > 1) {
      return {
        passed: false,
        message: `Scope totals (${sum}) do not equal reported total (${expectedTotal})`,
        fieldName: "totalEmissions",
        value: expectedTotal,
      };
    }
  }

  return {
    passed: true,
    message: "Business logic validation passed",
    fieldName: "unknown",
    value: undefined,
  };
}

/**
 * Evaluate a single rule against a datapoint record. Pure — no I/O.
 */
export function evaluateRule(
  rule: EvaluableRule,
  datapoint: DatapointRecord,
): { passed: boolean; message: string; fieldName: string; value: unknown } {
  const ruleType = normalizeStoredRuleType(rule.ruleType);
  const raw = asObject(rule.ruleConfig);

  switch (ruleType) {
    case "range": {
      const field = asString(raw.field) ?? "value";
      return validateRange(
        {
          field,
          min: asNumber(raw.min),
          max: asNumber(raw.max),
        },
        datapoint,
      );
    }
    case "required": {
      const field = asString(raw.field) ?? "value";
      const whenField = asString(raw.whenField);
      const config: RequiredConfig = { field };
      if (whenField) {
        config.whenField = whenField;
        const wv = raw.whenValue;
        if (
          wv === null ||
          typeof wv === "string" ||
          typeof wv === "number" ||
          typeof wv === "boolean"
        ) {
          config.whenValue = wv;
        }
      }
      return validateRequired(config, datapoint);
    }
    case "pattern":
    case "regex": {
      return validatePattern(
        {
          field: asString(raw.field) ?? "value",
          pattern: asString(raw.pattern) ?? "",
        },
        datapoint,
      );
    }
    case "cross_field": {
      const operator = asString(raw.operator) ?? "equal";
      return validateCrossField(
        {
          field1: asString(raw.field1) ?? asString(raw.field) ?? "value",
          field2: asString(raw.field2) ?? "",
          operator: isCrossFieldOperator(operator) ? operator : "equal",
        },
        datapoint,
      );
    }
    case "business":
      return validateBusinessLogic(raw, datapoint);
    case "uniqueness":
    case "referential":
      return {
        passed: true,
        message: "Rule type not evaluated in-process",
        fieldName: "unknown",
        value: undefined,
      };
    default:
      return {
        passed: true,
        message: "Unknown rule type",
        fieldName: "unknown",
        value: undefined,
      };
  }
}

export function evaluateRules(
  rules: EvaluableRule[],
  datapoint: DatapointRecord,
): ValidationResult {
  const violations: ValidationViolation[] = [];

  for (const rule of rules) {
    const result = evaluateRule(rule, datapoint);
    if (!result.passed) {
      const message =
        rule.errorMessage && rule.errorMessage.trim().length > 0
          ? rule.errorMessage.trim()
          : result.message;
      violations.push({
        ruleId: rule.id,
        ruleName: rule.ruleName,
        fieldName: result.fieldName,
        value: result.value,
        message,
        severity: rule.severity,
        action: rule.action,
      });
    }
  }

  const errors = violations.filter((v) => v.severity === "error");
  const warnings = violations.filter((v) => v.severity === "warning");

  return {
    passed: violations.length === 0,
    canApprove: errors.length === 0,
    violations,
    errors,
    warnings,
  };
}

export function validateApiRuleInput(body: unknown):
  | {
      ok: true;
      data: {
        name: string;
        description?: string;
        ruleType: AppRuleType;
        condition: ApiRuleCondition;
        errorMessage?: string;
        severity: RuleSeverity;
        enabled: boolean;
      };
    }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Body must be an object" };
  }
  const obj = body as Record<string, unknown>;
  const name = asString(obj.name) ?? asString(obj.ruleName);
  if (!name) return { ok: false, error: "name is required" };

  const ruleTypeRaw = asString(obj.ruleType);
  if (!ruleTypeRaw || !isAppRuleType(ruleTypeRaw)) {
    return {
      ok: false,
      error: `ruleType must be one of: ${RULE_TYPES.join(", ")}`,
    };
  }

  const conditionRaw = obj.condition ?? obj.ruleConfig ?? {};
  if (!conditionRaw || typeof conditionRaw !== "object" || Array.isArray(conditionRaw)) {
    return { ok: false, error: "condition must be an object" };
  }
  const condition = parseRuleConfig(conditionRaw);

  if (ruleTypeRaw === "range" && !condition.field) {
    return { ok: false, error: "range rules require condition.field" };
  }
  if (
    ruleTypeRaw === "range" &&
    condition.min === undefined &&
    condition.max === undefined
  ) {
    return { ok: false, error: "range rules require condition.min and/or condition.max" };
  }
  if (ruleTypeRaw === "required" && !condition.field) {
    return { ok: false, error: "required rules require condition.field" };
  }
  if (ruleTypeRaw === "pattern") {
    if (!condition.field)
      return { ok: false, error: "pattern rules require condition.field" };
    if (!condition.pattern)
      return { ok: false, error: "pattern rules require condition.pattern" };
    try {
      void new RegExp(condition.pattern);
    } catch {
      return { ok: false, error: "condition.pattern is not a valid regular expression" };
    }
  }
  if (ruleTypeRaw === "cross_field") {
    if (!condition.field1 && !condition.field) {
      return { ok: false, error: "cross_field rules require condition.field1" };
    }
    if (!condition.field2) {
      return { ok: false, error: "cross_field rules require condition.field2" };
    }
  }

  const severityRaw = asString(obj.severity) ?? "error";
  if (!isRuleSeverity(severityRaw)) {
    return { ok: false, error: "severity must be error or warning" };
  }

  const enabled =
    typeof obj.enabled === "boolean"
      ? obj.enabled
      : obj.status === "inactive"
        ? false
        : true;

  const description = asString(obj.description);
  const errorMessage = asString(obj.errorMessage);

  return {
    ok: true,
    data: {
      name,
      description,
      ruleType: ruleTypeRaw,
      condition,
      errorMessage,
      severity: severityRaw,
      enabled,
    },
  };
}
