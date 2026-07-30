import type {
  ComplianceAnswerValue,
  ComplianceAnswersMap,
  ComplianceCalcOp,
  ComplianceCalcResult,
  ComplianceCalcResultsMap,
  ComplianceCalculation,
} from "./types";

function asNumber(value: ComplianceAnswerValue): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function resolveInput(
  id: string,
  answers: ComplianceAnswersMap,
  prior: ComplianceCalcResultsMap,
): number | null {
  const fromCalc = prior[id];
  if (fromCalc && fromCalc.quality === "calculated" && fromCalc.value != null) {
    return fromCalc.value;
  }
  const answer = answers[id];
  if (!answer) return null;
  return asNumber(answer.value);
}

function applyOp(op: ComplianceCalcOp, values: number[]): number | null {
  if (values.length === 0) return null;
  switch (op) {
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "product":
      return values.reduce((a, b) => a * b, 1);
    case "ratio": {
      if (values.length < 2) return null;
      const [num, den] = values;
      if (den === 0) return null;
      return num / den;
    }
    case "difference": {
      if (values.length < 2) return null;
      return values[0] - values[1];
    }
    default:
      return null;
  }
}

/**
 * Evaluate template calculations in declaration order.
 * Inputs may reference questionIds or earlier calcIds.
 */
export function runCalculations(
  calculations: ComplianceCalculation[],
  answers: ComplianceAnswersMap,
): ComplianceCalcResultsMap {
  const results: ComplianceCalcResultsMap = {};

  for (const calc of calculations) {
    const inputs = Array.isArray(calc.inputs) ? calc.inputs : parseInputs(calc.inputs);
    const values: number[] = [];
    let missing = false;

    for (const id of inputs) {
      const n = resolveInput(id, answers, results);
      if (n == null) {
        missing = true;
        break;
      }
      values.push(n);
    }

    if (missing) {
      results[calc.calcId] = {
        calcId: calc.calcId,
        label: calc.label,
        value: null,
        unit: calc.unit ?? null,
        quality: "missing",
        detail: "One or more inputs missing",
      };
      continue;
    }

    const value = applyOp(calc.op, values);
    if (value == null || !Number.isFinite(value)) {
      results[calc.calcId] = {
        calcId: calc.calcId,
        label: calc.label,
        value: null,
        unit: calc.unit ?? null,
        quality: "missing",
        detail:
          calc.op === "ratio" ? "Division by zero or invalid inputs" : "Invalid result",
      };
      continue;
    }

    results[calc.calcId] = {
      calcId: calc.calcId,
      label: calc.label,
      value,
      unit: calc.unit ?? null,
      quality: "calculated",
    };
  }

  return results;
}

function parseInputs(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string");
  }
  return [];
}

export function parseAnswers(raw: unknown): ComplianceAnswersMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ComplianceAnswersMap = {};
  for (const [key, row] of Object.entries(raw as Record<string, unknown>)) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as { value?: ComplianceAnswerValue; updatedAt?: unknown };
    out[key] = {
      value: r.value ?? null,
      updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : new Date().toISOString(),
    };
  }
  return out;
}

export function parseCalcResults(raw: unknown): ComplianceCalcResultsMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ComplianceCalcResultsMap = {};
  for (const [key, row] of Object.entries(raw as Record<string, unknown>)) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Partial<ComplianceCalcResult>;
    if (typeof r.calcId !== "string" || typeof r.label !== "string") continue;
    out[key] = {
      calcId: r.calcId,
      label: r.label,
      value: typeof r.value === "number" ? r.value : null,
      unit: typeof r.unit === "string" ? r.unit : null,
      quality: r.quality === "calculated" ? "calculated" : "missing",
      detail: typeof r.detail === "string" ? r.detail : undefined,
    };
  }
  return out;
}

export function validateRequiredAnswers(
  questions: Array<{ questionId: string; required: boolean; answerType: string }>,
  answers: ComplianceAnswersMap,
): string[] {
  const missing: string[] = [];
  for (const q of questions) {
    if (!q.required || q.answerType === "calculated") continue;
    const a = answers[q.questionId];
    if (!a || a.value === null || a.value === "") {
      missing.push(q.questionId);
    }
  }
  return missing;
}
