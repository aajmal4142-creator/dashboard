import type { DataQualityRule } from "@/payload-types";

import {
  actionFromSeverity,
  parseRuleConfig,
  severityFromLegacy,
  toAppRuleType,
  toStoredRuleType,
} from "./evaluate";
import type {
  ApiRule,
  ApiRuleCondition,
  AppRuleType,
  EvaluableRule,
  RuleSeverity,
} from "./types";

function relId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.id;
}

export function toEvaluableRule(doc: DataQualityRule): EvaluableRule {
  const severity = severityFromLegacy({
    severity: doc.severity,
    priority: doc.priority,
    action: doc.action,
  });

  return {
    id: doc.id,
    ruleName: doc.ruleName,
    ruleType: doc.ruleType,
    ruleConfig: doc.ruleConfig,
    severity,
    action: doc.action ?? actionFromSeverity(severity),
    errorMessage: doc.errorMessage ?? null,
  };
}

export function toApiRule(doc: DataQualityRule): ApiRule {
  const severity = severityFromLegacy({
    severity: doc.severity,
    priority: doc.priority,
    action: doc.action,
  });

  return {
    id: doc.id,
    name: doc.ruleName,
    description: doc.description ?? null,
    ruleType: toAppRuleType(doc.ruleType),
    condition: parseRuleConfig(doc.ruleConfig),
    errorMessage: doc.errorMessage ?? null,
    severity,
    enabled: doc.status !== "inactive",
    appliesTo: doc.appliesTo,
    violationCount: doc.violationCount ?? 0,
    version: doc.version,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function buildCreateData(input: {
  organisationId: string;
  userId: string;
  name: string;
  description?: string;
  ruleType: AppRuleType;
  condition: ApiRuleCondition;
  errorMessage?: string;
  severity: RuleSeverity;
  enabled: boolean;
  ruleConfig: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    organisation: input.organisationId,
    ruleName: input.name,
    description: input.description ?? null,
    ruleType: toStoredRuleType(input.ruleType),
    appliesTo: "datapoints",
    ruleConfig: input.ruleConfig,
    status: input.enabled ? "active" : "inactive",
    priority: input.severity === "error" ? "high" : "medium",
    action: actionFromSeverity(input.severity),
    severity: input.severity,
    errorMessage: input.errorMessage ?? null,
    version: 1,
    createdBy: input.userId,
    lastModifiedBy: input.userId,
    violationCount: 0,
  };
}

export function buildUpdateData(input: {
  userId: string;
  name?: string;
  description?: string | null;
  ruleType?: AppRuleType;
  condition?: ApiRuleCondition;
  errorMessage?: string | null;
  severity?: RuleSeverity;
  enabled?: boolean;
  ruleConfig?: Record<string, unknown>;
  currentVersion: number;
}): Record<string, unknown> {
  const data: Record<string, unknown> = {
    lastModifiedBy: input.userId,
    version: input.currentVersion + 1,
  };
  if (input.name !== undefined) data.ruleName = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.ruleType !== undefined) data.ruleType = toStoredRuleType(input.ruleType);
  if (input.ruleConfig !== undefined) data.ruleConfig = input.ruleConfig;
  if (input.errorMessage !== undefined) data.errorMessage = input.errorMessage;
  if (input.severity !== undefined) {
    data.severity = input.severity;
    data.action = actionFromSeverity(input.severity);
    data.priority = input.severity === "error" ? "high" : "medium";
  }
  if (input.enabled !== undefined) {
    data.status = input.enabled ? "active" : "inactive";
  }
  return data;
}

export function orgIdFromDoc(doc: DataQualityRule): string | null {
  return relId(doc.organisation);
}
