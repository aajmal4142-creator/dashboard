import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { buildComparison } from "@/lib/benchmarks";
import { getBenchmarkStatus, getBenchmarkInsights } from "@/lib/analytics/benchmarking";
import config from "@/payload.config";

/**
 * GET /api/app/analytics/benchmarks
 * Peer benchmarks for organisation — aligns with /api/app/benchmarks*.
 * Never returns peer organisation names or ids.
 */
export async function GET(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const metricKey = new URL(req.url).searchParams.get("metricKey") || "electricity_kwh";
    const payload = await getPayload({ config });

    const result = await buildComparison(
      payload,
      {
        id: ctx.activeOrg.id as string,
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
        minCohortSize: result.minCohortSize,
        cohortGate: result.cohortGate,
        benchmarkOptOut: result.benchmarkOptOut,
      });
    }

    const status = getBenchmarkStatus(result.percentileRank ?? undefined);
    const insights = getBenchmarkInsights(status);

    return NextResponse.json({
      available: true,
      benchmark: {
        metricKey: result.peerGroup.metricKey,
        p10: result.stats.p10,
        p25: result.stats.p25,
        p50: result.stats.p50,
        p75: result.stats.p75,
        p90: result.stats.p90,
        mean: result.stats.mean,
        best: result.stats.best,
        median: result.stats.median,
        cohortSize: result.peerGroup.cohortSize,
        yourValue: result.comparison.you ?? undefined,
        percentileRank: result.percentileRank ?? undefined,
      },
      peerGroup: result.peerGroup,
      comparison: result.comparison,
      gaps: result.gaps,
      trend: result.trend,
      status,
      insights,
      cohortGate: result.cohortGate,
      minCohortSize: result.minCohortSize,
      benchmarkOptOut: result.benchmarkOptOut,
    });
  } catch (error) {
    console.error("Benchmark error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
