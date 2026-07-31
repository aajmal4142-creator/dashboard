/** Custom validation rule types exposed by the app API / UI. */
export const RULE_TYPES = ["range", "required", "pattern", "cross_field"] as const;
export type AppRuleType = (typeof RULE_TYPES)[number];

/** Stored Payload ruleType values (includes legacy aliases). */
export type StoredRuleType =
  AppRuleType | "regex" | "business" | "uniqueness" | "referential";

export const SEVERITIES = ["error", "warning"] as const;
export type RuleSeverity = (typeof SEVERITIES)[number];

export const CROSS_FIELD_OPERATORS = [
  "equal",
  "greater",
  "less",
  "gte",
  "lte",
  "not_equal",
] as const;
export type CrossFieldOperator = (typeof CROSS_FIELD_OPERATORS)[number];

export type RangeConfig = {
  field: string;
  min?: number;
  max?: number;
};

export type RequiredConfig = {
  field: string;
  /** When set, field is required only if whenField equals whenValue. */
  whenField?: string;
  whenValue?: string | number | boolean | null;
};

export type PatternConfig = {
  field: string;
  pattern: string;
};

export type CrossFieldConfig = {
  field1: string;
  field2: string;
  operator: CrossFieldOperator;
};

export type RuleConfig =
  | RangeConfig
  | RequiredConfig
  | PatternConfig
  | CrossFieldConfig
  | Record<string, unknown>;

export type DatapointRecord = Record<string, unknown> & {
  id?: string;
  metricKey?: string;
  value?: number | null;
  quality?: string | null;
  unit?: string | null;
  source?: string | null;
  approvalState?: string | null;
  provenance?: string | null;
  supplierKey?: string | null;
  scope1Total?: number;
  scope2Total?: number;
  scope3Total?: number;
  totalEmissions?: number;
};

export type EvaluableRule = {
  id: string;
  ruleName: string;
  ruleType: StoredRuleType;
  ruleConfig: unknown;
  severity: RuleSeverity;
  action: "flag" | "correct" | "block" | "warn";
  errorMessage?: string | null;
};

export type ValidationViolation = {
  ruleId: string;
  ruleName: string;
  fieldName: string;
  value: unknown;
  message: string;
  severity: RuleSeverity;
  action: "flag" | "correct" | "block" | "warn";
};

export type ValidationResult = {
  passed: boolean;
  /** True when no error-severity violations (warnings allowed). */
  canApprove: boolean;
  violations: ValidationViolation[];
  errors: ValidationViolation[];
  warnings: ValidationViolation[];
};

export type ApiRuleCondition = {
  field?: string;
  field1?: string;
  field2?: string;
  operator?: string;
  value?: unknown;
  secondValue?: unknown;
  min?: number;
  max?: number;
  pattern?: string;
  whenField?: string;
  whenValue?: string | number | boolean | null;
};

export type ApiRuleInput = {
  name: string;
  description?: string;
  ruleType: AppRuleType;
  condition: ApiRuleCondition;
  errorMessage?: string;
  severity?: RuleSeverity;
  enabled?: boolean;
};

export type ApiRule = {
  id: string;
  name: string;
  description: string | null;
  ruleType: AppRuleType;
  condition: ApiRuleCondition;
  errorMessage: string | null;
  severity: RuleSeverity;
  enabled: boolean;
  appliesTo: string;
  violationCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
};

/** Common datapoint fields offered in the rule builder. */
export const DATAPOINT_RULE_FIELDS = [
  { value: "value", label: "Value" },
  { value: "quality", label: "Quality" },
  { value: "unit", label: "Unit" },
  { value: "metricKey", label: "Metric key" },
  { value: "source", label: "Source" },
  { value: "provenance", label: "Provenance" },
  { value: "supplierKey", label: "Supplier key" },
  { value: "approvalState", label: "Approval state" },
] as const;
