import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { buildComparison, COHORT_GATE_NOTE, MIN_COHORT_SIZE } from "@/lib/benchmarks";
import config from "@/payload.config";

/**
 * Returns benchmarks only when cohortSize >= 8 and live gate is on.
 * Never returns peer names or min/max. Opted-out orgs still see cohorts but do not contribute (recompute).
 */
export async function GET(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const metricKey = new URL(req.url).searchParams.get("metricKey") ?? "electricity_kwh";
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
    metricKey,
  );

  if (!result.available) {
    return NextResponse.json({
      available: false,
      reason: result.reason,
      message: result.message,
      minCohortSize: result.minCohortSize ?? MIN_COHORT_SIZE,
      cohortGate: result.cohortGate ?? COHORT_GATE_NOTE,
      benchmarkOptOut: result.benchmarkOptOut,
    });
  }

  const rank = result.percentileRank;
  const improve =
    rank !== null && rank <= 25
      ? [
          {
            label: "Enter measured electricity (moves intensity)",
            href: "/data#electricity_kwh",
          },
          {
            label: "Raise renewable share",
            href: "/data#electricity_renewable_pct",
          },
          { label: "Request supplier primary data", href: "/suppliers" },
        ]
      : rank !== null && rank <= 50
        ? [
            { label: "Close remaining Data gaps", href: "/data" },
            {
              label: "Confirm renewable share is measured",
              href: "/data#electricity_renewable_pct",
            },
            { label: "Publish living report", href: "/reports" },
          ]
        : [
            { label: "Review material topics", href: "/materiality" },
            { label: "Publish living report", href: "/reports" },
          ];

  return NextResponse.json({
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
    minCohortSize: result.minCohortSize,
    benchmarkOptOut: result.benchmarkOptOut,
    improve,
  });
}
