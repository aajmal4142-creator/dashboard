import type {
  AlertCondition,
  AlertOperator,
  EvaluationResult,
  MetricSeries,
} from "./types";

export function compareNumber(
  left: number,
  operator: AlertOperator,
  right: number,
): boolean {
  switch (operator) {
    case "gt":
      return left > right;
    case "lt":
      return left < right;
    case "eq":
      return left === right;
  }
}

export function operatorLabel(op: AlertOperator): string {
  if (op === "gt") return ">";
  if (op === "lt") return "<";
  return "=";
}

export function seriesAverage(values: number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

export function findSeries(series: MetricSeries[], metric: string): number[] | null {
  const row = series.find((s) => s.metric === metric);
  if (!row || row.values.length === 0) return null;
  return row.values;
}

/**
 * Mute is active when muted=true and (no mutedUntil OR mutedUntil is in the future).
 */
export function isAlertMuted(
  muted: boolean,
  mutedUntil: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!muted) return false;
  if (mutedUntil == null || mutedUntil === "") return true;
  const until = mutedUntil instanceof Date ? mutedUntil : new Date(String(mutedUntil));
  if (Number.isNaN(until.getTime())) return true;
  return until.getTime() > now.getTime();
}

export function evaluateThreshold(
  condition: AlertCondition,
  values: number[],
): EvaluationResult {
  const current = values[values.length - 1];
  if (current === undefined) {
    return { triggered: false, reason: "No values for metric." };
  }

  const threshold = condition.compareToAverage ? seriesAverage(values) : condition.value;
  if (threshold == null) {
    return { triggered: false, reason: "Cannot resolve threshold." };
  }

  const ok = compareNumber(current, condition.operator, threshold);
  const label = condition.compareToAverage
    ? `series average (${threshold})`
    : String(threshold);

  return {
    triggered: ok,
    observed: current,
    reason: ok
      ? `${condition.metric} ${current} ${operatorLabel(condition.operator)} ${label}`
      : `${condition.metric} ${current} does not meet ${operatorLabel(condition.operator)} ${label}`,
  };
}

export function evaluateConsecutive(
  condition: AlertCondition,
  values: number[],
): EvaluationResult {
  const n = condition.consecutivePeriods ?? 2;
  if (n < 2) {
    return { triggered: false, reason: "consecutivePeriods must be ≥ 2." };
  }
  if (values.length < n) {
    return {
      triggered: false,
      reason: `Need ${n} periods; have ${values.length}.`,
      observed: values[values.length - 1],
    };
  }

  const window = values.slice(-n);
  const allMeet = window.every((v) =>
    compareNumber(v, condition.operator, condition.value),
  );

  return {
    triggered: allMeet,
    observed: window[window.length - 1],
    reason: allMeet
      ? `${condition.metric} ${operatorLabel(condition.operator)} ${condition.value} for ${n} consecutive periods (${window.join(", ")})`
      : `${condition.metric} did not stay ${operatorLabel(condition.operator)} ${condition.value} for ${n} periods.`,
  };
}

export function evaluatePercentChange(
  condition: AlertCondition,
  values: number[],
): EvaluationResult {
  if (values.length < 2) {
    return {
      triggered: false,
      reason: "Need at least two periods for percent change.",
    };
  }

  const previous = values[values.length - 2]!;
  const current = values[values.length - 1]!;
  if (previous === 0) {
    return {
      triggered: false,
      observed: current,
      reason: "Previous period is zero; percent change undefined.",
    };
  }

  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const threshold = condition.percentChange ?? condition.value;
  const ok = compareNumber(Math.abs(pct), condition.operator, threshold);

  return {
    triggered: ok,
    observed: pct,
    reason: ok
      ? `${condition.metric} changed ${pct.toFixed(1)}% (abs ${Math.abs(pct).toFixed(1)}% ${operatorLabel(condition.operator)} ${threshold}%)`
      : `${condition.metric} change ${pct.toFixed(1)}% does not meet threshold ${threshold}%.`,
  };
}

export function evaluateCrossMetric(
  condition: AlertCondition,
  series: MetricSeries[],
): EvaluationResult {
  const primaryValues = findSeries(series, condition.metric);
  if (!primaryValues) {
    return {
      triggered: false,
      reason: `No series for primary metric ${condition.metric}.`,
    };
  }

  const secondaryKey = condition.secondaryMetric;
  if (!secondaryKey) {
    return {
      triggered: false,
      reason: "cross_metric requires secondaryMetric.",
    };
  }

  const secondaryValues = findSeries(series, secondaryKey);
  if (!secondaryValues) {
    return {
      triggered: false,
      reason: `No series for secondary metric ${secondaryKey}.`,
    };
  }

  const primaryCurrent = primaryValues[primaryValues.length - 1]!;
  const secondaryCurrent = secondaryValues[secondaryValues.length - 1]!;

  const primaryRight = condition.compareToAverage
    ? seriesAverage(primaryValues)
    : condition.value;
  const secondaryRight = condition.secondaryCompareToAverage
    ? seriesAverage(secondaryValues)
    : (condition.secondaryValue ?? condition.value);

  if (primaryRight == null || secondaryRight == null) {
    return { triggered: false, reason: "Cannot resolve cross-metric thresholds." };
  }

  const secondaryOp = condition.secondaryOperator ?? condition.operator;
  const primaryOk = compareNumber(primaryCurrent, condition.operator, primaryRight);
  const secondaryOk = compareNumber(secondaryCurrent, secondaryOp, secondaryRight);
  const ok = primaryOk && secondaryOk;

  const pLabel = condition.compareToAverage
    ? `avg ${primaryRight}`
    : String(primaryRight);
  const sLabel = condition.secondaryCompareToAverage
    ? `avg ${secondaryRight}`
    : String(secondaryRight);

  return {
    triggered: ok,
    observed: primaryCurrent,
    observedSecondary: secondaryCurrent,
    reason: ok
      ? `${condition.metric} ${primaryCurrent} ${operatorLabel(condition.operator)} ${pLabel} AND ${secondaryKey} ${secondaryCurrent} ${operatorLabel(secondaryOp)} ${sLabel}`
      : `Cross-metric not met: ${condition.metric}=${primaryCurrent}, ${secondaryKey}=${secondaryCurrent}.`,
  };
}

export function evaluateAlertCondition(
  condition: AlertCondition,
  series: MetricSeries[],
): EvaluationResult {
  if (condition.type === "cross_metric") {
    return evaluateCrossMetric(condition, series);
  }

  const values = findSeries(series, condition.metric);
  if (!values) {
    return {
      triggered: false,
      reason: `No series for metric ${condition.metric}.`,
    };
  }

  switch (condition.type) {
    case "threshold":
      return evaluateThreshold(condition, values);
    case "consecutive":
      return evaluateConsecutive(condition, values);
    case "percent_change":
      return evaluatePercentChange(condition, values);
  }
}
