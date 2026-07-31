import type {
  AutomationCondition,
  AutomationOperator,
  ConditionMatchResult,
  AutomationEventContext,
} from "./types";

export function compareValues(
  left: string | number,
  operator: AutomationOperator,
  right: string | number,
): boolean {
  switch (operator) {
    case "eq":
      return String(left) === String(right);
    case "neq":
      return String(left) !== String(right);
    case "gt": {
      const a = typeof left === "number" ? left : Number(left);
      const b = typeof right === "number" ? right : Number(right);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
      return a > b;
    }
    case "lt": {
      const a = typeof left === "number" ? left : Number(left);
      const b = typeof right === "number" ? right : Number(right);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
      return a < b;
    }
    case "contains":
      return String(left).toLowerCase().includes(String(right).toLowerCase());
  }
}

export function operatorLabel(op: AutomationOperator): string {
  switch (op) {
    case "eq":
      return "=";
    case "neq":
      return "≠";
    case "gt":
      return ">";
    case "lt":
      return "<";
    case "contains":
      return "contains";
  }
}

/**
 * Evaluate one condition against event fields.
 * Missing field → not matched (never silently treat as zero).
 */
export function matchCondition(
  condition: AutomationCondition,
  fields: AutomationEventContext["fields"],
): ConditionMatchResult {
  const field = condition.field.trim();
  if (!field) {
    return { matched: false, reason: "Condition field is empty." };
  }

  const raw = fields[field];
  if (raw === null || raw === undefined || raw === "") {
    return {
      matched: false,
      reason: `Field '${field}' is missing on the event.`,
    };
  }

  const ok = compareValues(raw, condition.operator, condition.value);
  const label = operatorLabel(condition.operator);
  return {
    matched: ok,
    reason: ok
      ? `${field} ${raw} ${label} ${condition.value}`
      : `${field} ${raw} does not meet ${label} ${condition.value}`,
  };
}

/**
 * All conditions must match (AND). Empty list → match.
 */
export function matchConditions(
  conditions: AutomationCondition[],
  fields: AutomationEventContext["fields"],
): ConditionMatchResult {
  if (conditions.length === 0) {
    return { matched: true, reason: "No conditions (match all)." };
  }

  const reasons: string[] = [];
  for (const condition of conditions) {
    const result = matchCondition(condition, fields);
    if (!result.matched) {
      return result;
    }
    reasons.push(result.reason);
  }

  return {
    matched: true,
    reason: reasons.join("; "),
  };
}

/**
 * Trigger type must equal automation.triggerType.
 * Cron expression matching is handled in runScheduledAutomations before this runs.
 */
export function matchTrigger(
  automationTrigger: string,
  eventTrigger: string,
): ConditionMatchResult {
  if (automationTrigger !== eventTrigger) {
    return {
      matched: false,
      reason: `Trigger '${automationTrigger}' ≠ event '${eventTrigger}'.`,
    };
  }
  return { matched: true, reason: `Trigger ${eventTrigger}` };
}

/**
 * Full rule match: trigger + conditions.
 */
export function matchAutomationRule(args: {
  triggerType: string;
  conditions: AutomationCondition[];
  event: AutomationEventContext;
}): ConditionMatchResult {
  const trigger = matchTrigger(args.triggerType, args.event.triggerType);
  if (!trigger.matched) return trigger;

  const conditions = matchConditions(args.conditions, args.event.fields);
  if (!conditions.matched) return conditions;

  return {
    matched: true,
    reason: `${trigger.reason}; ${conditions.reason}`,
  };
}
