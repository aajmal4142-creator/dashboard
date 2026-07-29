export type RiskTier = "low" | "medium" | "high" | "critical";

export interface RiskScoreBreakdown {
  ecovadisScore: number; // 50% weight
  industryRisk: number; // 10% weight
  locationRisk: number; // 10% weight
  spendRisk: number; // 20% weight
  trendRisk: number; // 10% weight
}

export function scoreToRiskTier(score: number): RiskTier {
  if (score >= 60) return "low";
  if (score >= 45) return "medium";
  if (score >= 30) return "high";
  return "critical";
}

export function mapEcoVadisScoreToRisk(
  ecoVadisScore: number,
  _industryCode?: string,
  _annualSpend?: number,
): { tier: RiskTier; score: number; flags: string[] } {
  const flags: string[] = [];

  if (ecoVadisScore < 40) {
    flags.push("low_ecocadis_score");
  }
  if (ecoVadisScore < 30) {
    flags.push("critical_ecovadis_score");
  }

  // Normalize EcoVadis 0-100 to 0-100 risk scale (inverse)
  const normalizedScore = 100 - (ecoVadisScore / 100) * 100;

  return {
    tier: scoreToRiskTier(100 - normalizedScore),
    score: Math.round(normalizedScore),
    flags,
  };
}

export function calculateCompositeRisk(
  breakdown: RiskScoreBreakdown,
): { score: number; tier: RiskTier } {
  const score = Math.round(
    breakdown.ecovadisScore * 0.5 +
      breakdown.industryRisk * 0.1 +
      breakdown.locationRisk * 0.1 +
      breakdown.spendRisk * 0.2 +
      breakdown.trendRisk * 0.1,
  );

  return {
    score: Math.min(100, Math.max(0, score)),
    tier: scoreToRiskTier(score),
  };
}
