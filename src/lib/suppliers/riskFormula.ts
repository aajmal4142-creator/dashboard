/**
 * Supplier ESG risk formula (Feature 10).
 *
 * Higher score = higher risk (0–100).
 * Final = Environmental×0.4 + Social×0.3 + Governance×0.3
 *
 * Pure. Zero I/O. Locked by unit tests.
 */

export const ENV_WEIGHT = 0.4;
export const SOCIAL_WEIGHT = 0.3;
export const GOV_WEIGHT = 0.3;

export type EmissionsTrend = "declining" | "stable" | "increasing" | "unknown";

export type RiskTier = "low" | "medium" | "high" | "critical";

/** UI badge set — critical folds into High. */
export type RiskBadge = "low" | "medium" | "high";

export type MitigationStatus = "open" | "in_progress" | "done";

export interface RiskMitigation {
  id: string;
  action: string;
  status: MitigationStatus;
  createdAt: string;
  completedAt?: string | null;
}

export interface SupplierRiskFactorInput {
  /** Scope 1/2/3 or registry emissions present. */
  hasEmissionsData: boolean;
  emissionsTrend: EmissionsTrend;
  hasIso14001: boolean;
  /** Count of other recognised environmental certifications. */
  envCertificationCount: number;
  unGcSignatory: boolean;
  hasSocialCertification: boolean;
  /** Questionnaire completion 0–100. */
  questionnaireCompletionPercent: number;
  hasComplianceViolation: boolean;
  hasBCorp: boolean;
  /** Broader ESG data completeness 0–100. */
  dataCompletionPercent: number;
  hasRegulatoryFlag: boolean;
}

export interface PillarScore {
  score: number;
  weight: number;
  contributors: string[];
}

export interface RiskFormulaResult {
  environmental: PillarScore;
  social: PillarScore;
  governance: PillarScore;
  totalScore: number;
  tier: RiskTier;
  badge: RiskBadge;
  flags: string[];
  dataQuality: "high" | "medium" | "low";
}

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

const ENV_CERT_NAMES = [
  "iso 14001",
  "carbon trust",
  "ecolabel",
  "emas",
  "science based targets",
  "sbti",
];

const SOCIAL_CERT_NAMES = [
  "fair trade",
  "sa8000",
  "sedex",
  "ethical trading initiative",
  "living wage",
];

const GOV_CERT_NAMES = ["b corp", "iso 37001", "iso 27001"];

export function classifyCertification(
  name: string,
): "environmental" | "social" | "governance" | "other" {
  const lower = name.toLowerCase();
  if (ENV_CERT_NAMES.some((c) => lower.includes(c))) return "environmental";
  if (SOCIAL_CERT_NAMES.some((c) => lower.includes(c))) return "social";
  if (GOV_CERT_NAMES.some((c) => lower.includes(c))) return "governance";
  return "other";
}

/**
 * Environmental pillar (0–100 risk).
 * Drivers: missing emissions, YoY trend, ISO 14001 / env certs.
 */
export function scoreEnvironmental(input: SupplierRiskFactorInput): PillarScore {
  let score = 40;
  const contributors: string[] = [];

  if (!input.hasEmissionsData) {
    score += 35;
    contributors.push("missing_emissions");
  } else {
    score -= 10;
    contributors.push("emissions_present");
    if (input.emissionsTrend === "increasing") {
      score += 30;
      contributors.push("yoy_increase");
    } else if (input.emissionsTrend === "declining") {
      score -= 20;
      contributors.push("yoy_decline");
    } else if (input.emissionsTrend === "stable") {
      score += 5;
      contributors.push("yoy_stable");
    } else {
      contributors.push("yoy_unknown");
    }
  }

  if (input.hasIso14001) {
    score -= 15;
    contributors.push("iso_14001");
  }

  const certRelief = Math.min(10, input.envCertificationCount * 5);
  if (certRelief > 0) {
    score -= certRelief;
    contributors.push("env_certifications");
  }

  return {
    score: clamp(0, 100, score),
    weight: ENV_WEIGHT,
    contributors,
  };
}

/**
 * Social pillar (0–100 risk).
 * Drivers: UN GC, social certifications, questionnaire completeness, compliance.
 */
export function scoreSocial(input: SupplierRiskFactorInput): PillarScore {
  let score = 45;
  const contributors: string[] = [];

  if (input.unGcSignatory) {
    score -= 20;
    contributors.push("un_gc_signatory");
  } else {
    contributors.push("not_un_gc");
  }

  if (input.hasSocialCertification) {
    score -= 15;
    contributors.push("social_certification");
  }

  const q = clamp(0, 100, input.questionnaireCompletionPercent);
  if (q < 50) {
    score += 25;
    contributors.push("questionnaire_incomplete");
  } else if (q < 80) {
    score += 10;
    contributors.push("questionnaire_partial");
  } else {
    score -= 10;
    contributors.push("questionnaire_complete");
  }

  if (input.hasComplianceViolation) {
    score += 30;
    contributors.push("compliance_violation");
  }

  return {
    score: clamp(0, 100, score),
    weight: SOCIAL_WEIGHT,
    contributors,
  };
}

/**
 * Governance pillar (0–100 risk).
 * Drivers: B Corp / gov certs, data completeness, regulatory flags.
 */
export function scoreGovernance(input: SupplierRiskFactorInput): PillarScore {
  let score = 45;
  const contributors: string[] = [];

  if (input.hasBCorp) {
    score -= 20;
    contributors.push("b_corp");
  }

  const d = clamp(0, 100, input.dataCompletionPercent);
  if (d < 50) {
    score += 25;
    contributors.push("data_incomplete");
  } else if (d < 80) {
    score += 10;
    contributors.push("data_partial");
  } else {
    score -= 10;
    contributors.push("data_complete");
  }

  if (input.hasRegulatoryFlag) {
    score += 30;
    contributors.push("regulatory_flag");
  }

  return {
    score: clamp(0, 100, score),
    weight: GOV_WEIGHT,
    contributors,
  };
}

export function computeOverallRisk(
  environmental: number,
  social: number,
  governance: number,
): number {
  return Math.round(
    environmental * ENV_WEIGHT + social * SOCIAL_WEIGHT + governance * GOV_WEIGHT,
  );
}

export function riskTierOf(score: number): RiskTier {
  if (score < 40) return "low";
  if (score < 70) return "medium";
  if (score < 85) return "high";
  return "critical";
}

export function badgeTierOf(tier: RiskTier): RiskBadge {
  if (tier === "critical" || tier === "high") return "high";
  return tier;
}

export function dataQualityOf(input: SupplierRiskFactorInput): "high" | "medium" | "low" {
  if (
    input.questionnaireCompletionPercent >= 80 &&
    input.dataCompletionPercent >= 70 &&
    input.hasEmissionsData
  ) {
    return "high";
  }
  if (input.questionnaireCompletionPercent >= 50 || input.dataCompletionPercent >= 50) {
    return "medium";
  }
  return "low";
}

export function collectFlags(
  input: SupplierRiskFactorInput,
  environmental: PillarScore,
  social: PillarScore,
  governance: PillarScore,
  totalScore: number,
): string[] {
  const flags = new Set<string>();
  if (!input.hasEmissionsData) flags.add("missing_emissions");
  if (input.emissionsTrend === "increasing") flags.add("yoy_increase");
  if (input.questionnaireCompletionPercent < 50) flags.add("incomplete_data");
  if (input.hasComplianceViolation) flags.add("compliance_violation");
  if (input.hasRegulatoryFlag) flags.add("regulatory_flag");
  if (totalScore >= 70) flags.add("high_risk");
  for (const c of environmental.contributors) {
    if (c === "missing_emissions" || c === "yoy_increase") flags.add(c);
  }
  for (const c of social.contributors) {
    if (c === "compliance_violation" || c === "questionnaire_incomplete") flags.add(c);
  }
  for (const c of governance.contributors) {
    if (c === "regulatory_flag" || c === "data_incomplete") flags.add(c);
  }
  return Array.from(flags);
}

/** Locked entry point for the Feature 10 formula. */
export function calculateSupplierRisk(input: SupplierRiskFactorInput): RiskFormulaResult {
  const environmental = scoreEnvironmental(input);
  const social = scoreSocial(input);
  const governance = scoreGovernance(input);
  const totalScore = computeOverallRisk(
    environmental.score,
    social.score,
    governance.score,
  );
  const tier = riskTierOf(totalScore);

  return {
    environmental,
    social,
    governance,
    totalScore,
    tier,
    badge: badgeTierOf(tier),
    flags: collectFlags(input, environmental, social, governance, totalScore),
    dataQuality: dataQualityOf(input),
  };
}

export function isHighRiskTier(tier: RiskTier): boolean {
  return tier === "high" || tier === "critical";
}

export function movedToHighRisk(
  previousTier: RiskTier | null | undefined,
  nextTier: RiskTier,
): boolean {
  const wasLower = previousTier === "low" || previousTier === "medium" || !previousTier;
  return wasLower && isHighRiskTier(nextTier);
}
