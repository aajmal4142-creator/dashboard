export const AUTOMATION_TRIGGER_TYPES = [
  "datapoint_approved",
  "alert_triggered",
  "schedule",
] as const;

export const AUTOMATION_OPERATORS = ["eq", "neq", "gt", "lt", "contains"] as const;

export const AUTOMATION_ACTION_TYPES = [
  "create_notification",
  "send_email",
  "post_slack",
  "post_teams",
  "fire_webhook",
] as const;

export const AUTOMATION_RUN_STATUSES = [
  "success",
  "partial",
  "failed",
  "skipped",
] as const;

export type AutomationTriggerType = (typeof AUTOMATION_TRIGGER_TYPES)[number];
export type AutomationOperator = (typeof AUTOMATION_OPERATORS)[number];
export type AutomationActionType = (typeof AUTOMATION_ACTION_TYPES)[number];
export type AutomationRunStatus = (typeof AUTOMATION_RUN_STATUSES)[number];

export type AutomationCondition = {
  field: string;
  operator: AutomationOperator;
  value: string | number;
};

export type AutomationAction = {
  type: AutomationActionType;
  title?: string;
  message?: string;
  emailTo?: string;
  webhookUrl?: string;
};

/** Event context passed into the engine for condition matching + actions. */
export type AutomationEventContext = {
  triggerType: AutomationTriggerType;
  organisationId: string;
  /** Flat string/number fields for condition matching. */
  fields: Record<string, string | number | null | undefined>;
  /** Human-readable summary for notifications / Slack. */
  summary: string;
  resourceType?: string;
  resourceId?: string;
};

export type ConditionMatchResult = {
  matched: boolean;
  reason: string;
};

export type ActionRunResult = {
  type: AutomationActionType;
  ok: boolean;
  detail: string;
};

export type AutomationSummary = {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: AutomationTriggerType;
  cronExpression: string | null;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  runCount: number;
  lastRunAt: string | null;
  lastRunStatus: AutomationRunStatus | null;
  createdAt: string;
  updatedAt: string;
};

export type AutomationRunSummary = {
  id: string;
  automationId: string;
  automationName: string | null;
  triggerType: AutomationTriggerType;
  status: AutomationRunStatus;
  matched: boolean;
  actionsRun: ActionRunResult[];
  actionsSkipped: ActionRunResult[];
  error: string | null;
  createdAt: string;
};

export type AutomationDoc = {
  id: string;
  organisation?: string | { id?: string } | null;
  name?: string | null;
  enabled?: boolean | null;
  triggerType?: string | null;
  cronExpression?: string | null;
  conditions?: unknown;
  actions?: unknown;
  runCount?: number | null;
  lastRunAt?: string | Date | null;
  lastRunStatus?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type AutomationRunDoc = {
  id: string;
  organisation?: string | { id?: string } | null;
  automation?: string | { id?: string; name?: string | null } | null;
  triggerType?: string | null;
  status?: string | null;
  matched?: boolean | null;
  actionsRun?: unknown;
  actionsSkipped?: unknown;
  error?: string | null;
  context?: unknown;
  createdAt?: string | null;
};

export type CreateAutomationInput = {
  name: string;
  enabled?: boolean;
  triggerType: AutomationTriggerType;
  cronExpression?: string | null;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
};

export type UpdateAutomationInput = {
  name?: string;
  enabled?: boolean;
  triggerType?: AutomationTriggerType;
  cronExpression?: string | null;
  conditions?: AutomationCondition[];
  actions?: AutomationAction[];
};
