import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  COHORT_GATE_NOTE,
  listIndustryAverages,
  MIN_COHORT_SIZE,
  resolveSector,
} from "@/lib/benchmarks";
import { mayPublishBenchmarkCohorts } from "@/lib/launch/gates";
import config from "@/payload.config";

/**
 * GET /api/app/benchmarks/industry-averages?sector=&period=
 * Anonymised industry mean / median / best by cohort. No peer names.
 */
export async function GET(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!mayPublishBenchmarkCohorts()) {
    return NextResponse.json({
      available: false,
      reason: "cohorts_not_published",
      averages: [],
      minCohortSize: MIN_COHORT_SIZE,
      cohortGate: COHORT_GATE_NOTE,
      benchmarkOptOut: Boolean(ctx.activeOrg.benchmarkOptOut),
    });
  }

  const url = new URL(req.url);
  const sectorParam = url.searchParams.get("sector");
  const period = url.searchParams.get("period") ?? undefined;
  const sector = sectorParam
    ? resolveSector(sectorParam)
    : resolveSector(ctx.activeOrg.sector);

  const payload = await getPayload({ config });
  const averages = await listIndustryAverages(payload, { sector, period });

  return NextResponse.json({
    available: averages.length > 0,
    averages,
    minCohortSize: MIN_COHORT_SIZE,
    cohortGate: COHORT_GATE_NOTE,
    benchmarkOptOut: Boolean(ctx.activeOrg.benchmarkOptOut),
  });
}
