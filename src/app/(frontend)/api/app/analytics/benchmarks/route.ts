import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";
import {
  calculatePeerBenchmarks,
  getAnonymizedPeers,
  getBenchmarkStatus,
  getBenchmarkInsights,
} from "@/lib/analytics/benchmarking";

/**
 * GET /api/app/analytics/benchmarks
 * Get peer benchmarks for organization
 */
export async function GET(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const metricKey = url.searchParams.get("metricKey") || "electricity_kwh";

    const payload = await getPayload({ config });

    const benchmark = await calculatePeerBenchmarks(
      payload,
      ctx.activeOrg.id as string,
      metricKey,
    );

    if (!benchmark) {
      return NextResponse.json(
        {
          available: false,
          reason: "not_enough_peers",
          message: "Not enough peers to generate benchmark",
        },
        { status: 200 },
      );
    }

    const status = getBenchmarkStatus(benchmark.percentileRank);
    const insights = getBenchmarkInsights(status);

    // Get peer list
    const peers = await getAnonymizedPeers(payload, ctx.activeOrg.id as string);

    return NextResponse.json({
      available: true,
      benchmark: {
        metricKey: benchmark.metricKey,
        p10: benchmark.p10,
        p25: benchmark.p25,
        p50: benchmark.p50,
        p75: benchmark.p75,
        p90: benchmark.p90,
        cohortSize: benchmark.cohortSize,
        yourValue: benchmark.yourValue,
        percentileRank: benchmark.percentileRank,
      },
      status,
      insights,
      peers,
    });
  } catch (error) {
    console.error("Benchmark error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
