/**
 * Formal supplier ESG scorecard — pure composition over risk pillars.
 * Higher qualityScore = better (0–100). Risk formula stays higher = worse.
 */

import type { RiskBadge, RiskTier } from "./riskFormula";

/** Slim risk shape shared by RiskFormulaResult and RiskScoreBreakdown. */
export type ScorecardRiskInput = {
  totalScore: number;
  tier: RiskTier;
  badge: RiskBadge;
  environmentalScore: number;
  socialScore: number;
  governanceScore: number;
  flags: string[];
  dataQuality: "high" | "medium" | "low";
};

export type SupplierScorecardInput = {
  supplierId: string;
  supplierName: string;
  category?: string | null;
  periodLabel?: string | null;
  risk: ScorecardRiskInput;
  questionnaireCompletionPercent: number;
  carbonQuality: "measured" | "calculated" | "estimated" | "missing" | "unknown";
  documentCount: number;
  generatedAt?: string;
};

export type SupplierScorecard = {
  kind: "supplier_esg_scorecard";
  generatedAt: string;
  supplierId: string;
  supplierName: string;
  category: string | null;
  periodLabel: string | null;
  /** Procurement-facing quality score 0–100 (inverted from risk). */
  qualityScore: number;
  riskScore: number;
  riskTier: RiskTier;
  riskBadge: RiskBadge;
  pillars: {
    environmental: number;
    social: number;
    governance: number;
  };
  questionnaireCompletionPercent: number;
  carbonQuality: SupplierScorecardInput["carbonQuality"];
  documentCount: number;
  dataQuality: ScorecardRiskInput["dataQuality"];
  flags: string[];
  summaryLines: string[];
};

function clamp(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** Invert risk (higher worse) → quality (higher better). */
export function riskToQualityScore(riskTotal: number): number {
  return clamp(100 - riskTotal);
}

export function composeSupplierScorecard(
  input: SupplierScorecardInput,
): SupplierScorecard {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const qualityScore = riskToQualityScore(input.risk.totalScore);
  const q = clamp(input.questionnaireCompletionPercent);

  const summaryLines = [
    `ClearESG Supplier ESG Scorecard — ${input.supplierName}`,
    `Generated: ${generatedAt}`,
    input.periodLabel ? `Period: ${input.periodLabel}` : null,
    "",
    `Quality score: ${qualityScore}/100 (higher is better)`,
    `Risk score: ${Math.round(input.risk.totalScore)}/100 (higher is worse) · tier ${input.risk.tier}`,
    `Pillars (risk): E ${Math.round(input.risk.environmentalScore)} · S ${Math.round(input.risk.socialScore)} · G ${Math.round(input.risk.governanceScore)}`,
    `Questionnaire completion: ${q}%`,
    `Carbon data quality: ${input.carbonQuality}`,
    `Documents on file: ${input.documentCount}`,
    `Risk data quality: ${input.risk.dataQuality}`,
    "",
    "This scorecard is an internal ClearESG artefact. It is not an EcoVadis rating.",
  ].filter((line): line is string => line !== null);

  if (input.risk.flags.length > 0) {
    summaryLines.push("", "Flags:");
    for (const f of input.risk.flags) summaryLines.push(`- ${f}`);
  }

  return {
    kind: "supplier_esg_scorecard",
    generatedAt,
    supplierId: input.supplierId,
    supplierName: input.supplierName,
    category: input.category ?? null,
    periodLabel: input.periodLabel ?? null,
    qualityScore,
    riskScore: Math.round(input.risk.totalScore),
    riskTier: input.risk.tier,
    riskBadge: input.risk.badge,
    pillars: {
      environmental: Math.round(input.risk.environmentalScore),
      social: Math.round(input.risk.socialScore),
      governance: Math.round(input.risk.governanceScore),
    },
    questionnaireCompletionPercent: q,
    carbonQuality: input.carbonQuality,
    documentCount: input.documentCount,
    dataQuality: input.risk.dataQuality,
    flags: [...input.risk.flags],
    summaryLines,
  };
}

export function supplierScorecardToPlainText(card: SupplierScorecard): string {
  return card.summaryLines.join("\n");
}

export function supplierScorecardToCsv(card: SupplierScorecard): string {
  const rows: string[][] = [
    ["field", "value"],
    ["supplierId", card.supplierId],
    ["supplierName", card.supplierName],
    ["category", card.category ?? ""],
    ["periodLabel", card.periodLabel ?? ""],
    ["qualityScore", String(card.qualityScore)],
    ["riskScore", String(card.riskScore)],
    ["riskTier", card.riskTier],
    ["riskBadge", card.riskBadge],
    ["pillar_environmental_risk", String(card.pillars.environmental)],
    ["pillar_social_risk", String(card.pillars.social)],
    ["pillar_governance_risk", String(card.pillars.governance)],
    ["questionnaireCompletionPercent", String(card.questionnaireCompletionPercent)],
    ["carbonQuality", card.carbonQuality],
    ["documentCount", String(card.documentCount)],
    ["dataQuality", card.dataQuality],
    ["generatedAt", card.generatedAt],
  ];
  for (const f of card.flags) rows.push(["flag", f]);
  return rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}
