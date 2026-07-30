import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { badgeTierOf, type RiskTier } from "@/lib/suppliers/riskFormula";
import config from "@/payload.config";

/**
 * GET /api/app/suppliers/risk-scores
 * Aligns with Feature 10 "risk-report" — list suppliers by risk.
 */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "view",
    "supplier",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await getPayload({ config });
  const suppliers = await payload.find({
    collection: "suppliers",
    where: { organisation: { equals: ctx.activeOrg.id } },
    limit: 500,
    sort: "-updatedAt",
    overrideAccess: true,
  });

  const riskScores = suppliers.docs.map((s) => {
    const riskMetrics = (s.riskMetrics ?? {}) as Record<string, unknown>;
    const esgData = (s.esgData ?? {}) as Record<string, unknown>;
    const riskScore = typeof riskMetrics.score === "number" ? riskMetrics.score : null;
    const tierRaw = typeof riskMetrics.tier === "string" ? riskMetrics.tier : null;
    const tier =
      tierRaw === "low" ||
      tierRaw === "medium" ||
      tierRaw === "high" ||
      tierRaw === "critical"
        ? (tierRaw as RiskTier)
        : null;
    const dataCompleteness =
      typeof esgData.dataCompletionPercent === "number"
        ? esgData.dataCompletionPercent
        : 0;
    const flags = Array.isArray(riskMetrics.flags) ? (riskMetrics.flags as string[]) : [];

    return {
      id: s.id,
      name: s.name,
      category: s.category,
      annualSpend: s.annualSpend ?? null,
      riskScore,
      riskTier: tier,
      badge: tier ? badgeTierOf(tier) : null,
      environmentalScore:
        typeof riskMetrics.environmentalScore === "number"
          ? riskMetrics.environmentalScore
          : null,
      socialScore:
        typeof riskMetrics.socialScore === "number" ? riskMetrics.socialScore : null,
      governanceScore:
        typeof riskMetrics.governanceScore === "number"
          ? riskMetrics.governanceScore
          : null,
      dataCompleteness,
      unGcSignatory: Boolean(esgData.unGcSignatory),
      certifications: Array.isArray(esgData.certifications) ? esgData.certifications : [],
      lastCalculatedAt:
        typeof riskMetrics.calculatedAt === "string" ? riskMetrics.calculatedAt : null,
      flags,
      highRiskAlert:
        flags.includes("high_risk_alert") ||
        (tier !== null && (tier === "high" || tier === "critical")),
    };
  });

  const totalSuppliers = riskScores.length;
  const riskTierCounts = {
    low: riskScores.filter((s) => s.riskTier === "low").length,
    medium: riskScores.filter((s) => s.riskTier === "medium").length,
    high: riskScores.filter((s) => s.riskTier === "high").length,
    critical: riskScores.filter((s) => s.riskTier === "critical").length,
  };

  const highAlertCount = riskScores.filter((s) => s.highRiskAlert).length;

  const scored = riskScores.filter((s) => s.riskScore !== null);
  const avgRiskScore =
    scored.length > 0
      ? Math.round(
          scored.reduce((sum, s) => sum + (s.riskScore as number), 0) / scored.length,
        )
      : null;

  return NextResponse.json({
    suppliers: riskScores,
    stats: {
      totalSuppliers,
      avgRiskScore,
      riskTierCounts,
      highAlertCount,
      completenessPercentile: {
        low: riskScores.filter((s) => s.dataCompleteness < 30).length,
        medium: riskScores.filter(
          (s) => s.dataCompleteness >= 30 && s.dataCompleteness < 70,
        ).length,
        high: riskScores.filter((s) => s.dataCompleteness >= 70).length,
      },
    },
  });
}
