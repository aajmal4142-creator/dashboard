import { MATERIALITY_THRESHOLD } from "./topics";

export type ImpactInputs = {
  severity: number;
  scope: number;
  irremediability: number;
};

export type FinancialInputs = {
  magnitude: number;
  likelihood: number;
};

/** Mean of the three impact dimensions, clamped 0–5. */
export function impactScoreOf(input: ImpactInputs): number {
  const raw =
    (clamp(input.severity) + clamp(input.scope) + clamp(input.irremediability)) / 3;
  return round1(raw);
}

/** Mean of magnitude × likelihood dimensions, clamped 0–5. */
export function financialScoreOf(input: FinancialInputs): number {
  const raw = (clamp(input.magnitude) + clamp(input.likelihood)) / 2;
  return round1(raw);
}

export function isMaterial(
  impact: number,
  financial: number,
  threshold = MATERIALITY_THRESHOLD,
): boolean {
  return impact >= threshold || financial >= threshold;
}

export type MatrixPoint = {
  esrsTopic: string;
  impactScore: number;
  financialScore: number;
  material: boolean;
};

export function buildMatrixSnapshot(
  topics: Array<{ esrsTopic: string; impactScore: number; financialScore: number }>,
  threshold = MATERIALITY_THRESHOLD,
): { threshold: number; points: MatrixPoint[]; materialCount: number } {
  const points = topics.map((t) => ({
    esrsTopic: t.esrsTopic,
    impactScore: t.impactScore,
    financialScore: t.financialScore,
    material: isMaterial(t.impactScore, t.financialScore, threshold),
  }));
  return {
    threshold,
    points,
    materialCount: points.filter((p) => p.material).length,
  };
}

export function materialityNarrative(
  orgName: string,
  points: MatrixPoint[],
  decidedBy?: string | null,
): string {
  const material = points.filter((p) => p.material).map((p) => p.esrsTopic);
  const non = points.filter((p) => !p.material).map((p) => p.esrsTopic);
  const who = decidedBy ? ` Decided by ${decidedBy}.` : "";
  if (material.length === 0) {
    return `${orgName}: no topics crossed the materiality threshold (${MATERIALITY_THRESHOLD}) on impact or financial axes in this assessment. ${who}`.trim();
  }
  return [
    `${orgName} double materiality assessment.`,
    `Material topics (${material.length}): ${material.join(", ")}.`,
    non.length > 0 ? `Below threshold: ${non.join(", ")}.` : null,
    `Threshold ${MATERIALITY_THRESHOLD} on either axis (impact or financial).`,
    who || null,
  ]
    .filter(Boolean)
    .join(" ");
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
