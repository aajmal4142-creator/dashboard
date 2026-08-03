export const ALERT_CONDITION_TYPES = [
  "threshold",
  "consecutive",
  "percent_change",
  "cross_metric",
] as const;

export const ALERT_OPERATORS = ["gt", "lt", "eq"] as const;

export const ALERT_ACTIONS = [
  "notify_user",
  "send_email",
  "post_slack",
  "post_teams",
] as const;

export type AlertConditionType = (typeof ALERT_CONDITION_TYPES)[number];
export type AlertOperator = (typeof ALERT_OPERATORS)[number];
export type AlertAction = (typeof ALERT_ACTIONS)[number];

/**
 * Condition payload stored on AlertRules.condition (JSON).
 * - threshold: latest value vs value
 * - consecutive: last N periods all meet operator/value
 * - percent_change: |Δ| vs prior ≥ percentChange (value unused as floor; operator on %)
 * - cross_metric: primary AND secondary each meet their check (value or series average)
 */
export type AlertCondition = {
  type: AlertConditionType;
  metric: string;
  operator: AlertOperator;
  value: number;
  consecutivePeriods?: number;
  percentChange?: number;
  secondaryMetric?: string;
  secondaryOperator?: AlertOperator;
  secondaryValue?: number;
  /** When true, compare metric to its own series average instead of `value`. */
  compareToAverage?: boolean;
  secondaryCompareToAverage?: boolean;
};

/** Chronological oldest → newest numeric samples for one metric. */
export type MetricSeries = {
  metric: string;
  values: number[];
};

export type EvaluationResult = {
  triggered: boolean;
  reason: string;
  observed?: number;
  observedSecondary?: number;
};

export type AlertRuleSummary = {
  id: string;
  name: string;
  enabled: boolean;
  condition: AlertCondition;
  actions: AlertAction[];
  muted: boolean;
  mutedUntil: string | null;
  triggeredCount: number;
  lastTriggeredAt: string | null;
  lastTriggeredMessage: string | null;
  createdAt: string;
  updatedAt: string;
  /** Derived for dashboard: active | muted | triggered | disabled */
  status: "active" | "muted" | "triggered" | "disabled";
};

export type AlertRuleDoc = {
  id: string;
  organisation?: string | { id?: string } | null;
  name?: string | null;
  enabled?: boolean | null;
  condition?: unknown;
  actions?: unknown;
  muted?: boolean | null;
  mutedUntil?: string | Date | null;
  triggeredCount?: number | null;
  lastTriggeredAt?: string | Date | null;
  lastTriggeredMessage?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type CreateAlertRuleInput = {
  name: string;
  enabled?: boolean;
  condition: AlertCondition;
  actions: AlertAction[];
  muted?: boolean;
  mutedUntil?: string | null;
};

export type UpdateAlertRuleInput = {
  name?: string;
  enabled?: boolean;
  condition?: AlertCondition;
  actions?: AlertAction[];
  muted?: boolean;
  mutedUntil?: string | null;
};

export type MuteAlertInput = {
  muted: boolean;
  mutedUntil?: string | null;
};
