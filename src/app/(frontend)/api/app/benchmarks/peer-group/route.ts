import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  COHORT_GATE_NOTE,
  currentPeriodLabel,
  findMatchingPeerGroup,
  MIN_COHORT_SIZE,
  orgPeerDims,
} from "@/lib/benchmarks";
import { mayPublishBenchmarkCohorts } from "@/lib/launch/gates";
import config from "@/payload.config";

/**
 * GET /api/app/benchmarks/peer-group?metricKey=
 * Auto-matched peer group dimensions (no peer identities).
 */
export async function GET(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const optOut = Boolean(ctx.activeOrg.benchmarkOptOut);
  const dims = orgPeerDims(ctx.activeOrg);

  if (!mayPublishBenchmarkCohorts()) {
    return NextResponse.json({
      available: false,
      reason: "cohorts_not_published",
      message:
        "Sector cohorts are not published yet (benchmark consent unsigned — LAUNCH_DECISIONS #5).",
      requested: { ...dims, period: currentPeriodLabel() },
      minCohortSize: MIN_COHORT_SIZE,
      cohortGate: COHORT_GATE_NOTE,
      benchmarkOptOut: optOut,
    });
  }

  const metricKey = new URL(req.url).searchParams.get("metricKey") ?? "electricity_kwh";
  const payload = await getPayload({ config });
  const match = await findMatchingPeerGroup(payload, ctx.activeOrg, { metricKey });

  if (!match) {
    return NextResponse.json({
      available: false,
      reason: "not_enough_peers",
      message: `Not enough peers yet. Need at least ${MIN_COHORT_SIZE} organisations in a matching cohort.`,
      requested: { ...dims, period: currentPeriodLabel(), metricKey },
      minCohortSize: MIN_COHORT_SIZE,
      cohortGate: COHORT_GATE_NOTE,
      benchmarkOptOut: optOut,
    });
  }

  return NextResponse.json({
    available: true,
    peerGroup: {
      sector: match.matched.sector,
      sizeBand: match.matched.sizeBand,
      geography: match.matched.geography,
      period: match.matched.period,
      metricKey: match.matched.metricKey,
      matchTier: match.matchTier,
      cohortSize: match.row.cohortSize,
    },
    requested: { ...dims, period: currentPeriodLabel(), metricKey },
    minCohortSize: MIN_COHORT_SIZE,
    cohortGate: COHORT_GATE_NOTE,
    benchmarkOptOut: optOut,
  });
}
