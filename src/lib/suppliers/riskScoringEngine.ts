import { getPayload } from "payload";

import config from "@/payload.config";
import {
  calculateSupplierRisk,
  classifyCertification,
  movedToHighRisk,
  type EmissionsTrend,
  type RiskFormulaResult,
  type RiskMitigation,
  type RiskTier,
  type SupplierRiskFactorInput,
} from "./riskFormula";

export type {
  RiskFormulaResult,
  RiskMitigation,
  RiskTier,
  SupplierRiskFactorInput,
} from "./riskFormula";

export {
  calculateSupplierRisk,
  badgeTierOf,
  computeOverallRisk,
  ENV_WEIGHT,
  GOV_WEIGHT,
  SOCIAL_WEIGHT,
  isHighRiskTier,
  movedToHighRisk,
  riskTierOf,
} from "./riskFormula";

/**
 * Persisted + API-facing breakdown for a supplier risk score.
 * Pillar weights are always Environmental 40% / Social 30% / Governance 30%.
 */
export interface RiskScoreBreakdown {
  totalScore: number;
  tier: RiskTier;
  badge: "low" | "medium" | "high";
  factors: {
    environmental: { score: number; weight: number; contributors: string[] };
    social: { score: number; weight: number; contributors: string[] };
    governance: { score: number; weight: number; contributors: string[] };
  };
  flags: string[];
  mitigations: RiskMitigation[];
  lastCalculated: Date;
  dataQuality: "high" | "medium" | "low";
  highRiskAlert: boolean;
}

type CertEntry = { name?: string } | string;

function certNameOf(entry: CertEntry): string {
  if (typeof entry === "string") return entry;
  return typeof entry.name === "string" ? entry.name : "";
}

function parseMitigations(raw: unknown): RiskMitigation[] {
  if (!Array.isArray(raw)) return [];
  const out: RiskMitigation[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.action !== "string") continue;
    const status = row.status;
    if (status !== "open" && status !== "in_progress" && status !== "done") continue;
    out.push({
      id: row.id,
      action: row.action,
      status,
      createdAt:
        typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
      completedAt: typeof row.completedAt === "string" ? row.completedAt : null,
    });
  }
  return out;
}

function emissionsTrendFromValues(values: number[]): EmissionsTrend {
  if (values.length < 2) return values.length === 1 ? "unknown" : "unknown";
  const latest = values[0];
  const prior = values[1];
  if (latest == null || prior == null || prior === 0) return "unknown";
  const delta = (latest - prior) / Math.abs(prior);
  if (delta <= -0.05) return "declining";
  if (delta >= 0.05) return "increasing";
  return "stable";
}

/**
 * Build pure-formula inputs from supplier + related records.
 */
export function buildRiskFactorInput(args: {
  esgData: Record<string, unknown> | null | undefined;
  questionnaireCompletionPercent: number;
  hasEmissionsData: boolean;
  emissionsTrend: EmissionsTrend;
  hasComplianceViolation?: boolean;
  hasRegulatoryFlag?: boolean;
}): SupplierRiskFactorInput {
  const esg = args.esgData ?? {};
  const certifications = Array.isArray(esg.certifications)
    ? (esg.certifications as CertEntry[])
    : [];

  let envCertificationCount = 0;
  let hasSocialCertification = false;
  for (const cert of certifications) {
    const name = certNameOf(cert);
    if (!name) continue;
    const pillar = classifyCertification(name);
    if (pillar === "environmental" && !name.toLowerCase().includes("iso 14001")) {
      envCertificationCount += 1;
    }
    if (pillar === "social") hasSocialCertification = true;
  }

  const dataCompletion =
    typeof esg.dataCompletionPercent === "number"
      ? esg.dataCompletionPercent
      : args.questionnaireCompletionPercent;

  return {
    hasEmissionsData: args.hasEmissionsData,
    emissionsTrend: args.emissionsTrend,
    hasIso14001: Boolean(esg.hasIso14001),
    envCertificationCount,
    unGcSignatory: Boolean(esg.unGcSignatory),
    hasSocialCertification,
    questionnaireCompletionPercent: args.questionnaireCompletionPercent,
    hasComplianceViolation: Boolean(args.hasComplianceViolation),
    hasBCorp: Boolean(esg.hasBCorp),
    dataCompletionPercent: dataCompletion,
    hasRegulatoryFlag: Boolean(args.hasRegulatoryFlag),
  };
}

function toBreakdown(
  result: RiskFormulaResult,
  mitigations: RiskMitigation[],
  previousTier: RiskTier | null,
): RiskScoreBreakdown {
  return {
    totalScore: result.totalScore,
    tier: result.tier,
    badge: result.badge,
    factors: {
      environmental: {
        score: result.environmental.score,
        weight: result.environmental.weight,
        contributors: result.environmental.contributors,
      },
      social: {
        score: result.social.score,
        weight: result.social.weight,
        contributors: result.social.contributors,
      },
      governance: {
        score: result.governance.score,
        weight: result.governance.weight,
        contributors: result.governance.contributors,
      },
    },
    flags: result.flags,
    mitigations,
    lastCalculated: new Date(),
    dataQuality: result.dataQuality,
    highRiskAlert: movedToHighRisk(previousTier, result.tier),
  };
}

/**
 * Calculate questionnaire / ESG risk score and persist to supplier.riskMetrics.
 */
export async function calculateRiskScore(
  supplierId: string,
): Promise<RiskScoreBreakdown | null> {
  try {
    const payload = await getPayload({ config });

    const supplier = await payload.findByID({
      collection: "suppliers",
      id: supplierId,
      overrideAccess: true,
    });

    const questionnaires = await payload.find({
      collection: "supplier-questionnaires",
      where: { supplier: { equals: supplierId } },
      limit: 1,
      overrideAccess: true,
    });

    const dataSourcesResult = await payload.find({
      collection: "supplier-data-sources",
      where: { supplier: { equals: supplierId } },
      limit: 100,
      sort: "-updatedAt",
      overrideAccess: true,
    });

    const questionnaire = questionnaires.docs[0];
    const esgData = (supplier.esgData ?? {}) as Record<string, unknown>;
    const completionFromQuestionnaire =
      questionnaire && typeof questionnaire.completionPercent === "number"
        ? questionnaire.completionPercent
        : 0;
    const completionFromEsg =
      typeof esgData.dataCompletionPercent === "number"
        ? esgData.dataCompletionPercent
        : 0;
    const questionnaireCompletionPercent = Math.max(
      completionFromQuestionnaire,
      completionFromEsg,
    );

    const emissionSources = dataSourcesResult.docs.filter((ds) => {
      const metric = String(ds.metricName ?? "").toLowerCase();
      const source = String(ds.source ?? "");
      return (
        metric.includes("emission") || source === "eu_ets" || source === "sec_filing"
      );
    });

    const emissionValues = emissionSources
      .map((ds) => (typeof ds.value === "number" ? ds.value : null))
      .filter((v): v is number => v !== null);

    const hasEmissionsData =
      emissionValues.length > 0 ||
      Boolean(
        supplier.submittedData &&
        typeof supplier.submittedData === "object" &&
        ("scope1" in (supplier.submittedData as object) ||
          "emissions" in (supplier.submittedData as object)),
      );

    const emissionsTrend = emissionsTrendFromValues(emissionValues);

    const existingMetrics = (supplier.riskMetrics ?? {}) as Record<string, unknown>;
    const previousTier =
      existingMetrics.tier === "low" ||
      existingMetrics.tier === "medium" ||
      existingMetrics.tier === "high" ||
      existingMetrics.tier === "critical"
        ? existingMetrics.tier
        : null;

    const existingFlags = Array.isArray(existingMetrics.flags)
      ? (existingMetrics.flags as string[])
      : [];
    const hasComplianceViolation = existingFlags.includes("compliance_violation");
    const hasRegulatoryFlag = existingFlags.includes("regulatory_flag");

    const input = buildRiskFactorInput({
      esgData,
      questionnaireCompletionPercent,
      hasEmissionsData,
      emissionsTrend,
      hasComplianceViolation,
      hasRegulatoryFlag,
    });

    const result = calculateSupplierRisk(input);
    const mitigations = parseMitigations(existingMetrics.mitigations);
    const breakdown = toBreakdown(result, mitigations, previousTier);

    const flags = [...breakdown.flags];
    if (breakdown.highRiskAlert) flags.push("high_risk_alert");

    await payload.update({
      collection: "suppliers",
      id: supplierId,
      data: {
        riskMetrics: {
          score: breakdown.totalScore,
          tier: breakdown.tier,
          environmentalScore: breakdown.factors.environmental.score,
          socialScore: breakdown.factors.social.score,
          governanceScore: breakdown.factors.governance.score,
          flags,
          mitigations,
          calculatedAt: new Date().toISOString(),
        },
      },
      context: { skipRiskRecalc: true },
      overrideAccess: true,
    });

    return breakdown;
  } catch (error) {
    console.error("Error calculating risk score:", error);
    return null;
  }
}

/**
 * Batch recalculate risk scores for all suppliers in an organisation.
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
  const results = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    const suppliers = await payload.find({
      collection: "suppliers",
      where: { organisation: { equals: orgId } },
      limit: 1000,
      overrideAccess: true,
    });

    for (let i = 0; i < suppliers.docs.length; i += parallel) {
      const batch = suppliers.docs.slice(i, i + parallel);
      const settled = await Promise.all(
        batch.map(async (supplier) => {
          try {
            const breakdown = await calculateRiskScore(String(supplier.id));
            if (!breakdown) {
              results.failed += 1;
              results.errors.push(`No score for ${supplier.name}`);
              return;
            }
            results.succeeded += 1;
          } catch (error) {
            results.failed += 1;
            results.errors.push(
              `Error for ${supplier.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
          }
        }),
      );
      void settled;
      results.processed += batch.length;
    }

    return results;
  } catch (error) {
    results.errors.push(error instanceof Error ? error.message : "Unknown error");
    return results;
  }
}

/**
 * Detect if supplier has moved into high-risk tier (for alert path).
 */
export async function hasMovedToHighRisk(
  supplierId: string,
  previousTier: RiskTier | null,
): Promise<boolean> {
  const breakdown = await calculateRiskScore(supplierId);
  if (!breakdown) return false;
  return movedToHighRisk(previousTier, breakdown.tier);
}

/**
 * Get risk score with explanation copy.
 */
export async function getRiskScoreWithExplanation(supplierId: string): Promise<{
  score: RiskScoreBreakdown;
  explanation: string;
} | null> {
  const score = await calculateRiskScore(supplierId);
  if (!score) return null;

  const explanations: Record<RiskTier, string> = {
    low: "Supplier shows strong ESG signals across environmental, social, and governance pillars.",
    medium:
      "Supplier has mixed ESG signals. Engagement recommended on incomplete pillars.",
    high: "Supplier ESG risk is elevated. Prioritise mitigation and data collection.",
    critical:
      "Supplier ESG risk is critical. Escalate engagement and track mitigations closely.",
  };

  return {
    score,
    explanation: explanations[score.tier],
  };
}

/**
 * Append or update a mitigation action on the supplier risk record.
 */
export async function upsertRiskMitigation(
  supplierId: string,
  mitigation: Omit<RiskMitigation, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): Promise<RiskMitigation[] | null> {
  try {
    const payload = await getPayload({ config });
    const supplier = await payload.findByID({
      collection: "suppliers",
      id: supplierId,
      overrideAccess: true,
    });
    const metrics = (supplier.riskMetrics ?? {}) as Record<string, unknown>;
    const existing = parseMitigations(metrics.mitigations);
    const id = mitigation.id ?? `mit-${Date.now()}`;
    const next: RiskMitigation = {
      id,
      action: mitigation.action,
      status: mitigation.status,
      createdAt: mitigation.createdAt ?? new Date().toISOString(),
      completedAt:
        mitigation.status === "done"
          ? (mitigation.completedAt ?? new Date().toISOString())
          : null,
    };
    const idx = existing.findIndex((m) => m.id === id);
    if (idx >= 0) existing[idx] = next;
    else existing.push(next);

    await payload.update({
      collection: "suppliers",
      id: supplierId,
      data: {
        riskMetrics: {
          ...metrics,
          mitigations: existing,
        },
      },
      context: { skipRiskRecalc: true },
      overrideAccess: true,
    });

    return existing;
  } catch (error) {
    console.error("Error upserting risk mitigation:", error);
    return null;
  }
}

export function supplierNeedsRiskRecalc(
  previous: Record<string, unknown> | null | undefined,
  next: Record<string, unknown> | null | undefined,
): boolean {
  if (!next) return false;
  const prevEsg = (previous?.esgData ?? {}) as Record<string, unknown>;
  const nextEsg = (next.esgData ?? {}) as Record<string, unknown>;
  const keys = [
    "unGcSignatory",
    "hasIso14001",
    "hasBCorp",
    "certifications",
    "dataCompletionPercent",
  ] as const;
  for (const key of keys) {
    if (JSON.stringify(prevEsg[key]) !== JSON.stringify(nextEsg[key])) return true;
  }
  if (JSON.stringify(previous?.submittedData) !== JSON.stringify(next.submittedData)) {
    return true;
  }
  return false;
}
