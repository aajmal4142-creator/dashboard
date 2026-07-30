import { NextResponse } from "next/server";

import { biJson, getBiBenchmarks, requireBiAuth } from "@/lib/bi";

/**
 * GET /api/app/bi/benchmarks — peer comparison for a metric (read-only).
 * Query: metricKey (default electricity_kwh).
 */
export async function GET(req: Request) {
  const auth = await requireBiAuth(req, "benchmarks");
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const metricKey = url.searchParams.get("metricKey") ?? "electricity_kwh";
    const data = await getBiBenchmarks(
      auth.ctx.payload,
      auth.ctx.organisationId,
      metricKey,
    );
    return biJson(data, auth.ctx);
  } catch (error) {
    console.error("BI benchmarks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: auth.ctx.rateLimitHeaders },
    );
  }
}
