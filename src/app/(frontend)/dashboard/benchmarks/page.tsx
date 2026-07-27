import { redirect } from "next/navigation";
import { getPayload } from "payload";

import { BenchmarksClient } from "@/app/(frontend)/dashboard/benchmarks/BenchmarksClient";
import { getCurrentContext } from "@/lib/auth";
import { MIN_COHORT_SIZE, percentileRank } from "@/lib/benchmarks";
import { mayPublishBenchmarkCohorts } from "@/lib/launch/gates";
import { sectorLabel } from "@/lib/ui/displayLabels";
import config from "@/payload.config";

export default async function BenchmarksPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/dashboard/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/dashboard/onboarding");

  const optOut = Boolean(ctx.activeOrg.benchmarkOptOut);

  if (!mayPublishBenchmarkCohorts()) {
    return (
      <BenchmarksClient
        role={ctx.role}
        initial={{
          available: false,
          reason: "cohorts_not_published",
          message:
            "Sector cohorts are not published yet (benchmark consent unsigned — LAUNCH_DECISIONS #5).",
          minCohortSize: MIN_COHORT_SIZE,
          benchmarkOptOut: optOut,
        }}
      />
    );
  }

  const payload = await getPayload({ config });
  const sectorPrefix = ctx.activeOrg.sector.trim().charAt(0).toUpperCase() || "C";
  const stats = await payload.find({
    collection: "benchmark-stats",
    where: {
      and: [
        { metricKey: { equals: "electricity_kwh" } },
        { sector: { equals: sectorPrefix } },
        { cohortSize: { greater_than_equal: MIN_COHORT_SIZE } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });
  const row = stats.docs[0];

  if (!row || row.cohortSize < MIN_COHORT_SIZE) {
    return (
      <BenchmarksClient
        role={ctx.role}
        initial={{
          available: false,
          reason: "not_enough_peers",
          message: `Not enough peers in ${sectorLabel(sectorPrefix)} yet (need ${MIN_COHORT_SIZE}+ with electricity data).`,
          minCohortSize: MIN_COHORT_SIZE,
          benchmarkOptOut: optOut,
        }}
      />
    );
  }

  const periods = await payload.find({
    collection: "reporting-periods",
    where: {
      and: [
        { organisation: { equals: ctx.activeOrg.id } },
        { status: { equals: "open" } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });
  let userValue: number | null = null;
  if (periods.docs[0]) {
    const dp = await payload.find({
      collection: "datapoints",
      where: {
        and: [
          { organisation: { equals: ctx.activeOrg.id } },
          { period: { equals: periods.docs[0].id } },
          { metricKey: { equals: "electricity_kwh" } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    });
    userValue = typeof dp.docs[0]?.value === "number" ? dp.docs[0].value : null;
  }

  const synthetic = [
    row.p25 * 0.7,
    row.p25,
    (row.p25 + row.p50) / 2,
    row.p50,
    (row.p50 + row.p75) / 2,
    row.p75,
    row.p75 * 1.15,
    row.p75 * 1.3,
  ].sort((a, b) => a - b);
  const rank = userValue === null ? null : percentileRank(synthetic, userValue);

  return (
    <BenchmarksClient
      role={ctx.role}
      initial={{
        available: true,
        sector: row.sector,
        metricKey: row.metricKey,
        p25: row.p25,
        p50: row.p50,
        p75: row.p75,
        cohortSize: row.cohortSize,
        computedAt: row.computedAt ? String(row.computedAt) : null,
        userValue,
        percentileRank: rank,
        benchmarkOptOut: optOut,
        improve: [
          { label: "Enter electricity (kWh)", href: "/dashboard/data#electricity_kwh" },
          { label: "Request supplier data", href: "/dashboard/suppliers" },
          { label: "Publish report", href: "/dashboard/reports" },
        ],
      }}
    />
  );
}
