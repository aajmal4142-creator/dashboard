import { redirect } from "next/navigation";
import { getPayload } from "payload";

import { BenchmarksClient } from "@/app/(frontend)/(app)/benchmarks/BenchmarksClient";
import { getCurrentContext } from "@/lib/auth";
import { buildComparison, MIN_COHORT_SIZE } from "@/lib/benchmarks";
import config from "@/payload.config";

export default async function BenchmarksPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  const payload = await getPayload({ config });
  const result = await buildComparison(
    payload,
    {
      id: ctx.activeOrg.id,
      sector: ctx.activeOrg.sector,
      revenueBand: ctx.activeOrg.revenueBand,
      country: ctx.activeOrg.country,
      benchmarkOptOut: ctx.activeOrg.benchmarkOptOut,
    },
    "electricity_kwh",
  );

  if (!result.available) {
    return (
      <BenchmarksClient
        role={ctx.role}
        initial={{
          available: false,
          reason: result.reason,
          message: result.message,
          minCohortSize: result.minCohortSize ?? MIN_COHORT_SIZE,
          cohortGate: result.cohortGate,
          benchmarkOptOut: result.benchmarkOptOut,
        }}
      />
    );
  }

  const rank = result.percentileRank;
  const improve =
    rank !== null && rank <= 25
      ? [
          { label: "Enter electricity (kWh)", href: "/data#electricity_kwh" },
          { label: "Request supplier data", href: "/suppliers" },
          { label: "Publish report", href: "/reports" },
        ]
      : [
          { label: "Enter electricity (kWh)", href: "/data#electricity_kwh" },
          { label: "Request supplier data", href: "/suppliers" },
          { label: "Publish report", href: "/reports" },
        ];

  return (
    <BenchmarksClient
      role={ctx.role}
      initial={{
        available: true,
        sector: result.peerGroup.sector,
        sizeBand: result.peerGroup.sizeBand,
        geography: result.peerGroup.geography,
        metricKey: result.peerGroup.metricKey,
        period: result.peerGroup.period,
        matchTier: result.peerGroup.matchTier,
        p10: result.stats.p10,
        p25: result.stats.p25,
        p50: result.stats.p50,
        p75: result.stats.p75,
        p90: result.stats.p90,
        mean: result.stats.mean,
        best: result.stats.best,
        median: result.stats.median,
        cohortSize: result.peerGroup.cohortSize,
        computedAt: result.computedAt,
        userValue: result.comparison.you,
        percentileRank: result.percentileRank,
        comparison: result.comparison,
        gaps: result.gaps,
        trend: result.trend,
        cohortGate: result.cohortGate,
        benchmarkOptOut: result.benchmarkOptOut,
        improve,
      }}
    />
  );
}
