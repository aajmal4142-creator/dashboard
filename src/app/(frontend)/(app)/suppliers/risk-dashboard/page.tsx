import { redirect } from "next/navigation";
import { getPayload } from "payload";

import { RiskDashboardClient } from "./RiskDashboardClient";
import { getCurrentContext } from "@/lib/auth";
import { badgeTierOf, type RiskTier } from "@/lib/suppliers/riskFormula";
import config from "@/payload.config";

export const metadata = {
  title: "Supplier risk | ClearESG",
};

function asTier(value: unknown): RiskTier | "unknown" {
  if (value === "low" || value === "medium" || value === "high" || value === "critical") {
    return value;
  }
  return "unknown";
}

export default async function RiskDashboardPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: "suppliers",
    where: { organisation: { equals: ctx.activeOrg.id } },
    limit: 500,
    sort: "-updatedAt",
    overrideAccess: true,
  });

  const suppliers = result.docs.map((s) => {
    const metrics = (s.riskMetrics ?? {}) as Record<string, unknown>;
    const esg = (s.esgData ?? {}) as Record<string, unknown>;
    const tier = asTier(metrics.tier);
    const flags = Array.isArray(metrics.flags) ? (metrics.flags as string[]) : [];
    const badge = tier === "unknown" ? null : badgeTierOf(tier);

    return {
      id: String(s.id),
      name: s.name,
      category: s.category,
      annualSpend: s.annualSpend ?? null,
      riskScore: typeof metrics.score === "number" ? metrics.score : null,
      riskTier: tier,
      badge,
      dataCompleteness:
        typeof esg.dataCompletionPercent === "number" ? esg.dataCompletionPercent : 0,
      unGcSignatory: Boolean(esg.unGcSignatory),
      lastCalculatedAt:
        typeof metrics.calculatedAt === "string" ? metrics.calculatedAt : null,
      highRiskAlert:
        flags.includes("high_risk_alert") || tier === "high" || tier === "critical",
      environmentalScore:
        typeof metrics.environmentalScore === "number"
          ? metrics.environmentalScore
          : null,
      socialScore: typeof metrics.socialScore === "number" ? metrics.socialScore : null,
      governanceScore:
        typeof metrics.governanceScore === "number" ? metrics.governanceScore : null,
    };
  });

  const validScores = suppliers.filter((s) => s.riskScore !== null);
  const avgRiskScore =
    validScores.length > 0
      ? Math.round(
          validScores.reduce((sum, s) => sum + (s.riskScore as number), 0) /
            validScores.length,
        )
      : null;

  const stats = {
    totalSuppliers: suppliers.length,
    avgRiskScore,
    riskTierCounts: {
      low: suppliers.filter((s) => s.riskTier === "low").length,
      medium: suppliers.filter((s) => s.riskTier === "medium").length,
      high: suppliers.filter((s) => s.riskTier === "high").length,
      critical: suppliers.filter((s) => s.riskTier === "critical").length,
    },
    highAlertCount: suppliers.filter((s) => s.highRiskAlert).length,
    dataQuality: {
      complete: suppliers.filter((s) => s.dataCompleteness >= 80).length,
      partial: suppliers.filter(
        (s) => s.dataCompleteness >= 50 && s.dataCompleteness < 80,
      ).length,
      incomplete: suppliers.filter((s) => s.dataCompleteness < 50).length,
    },
  };

  return <RiskDashboardClient initialSuppliers={suppliers} stats={stats} />;
}
