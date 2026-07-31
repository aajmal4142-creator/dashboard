import {
  ALERT_ACTIONS,
  ALERT_CONDITION_TYPES,
  ALERT_OPERATORS,
  type AlertAction,
  type AlertCondition,
  type AlertConditionType,
  type AlertOperator,
  type CreateAlertRuleInput,
  type MuteAlertInput,
  type UpdateAlertRuleInput,
} from "./types";

export function isAlertConditionType(v: string): v is AlertConditionType {
  return (ALERT_CONDITION_TYPES as readonly string[]).includes(v);
}

export function isAlertOperator(v: string): v is AlertOperator {
  return (ALERT_OPERATORS as readonly string[]).includes(v);
}

export function isAlertAction(v: string): v is AlertAction {
  return (ALERT_ACTIONS as readonly string[]).includes(v);
}

function asRecord(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

function parseFiniteNumber(
  v: unknown,
  label: string,
): { ok: true; value: number } | { ok: false; error: string } {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    return { ok: false, error: `${label} must be a finite number.` };
  }
  return { ok: true, value: v };
}

export function parseAlertCondition(
  raw: unknown,
): { ok: true; condition: AlertCondition } | { ok: false; error: string } {
  const obj = asRecord(raw);
  if (!obj) return { ok: false, error: "condition must be an object." };

  if (typeof obj.type !== "string" || !isAlertConditionType(obj.type)) {
    return {
      ok: false,
      error: `condition.type must be one of: ${ALERT_CONDITION_TYPES.join(", ")}.`,
    };
  }

  if (typeof obj.metric !== "string" || !obj.metric.trim()) {
    return { ok: false, error: "condition.metric is required." };
  }

  if (typeof obj.operator !== "string" || !isAlertOperator(obj.operator)) {
    return {
      ok: false,
      error: `condition.operator must be one of: ${ALERT_OPERATORS.join(", ")}.`,
    };
  }

  const valueParsed = parseFiniteNumber(obj.value, "condition.value");
  if (!valueParsed.ok) return valueParsed;

  const condition: AlertCondition = {
    type: obj.type,
    metric: obj.metric.trim(),
    operator: obj.operator,
    value: valueParsed.value,
  };

  if (obj.compareToAverage === true) condition.compareToAverage = true;
  if (obj.secondaryCompareToAverage === true) {
    condition.secondaryCompareToAverage = true;
  }

  if (obj.consecutivePeriods !== undefined) {
    const n = parseFiniteNumber(obj.consecutivePeriods, "condition.consecutivePeriods");
    if (!n.ok) return n;
    if (!Number.isInteger(n.value) || n.value < 2) {
      return { ok: false, error: "condition.consecutivePeriods must be an integer ≥ 2." };
    }
    condition.consecutivePeriods = n.value;
  }

  if (obj.percentChange !== undefined) {
    const p = parseFiniteNumber(obj.percentChange, "condition.percentChange");
    if (!p.ok) return p;
    condition.percentChange = p.value;
  }

  if (obj.secondaryMetric !== undefined) {
    if (typeof obj.secondaryMetric !== "string" || !obj.secondaryMetric.trim()) {
      return {
        ok: false,
        error: "condition.secondaryMetric must be a non-empty string.",
      };
    }
    condition.secondaryMetric = obj.secondaryMetric.trim();
  }

  if (obj.secondaryOperator !== undefined) {
    if (
      typeof obj.secondaryOperator !== "string" ||
      !isAlertOperator(obj.secondaryOperator)
    ) {
      return {
        ok: false,
        error: `condition.secondaryOperator must be one of: ${ALERT_OPERATORS.join(", ")}.`,
      };
    }
    condition.secondaryOperator = obj.secondaryOperator;
  }

  if (obj.secondaryValue !== undefined) {
    const s = parseFiniteNumber(obj.secondaryValue, "condition.secondaryValue");
    if (!s.ok) return s;
    condition.secondaryValue = s.value;
  }

  if (condition.type === "consecutive" && condition.consecutivePeriods == null) {
    condition.consecutivePeriods = 2;
  }

  if (condition.type === "percent_change" && condition.percentChange == null) {
    condition.percentChange = condition.value;
  }

  if (condition.type === "cross_metric" && !condition.secondaryMetric) {
    return { ok: false, error: "cross_metric requires condition.secondaryMetric." };
  }

  return { ok: true, condition };
}

export function parseActions(
  raw: unknown,
): { ok: true; actions: AlertAction[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "actions must be a non-empty array." };
  }
  const actions: AlertAction[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !isAlertAction(item)) {
      return {
        ok: false,
        error: `actions must be one of: ${ALERT_ACTIONS.join(", ")}.`,
      };
    }
    if (!actions.includes(item)) actions.push(item);
  }
  return { ok: true, actions };
}

export function parseCreateBody(
  body: unknown,
): { ok: true; data: CreateAlertRuleInput } | { ok: false; error: string } {
  const obj = asRecord(body);
  if (!obj) return { ok: false, error: "Body must be an object." };

  if (typeof obj.name !== "string" || !obj.name.trim()) {
    return { ok: false, error: "name is required." };
  }

  const condition = parseAlertCondition(obj.condition);
  if (!condition.ok) return condition;

  const actions = parseActions(obj.actions ?? ["notify_user"]);
  if (!actions.ok) return actions;

  const data: CreateAlertRuleInput = {
    name: obj.name.trim(),
    condition: condition.condition,
    actions: actions.actions,
  };

  if (typeof obj.enabled === "boolean") data.enabled = obj.enabled;
  if (typeof obj.muted === "boolean") data.muted = obj.muted;
  if (obj.mutedUntil === null) data.mutedUntil = null;
  else if (typeof obj.mutedUntil === "string") data.mutedUntil = obj.mutedUntil;

  return { ok: true, data };
}

export function parseUpdateBody(
  body: unknown,
): { ok: true; data: UpdateAlertRuleInput } | { ok: false; error: string } {
  const obj = asRecord(body);
  if (!obj) return { ok: false, error: "Body must be an object." };

  const data: UpdateAlertRuleInput = {};

  if (obj.name !== undefined) {
    if (typeof obj.name !== "string" || !obj.name.trim()) {
      return { ok: false, error: "name must be a non-empty string." };
    }
    data.name = obj.name.trim();
  }

  if (obj.enabled !== undefined) {
    if (typeof obj.enabled !== "boolean") {
      return { ok: false, error: "enabled must be a boolean." };
    }
    data.enabled = obj.enabled;
  }

  if (obj.condition !== undefined) {
    const condition = parseAlertCondition(obj.condition);
    if (!condition.ok) return condition;
    data.condition = condition.condition;
  }

  if (obj.actions !== undefined) {
    const actions = parseActions(obj.actions);
    if (!actions.ok) return actions;
    data.actions = actions.actions;
  }

  if (obj.muted !== undefined) {
    if (typeof obj.muted !== "boolean") {
      return { ok: false, error: "muted must be a boolean." };
    }
    data.muted = obj.muted;
  }

  if (obj.mutedUntil !== undefined) {
    if (obj.mutedUntil === null) data.mutedUntil = null;
    else if (typeof obj.mutedUntil === "string") data.mutedUntil = obj.mutedUntil;
    else return { ok: false, error: "mutedUntil must be a string or null." };
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: "No updatable fields provided." };
  }

  return { ok: true, data };
}

export function parseMuteBody(
  body: unknown,
): { ok: true; data: MuteAlertInput } | { ok: false; error: string } {
  const obj = asRecord(body);
  if (!obj) return { ok: false, error: "Body must be an object." };

  if (typeof obj.muted !== "boolean") {
    return { ok: false, error: "muted must be a boolean." };
  }

  const data: MuteAlertInput = { muted: obj.muted };
  if (obj.mutedUntil !== undefined) {
    if (obj.mutedUntil === null) data.mutedUntil = null;
    else if (typeof obj.mutedUntil === "string") data.mutedUntil = obj.mutedUntil;
    else return { ok: false, error: "mutedUntil must be a string or null." };
  }

  return { ok: true, data };
}
