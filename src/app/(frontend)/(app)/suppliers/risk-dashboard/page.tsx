import { redirect } from "next/navigation";
import { getPayload } from "payload";

import { RiskDashboardClient } from "./RiskDashboardClient";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

export const metadata = {
  title: "Risk Dashboard | ClearESG",
};

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
    const tier =
      ((s.riskMetrics as Record<string, unknown>)?.tier as string | undefined) ??
      "unknown";
    const validTiers = ["low", "medium", "high", "critical", "unknown"];
    return {
      id: String(s.id),
      name: s.name,
      category: s.category,
      annualSpend: s.annualSpend ?? null,
      riskScore:
        ((s.riskMetrics as Record<string, unknown>)?.score as
          number | null | undefined) ?? null,
      riskTier: (validTiers.includes(tier) ? tier : "unknown") as
        "low" | "medium" | "high" | "critical" | "unknown",
      dataCompleteness:
        ((s.esgData as Record<string, unknown>)?.dataCompletionPercent as
          number | undefined) ?? 0,
      unGcSignatory:
        ((s.esgData as Record<string, unknown>)?.unGcSignatory as boolean | undefined) ??
        false,
      lastCalculatedAt:
        ((s.riskMetrics as Record<string, unknown>)?.calculatedAt as
          string | null | undefined) ?? null,
    };
  });

  const validScores = suppliers.filter((s) => s.riskScore !== null);
  const avgRiskScore =
    validScores.length > 0
      ? Math.round(
          validScores.reduce(
            (sum: number, s) => sum + ((s.riskScore as number) ?? 0),
            0,
          ) / validScores.length,
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
    dataQuality: {
      complete: suppliers.filter((s) => ((s.dataCompleteness as number) ?? 0) >= 80)
        .length,
      partial: suppliers.filter(
        (s) =>
          ((s.dataCompleteness as number) ?? 0) >= 50 &&
          ((s.dataCompleteness as number) ?? 0) < 80,
      ).length,
      incomplete: suppliers.filter((s) => ((s.dataCompleteness as number) ?? 0) < 50)
        .length,
    },
  };

  return <RiskDashboardClient initialSuppliers={suppliers} stats={stats} />;
}
