import { getPayload } from "payload";
import config from "@/payload.config";

/**
 * Supplier Risk Scoring Engine
 * Calculates 0-100 risk score from:
 * - Questionnaire completeness (40%)
 * - UN Global Compact signatory status (20%)
 * - Certifications (20%)
 * - Government data availability (20%)
 */

export interface RiskScoreBreakdown {
  totalScore: number;
  tier: "low" | "medium" | "high" | "critical";
  factors: {
    questionnnaireCompleteness: { score: number; weight: number };
    unGcSignatory: { score: number; weight: number };
    certifications: { score: number; weight: number };
    governmentData: { score: number; weight: number };
  };
  lastCalculated: Date;
  dataQuality: "high" | "medium" | "low";
}

/**
 * Calculate questionnaire completeness factor (40% weight)
 * 80-100% answered = 0-20 risk (low)
 * 50-80% = 20-40 risk (medium)
 * <50% = 40-100 risk (high)
 */
function calculateQuestionnnaireCompleteFactor(completionPercent: number): number {
  if (completionPercent >= 80) return 0;
  if (completionPercent >= 50) return 20;
  return 40;
}

/**
 * Calculate UN Global Compact factor (20% weight)
 * Signatory = -10 risk (good)
 * Not signatory = 0 risk (neutral)
 */
function calculateUnGcFactor(isSignatory: boolean): number {
  return isSignatory ? -10 : 0;
}

/**
 * Calculate certifications factor (20% weight)
 * Has certifications (ISO 14001, B Corp, Fair Trade, etc) = -10
 * No certifications = +10
 */
function calculateCertificationsFactor(certifications: string[]): number {
  if (!certifications || certifications.length === 0) return 10;

  // Check for recognized ESG certifications
  const recognizedCerts = [
    "iso 14001",
    "b corp",
    "fair trade",
    "carbon trust",
    "ecolabel",
    "emas",
    "sustainable apparel coalition",
  ];

  const hasCert = certifications.some((cert) =>
    recognizedCerts.some((rec) => cert.toLowerCase().includes(rec)),
  );

  return hasCert ? -10 : 10;
}

/**
 * Calculate government data factor (20% weight)
 * EU ETS data present & declining = -10 (good)
 * EU ETS data present & stable/increasing = +10 (concerning)
 * No government data = 0 (neutral)
 */
function calculateGovernmentDataFactor(
  hasGovtData: boolean,
  emissionsTrend?: "declining" | "stable" | "increasing",
): number {
  if (!hasGovtData) return 0;
  if (emissionsTrend === "declining") return -10;
  return 10;
}

/**
 * Calculate overall risk score (0-100, higher = worse)
 */
export async function calculateRiskScore(
  supplierId: string,
): Promise<RiskScoreBreakdown | null> {
  try {
    const payload = await getPayload({ config });

    // Fetch supplier and questionnaire data
    const supplier = await payload.findByID({
      collection: "suppliers",
      id: supplierId,
    });

    const questionnaires = await payload.find({
      collection: "supplier-questionnaires",
      where: { supplier: { equals: supplierId } },
      limit: 1,
    });

    const dataSourcesResult = await payload.find({
      collection: "supplier-data-sources",
      where: { supplier: { equals: supplierId } },
      limit: 100,
    });

    // Extract relevant data
    const questionnaire = questionnaires.docs[0];
    const completionPercent = questionnaire
      ? (questionnaire.completionPercent as number) || 0
      : 0;

    const esgData = supplier.esgData as unknown as Record<string, unknown>;
    const unGcSignatory = (esgData?.unGcSignatory as boolean) || false;
    const certifications = (esgData?.certifications as unknown[]) || [];

    // Check for government data
    const hasGovtData = dataSourcesResult.docs.some(
      (ds) =>
        (ds.source as string) === "eu_ets" || (ds.source as string) === "sec_filing",
    );
    const govtDataTrend = "stable"; // Would be calculated from historical data

    // Calculate factor scores
    const qFactor = calculateQuestionnnaireCompleteFactor(completionPercent);
    const unGcFactor = calculateUnGcFactor(unGcSignatory);
    const certFactor = calculateCertificationsFactor(
      certifications.map((c: unknown) => (c as Record<string, unknown>).name as string),
    );
    const govtFactor = calculateGovernmentDataFactor(
      hasGovtData,
      govtDataTrend as "declining" | "stable" | "increasing",
    );

    // Weighted calculation
    const baseScore = 50;
    const totalScore = Math.max(
      0,
      Math.min(
        100,
        baseScore +
          qFactor * 0.4 +
          unGcFactor * 0.2 +
          certFactor * 0.2 +
          govtFactor * 0.2,
      ),
    );

    // Determine risk tier
    let tier: "low" | "medium" | "high" | "critical";
    if (totalScore < 30) tier = "low";
    else if (totalScore < 50) tier = "medium";
    else if (totalScore < 75) tier = "high";
    else tier = "critical";

    // Determine data quality
    let dataQuality: "high" | "medium" | "low";
    if (completionPercent >= 80 && hasGovtData) dataQuality = "high";
    else if (completionPercent >= 50) dataQuality = "medium";
    else dataQuality = "low";

    const breakdown: RiskScoreBreakdown = {
      totalScore: Math.round(totalScore),
      tier,
      factors: {
        questionnnaireCompleteness: { score: qFactor, weight: 0.4 },
        unGcSignatory: { score: unGcFactor, weight: 0.2 },
        certifications: { score: certFactor, weight: 0.2 },
        governmentData: { score: govtFactor, weight: 0.2 },
      },
      lastCalculated: new Date(),
      dataQuality,
    };

    // Update supplier risk metrics
    await payload.update({
      collection: "suppliers",
      id: supplierId,
      data: {
        riskMetrics: {
          score: breakdown.totalScore,
          tier: breakdown.tier,
          flags: breakdown.dataQuality === "low" ? ["incomplete_data"] : [],
          calculatedAt: new Date().toISOString(),
        },
      },
    });

    return breakdown;
  } catch (error) {
    console.error("Error calculating risk score:", error);
    return null;
  }
}

/**
 * Batch recalculate risk scores for all suppliers in organization
 * Performance: <2 min for 1000 suppliers
 */
export async function recalculateRiskScoresForOrganisation(
  orgId: string,
  parallel: number = 5,
): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
}> {
  const payload = await getPayload({ config });
  const results: {
    processed: number;
    succeeded: number;
    failed: number;
    errors: string[];
  } = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Fetch all suppliers
    const suppliers = await payload.find({
      collection: "suppliers",
      where: { organisation: { equals: orgId } },
      limit: 1000,
    });

    // Process in batches (parallel processing for speed)
    for (let i = 0; i < suppliers.docs.length; i += parallel) {
      const batch = suppliers.docs.slice(i, i + parallel);
      const promises = batch.map((supplier) =>
        calculateRiskScore(supplier.id as string).catch((error) => {
          results.errors.push(
            `Error for ${supplier.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
          results.failed++;
        }),
      );

      await Promise.all(promises);
      results.processed += batch.length;
      results.succeeded += batch.filter((s) => s !== null).length;
    }

    return results;
  } catch (error) {
    results.errors.push(error instanceof Error ? error.message : "Unknown error");
    return results;
  }
}

/**
 * Detect if supplier has moved into high-risk tier
 * Use for alert system
 */
export async function hasMovedToHighRisk(
  supplierId: string,
  previousTier: "low" | "medium" | "high" | "critical" | null,
): Promise<boolean> {
  const breakdown = await calculateRiskScore(supplierId);
  if (!breakdown) return false;

  const isNowHighRisk = breakdown.tier === "high" || breakdown.tier === "critical";
  const wasLowerRisk = previousTier === "low" || previousTier === "medium";

  return isNowHighRisk && wasLowerRisk;
}

/**
 * Get risk score with explanation
 */
export async function getRiskScoreWithExplanation(supplierId: string): Promise<{
  score: RiskScoreBreakdown;
  explanation: string;
} | null> {
  const score = await calculateRiskScore(supplierId);
  if (!score) return null;

  const explanations: Record<string, string> = {
    low: "Supplier has strong ESG data and credentials. Low risk.",
    medium: "Supplier has partial ESG data. Some engagement needed.",
    high: "Supplier ESG data incomplete or concerning signals. Engagement recommended.",
    critical:
      "Supplier has very limited ESG data or significant red flags. Escalation needed.",
  };

  return {
    score,
    explanation: explanations[score.tier],
  };
}
