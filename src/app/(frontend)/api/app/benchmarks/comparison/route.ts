import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { buildComparison, COHORT_GATE_NOTE, MIN_COHORT_SIZE } from "@/lib/benchmarks";
import config from "@/payload.config";

/**
 * GET /api/app/benchmarks/comparison?metricKey=
 * You vs Median vs Best + gap callouts + trend. Never peer names.
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
      ...result,
      minCohortSize: result.minCohortSize ?? MIN_COHORT_SIZE,
      cohortGate: result.cohortGate ?? COHORT_GATE_NOTE,
    });
  }

  return NextResponse.json(result);
}
