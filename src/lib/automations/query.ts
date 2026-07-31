import {
  AUTOMATION_ACTION_TYPES,
  AUTOMATION_OPERATORS,
  AUTOMATION_RUN_STATUSES,
  AUTOMATION_TRIGGER_TYPES,
  type ActionRunResult,
  type AutomationAction,
  type AutomationActionType,
  type AutomationCondition,
  type AutomationDoc,
  type AutomationOperator,
  type AutomationRunDoc,
  type AutomationRunStatus,
  type AutomationRunSummary,
  type AutomationSummary,
  type AutomationTriggerType,
} from "./types";

export function orgIdFromDoc(doc: AutomationDoc | AutomationRunDoc): string | null {
  const org = doc.organisation;
  if (!org) return null;
  return typeof org === "string" ? org : (org.id ?? null);
}

export function isTriggerType(v: unknown): v is AutomationTriggerType {
  return (
    typeof v === "string" && (AUTOMATION_TRIGGER_TYPES as readonly string[]).includes(v)
  );
}

export function isRunStatus(v: unknown): v is AutomationRunStatus {
  return (
    typeof v === "string" && (AUTOMATION_RUN_STATUSES as readonly string[]).includes(v)
  );
}

export function normalizeOperator(v: unknown): AutomationOperator | null {
  if (typeof v === "string" && (AUTOMATION_OPERATORS as readonly string[]).includes(v)) {
    return v as AutomationOperator;
  }
  return null;
}

export function normalizeActionType(v: unknown): AutomationActionType | null {
  if (
    typeof v === "string" &&
    (AUTOMATION_ACTION_TYPES as readonly string[]).includes(v)
  ) {
    return v as AutomationActionType;
  }
  return null;
}

export function normalizeCondition(raw: unknown): AutomationCondition | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.field !== "string" || !obj.field.trim()) return null;
  const operator = normalizeOperator(obj.operator);
  if (!operator) return null;
  if (typeof obj.value !== "string" && typeof obj.value !== "number") {
    return null;
  }
  if (typeof obj.value === "number" && !Number.isFinite(obj.value)) return null;
  return {
    field: obj.field.trim(),
    operator,
    value: obj.value,
  };
}

export function normalizeConditions(raw: unknown): AutomationCondition[] {
  if (!Array.isArray(raw)) return [];
  const out: AutomationCondition[] = [];
  for (const row of raw) {
    const c = normalizeCondition(row);
    if (c) out.push(c);
  }
  return out;
}

export function normalizeAction(raw: unknown): AutomationAction | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const type = normalizeActionType(obj.type);
  if (!type) return null;
  const action: AutomationAction = { type };
  if (typeof obj.title === "string" && obj.title.trim()) {
    action.title = obj.title.trim();
  }
  if (typeof obj.message === "string" && obj.message.trim()) {
    action.message = obj.message.trim();
  }
  if (typeof obj.emailTo === "string" && obj.emailTo.trim()) {
    action.emailTo = obj.emailTo.trim();
  }
  if (typeof obj.webhookUrl === "string" && obj.webhookUrl.trim()) {
    action.webhookUrl = obj.webhookUrl.trim();
  }
  return action;
}

export function normalizeActions(raw: unknown): AutomationAction[] {
  if (!Array.isArray(raw)) return [];
  const out: AutomationAction[] = [];
  for (const row of raw) {
    const a = normalizeAction(row);
    if (a) out.push(a);
  }
  return out;
}

function dateToIso(v: string | Date | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function mapAutomationDoc(doc: AutomationDoc): AutomationSummary | null {
  if (!isTriggerType(doc.triggerType)) return null;
  const actions = normalizeActions(doc.actions);
  if (actions.length === 0) return null;

  return {
    id: doc.id,
    name: (doc.name ?? "").trim() || "Untitled",
    enabled: doc.enabled !== false,
    triggerType: doc.triggerType,
    cronExpression:
      typeof doc.cronExpression === "string" && doc.cronExpression.trim()
        ? doc.cronExpression.trim()
        : null,
    conditions: normalizeConditions(doc.conditions),
    actions,
    runCount: typeof doc.runCount === "number" ? doc.runCount : 0,
    lastRunAt: dateToIso(doc.lastRunAt),
    lastRunStatus: isRunStatus(doc.lastRunStatus) ? doc.lastRunStatus : null,
    createdAt: dateToIso(doc.createdAt) ?? new Date(0).toISOString(),
    updatedAt: dateToIso(doc.updatedAt) ?? new Date(0).toISOString(),
  };
}

function normalizeActionResults(raw: unknown): ActionRunResult[] {
  if (!Array.isArray(raw)) return [];
  const out: ActionRunResult[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const obj = row as Record<string, unknown>;
    const type = normalizeActionType(obj.type);
    if (!type) continue;
    out.push({
      type,
      ok: obj.ok === true,
      detail: typeof obj.detail === "string" ? obj.detail : "",
    });
  }
  return out;
}

export function mapAutomationRunDoc(doc: AutomationRunDoc): AutomationRunSummary | null {
  if (!isTriggerType(doc.triggerType) || !isRunStatus(doc.status)) return null;

  let automationId = "";
  let automationName: string | null = null;
  if (typeof doc.automation === "string") {
    automationId = doc.automation;
  } else if (doc.automation && typeof doc.automation === "object") {
    automationId = doc.automation.id ?? "";
    if (typeof doc.automation.name === "string") {
      automationName = doc.automation.name;
    }
  }
  if (!automationId) return null;

  return {
    id: doc.id,
    automationId,
    automationName,
    triggerType: doc.triggerType,
    status: doc.status,
    matched: doc.matched === true,
    actionsRun: normalizeActionResults(doc.actionsRun),
    actionsSkipped: normalizeActionResults(doc.actionsSkipped),
    error: typeof doc.error === "string" ? doc.error : null,
    createdAt: dateToIso(doc.createdAt) ?? new Date(0).toISOString(),
  };
}

export function buildOrgAutomationWhere(organisationId: string) {
  return { organisation: { equals: organisationId } };
}
