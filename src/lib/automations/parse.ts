import {
  AUTOMATION_ACTION_TYPES,
  AUTOMATION_OPERATORS,
  AUTOMATION_TRIGGER_TYPES,
  type AutomationAction,
  type AutomationActionType,
  type AutomationCondition,
  type AutomationOperator,
  type AutomationTriggerType,
  type CreateAutomationInput,
  type UpdateAutomationInput,
} from "./types";

export function isAutomationTriggerType(v: string): v is AutomationTriggerType {
  return (AUTOMATION_TRIGGER_TYPES as readonly string[]).includes(v);
}

export function isAutomationOperator(v: string): v is AutomationOperator {
  return (AUTOMATION_OPERATORS as readonly string[]).includes(v);
}

export function isAutomationActionType(v: string): v is AutomationActionType {
  return (AUTOMATION_ACTION_TYPES as readonly string[]).includes(v);
}

function asRecord(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

function optionalString(
  v: unknown,
): { ok: true; value: string | undefined } | { ok: false; error: string } {
  if (v === undefined || v === null) return { ok: true, value: undefined };
  if (typeof v !== "string") {
    return { ok: false, error: "Expected a string." };
  }
  const t = v.trim();
  return { ok: true, value: t || undefined };
}

export function parseCondition(
  raw: unknown,
): { ok: true; condition: AutomationCondition } | { ok: false; error: string } {
  const obj = asRecord(raw);
  if (!obj) return { ok: false, error: "condition must be an object." };

  if (typeof obj.field !== "string" || !obj.field.trim()) {
    return { ok: false, error: "condition.field is required." };
  }

  if (typeof obj.operator !== "string" || !isAutomationOperator(obj.operator)) {
    return {
      ok: false,
      error: `condition.operator must be one of: ${AUTOMATION_OPERATORS.join(", ")}.`,
    };
  }

  if (typeof obj.value !== "string" && typeof obj.value !== "number") {
    return {
      ok: false,
      error: "condition.value must be a string or number.",
    };
  }

  if (typeof obj.value === "number" && !Number.isFinite(obj.value)) {
    return { ok: false, error: "condition.value must be a finite number." };
  }

  return {
    ok: true,
    condition: {
      field: obj.field.trim(),
      operator: obj.operator,
      value: obj.value,
    },
  };
}

export function parseConditions(
  raw: unknown,
): { ok: true; conditions: AutomationCondition[] } | { ok: false; error: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, conditions: [] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, error: "conditions must be an array." };
  }
  const conditions: AutomationCondition[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const parsed = parseCondition(raw[i]);
    if (!parsed.ok) {
      return { ok: false, error: `conditions[${i}]: ${parsed.error}` };
    }
    conditions.push(parsed.condition);
  }
  return { ok: true, conditions };
}

export function parseAction(
  raw: unknown,
): { ok: true; action: AutomationAction } | { ok: false; error: string } {
  const obj = asRecord(raw);
  if (!obj) return { ok: false, error: "action must be an object." };

  if (typeof obj.type !== "string" || !isAutomationActionType(obj.type)) {
    return {
      ok: false,
      error: `action.type must be one of: ${AUTOMATION_ACTION_TYPES.join(", ")}.`,
    };
  }

  const title = optionalString(obj.title);
  if (!title.ok) return { ok: false, error: `action.title: ${title.error}` };
  const message = optionalString(obj.message);
  if (!message.ok) {
    return { ok: false, error: `action.message: ${message.error}` };
  }
  const emailTo = optionalString(obj.emailTo);
  if (!emailTo.ok) {
    return { ok: false, error: `action.emailTo: ${emailTo.error}` };
  }
  const webhookUrl = optionalString(obj.webhookUrl);
  if (!webhookUrl.ok) {
    return { ok: false, error: `action.webhookUrl: ${webhookUrl.error}` };
  }

  if (obj.type === "fire_webhook") {
    if (!webhookUrl.value) {
      return {
        ok: false,
        error: "action.webhookUrl is required for fire_webhook.",
      };
    }
    try {
      const u = new URL(webhookUrl.value);
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        return { ok: false, error: "action.webhookUrl must be http(s)." };
      }
    } catch {
      return { ok: false, error: "action.webhookUrl is not a valid URL." };
    }
  }

  if (obj.type === "send_email" && emailTo.value && !emailTo.value.includes("@")) {
    return { ok: false, error: "action.emailTo must be a valid email." };
  }

  const action: AutomationAction = { type: obj.type };
  if (title.value) action.title = title.value;
  if (message.value) action.message = message.value;
  if (emailTo.value) action.emailTo = emailTo.value;
  if (webhookUrl.value) action.webhookUrl = webhookUrl.value;
  return { ok: true, action };
}

export function parseActions(
  raw: unknown,
): { ok: true; actions: AutomationAction[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "actions must be a non-empty array." };
  }
  const actions: AutomationAction[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const parsed = parseAction(raw[i]);
    if (!parsed.ok) {
      return { ok: false, error: `actions[${i}]: ${parsed.error}` };
    }
    actions.push(parsed.action);
  }
  return { ok: true, actions };
}

export function parseCreateBody(
  body: unknown,
): { ok: true; data: CreateAutomationInput } | { ok: false; error: string } {
  const obj = asRecord(body);
  if (!obj) return { ok: false, error: "Body must be an object." };

  if (typeof obj.name !== "string" || !obj.name.trim()) {
    return { ok: false, error: "name is required." };
  }

  if (typeof obj.triggerType !== "string" || !isAutomationTriggerType(obj.triggerType)) {
    return {
      ok: false,
      error: `triggerType must be one of: ${AUTOMATION_TRIGGER_TYPES.join(", ")}.`,
    };
  }

  const conditions = parseConditions(obj.conditions);
  if (!conditions.ok) return conditions;

  const actions = parseActions(obj.actions);
  if (!actions.ok) return actions;

  let cronExpression: string | null | undefined;
  if (obj.cronExpression !== undefined && obj.cronExpression !== null) {
    if (typeof obj.cronExpression !== "string") {
      return { ok: false, error: "cronExpression must be a string." };
    }
    cronExpression = obj.cronExpression.trim() || null;
  }

  if (obj.triggerType === "schedule" && !cronExpression) {
    cronExpression = "0 9 * * 1";
  }

  return {
    ok: true,
    data: {
      name: obj.name.trim(),
      enabled: obj.enabled !== false,
      triggerType: obj.triggerType,
      cronExpression: cronExpression ?? null,
      conditions: conditions.conditions,
      actions: actions.actions,
    },
  };
}

export function parseUpdateBody(
  body: unknown,
): { ok: true; data: UpdateAutomationInput } | { ok: false; error: string } {
  const obj = asRecord(body);
  if (!obj) return { ok: false, error: "Body must be an object." };

  const data: UpdateAutomationInput = {};

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

  if (obj.triggerType !== undefined) {
    if (
      typeof obj.triggerType !== "string" ||
      !isAutomationTriggerType(obj.triggerType)
    ) {
      return {
        ok: false,
        error: `triggerType must be one of: ${AUTOMATION_TRIGGER_TYPES.join(", ")}.`,
      };
    }
    data.triggerType = obj.triggerType;
  }

  if (obj.cronExpression !== undefined) {
    if (obj.cronExpression === null) {
      data.cronExpression = null;
    } else if (typeof obj.cronExpression === "string") {
      data.cronExpression = obj.cronExpression.trim() || null;
    } else {
      return { ok: false, error: "cronExpression must be a string or null." };
    }
  }

  if (obj.conditions !== undefined) {
    const conditions = parseConditions(obj.conditions);
    if (!conditions.ok) return conditions;
    data.conditions = conditions.conditions;
  }

  if (obj.actions !== undefined) {
    const actions = parseActions(obj.actions);
    if (!actions.ok) return actions;
    data.actions = actions.actions;
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: "No updatable fields provided." };
  }

  return { ok: true, data };
}
