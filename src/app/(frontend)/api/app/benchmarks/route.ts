import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { MIN_COHORT_SIZE, percentileRank } from "@/lib/benchmarks";
import { mayPublishBenchmarkCohorts } from "@/lib/launch/gates";
import config from "@/payload.config";

/**
 * Returns benchmarks only when cohortSize >= 8 and live gate is on.
 * Never returns min/max. Opted-out orgs still see cohorts but do not contribute (recompute).
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
      message:
        "Sector cohorts are not published yet (benchmark consent unsigned — LAUNCH_DECISIONS #5).",
      minCohortSize: MIN_COHORT_SIZE,
      benchmarkOptOut: Boolean(ctx.activeOrg.benchmarkOptOut),
    });
  }

  const metricKey = new URL(req.url).searchParams.get("metricKey") ?? "electricity_kwh";
  const sectorPrefix = ctx.activeOrg.sector.trim().charAt(0).toUpperCase() || "C";

  const payload = await getPayload({ config });
  const stats = await payload.find({
    collection: "benchmark-stats",
    where: {
      and: [
        { metricKey: { equals: metricKey } },
        { sector: { equals: sectorPrefix } },
        { cohortSize: { greater_than_equal: MIN_COHORT_SIZE } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });

  const row = stats.docs[0];
  if (!row || row.cohortSize < MIN_COHORT_SIZE) {
    return NextResponse.json({
      available: false,
      reason: "not_enough_peers",
      message: `Not enough peers yet for sector ${sectorPrefix}. Need at least ${MIN_COHORT_SIZE}.`,
      minCohortSize: MIN_COHORT_SIZE,
      benchmarkOptOut: Boolean(ctx.activeOrg.benchmarkOptOut),
    });
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
          { metricKey: { equals: metricKey } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    });
    const v = dp.docs[0]?.value;
    userValue = typeof v === "number" ? v : null;
  }

  // Synthetic sorted sample from quartiles for curve display (not raw peers — no min/max leak).
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

  const improve =
    rank !== null && rank <= 25
      ? [
          {
            label: "Enter measured electricity (moves intensity)",
            href: "/dashboard/data#electricity_kwh",
          },
          {
            label: "Raise renewable share",
            href: "/dashboard/data#electricity_renewable_pct",
          },
          { label: "Request supplier primary data", href: "/dashboard/suppliers" },
        ]
      : rank !== null && rank <= 50
        ? [
            {
              label: "Close remaining Data gaps",
              href: "/dashboard/data",
            },
            {
              label: "Confirm renewable share is measured",
              href: "/dashboard/data#electricity_renewable_pct",
            },
            { label: "Publish living report", href: "/dashboard/reports" },
          ]
        : [
            { label: "Review material topics", href: "/dashboard/materiality" },
            { label: "Publish living report", href: "/dashboard/reports" },
          ];

  return NextResponse.json({
    available: true,
    sector: row.sector,
    sizeBand: row.sizeBand,
    metricKey: row.metricKey,
    period: row.period,
    p25: row.p25,
    p50: row.p50,
    p75: row.p75,
    cohortSize: row.cohortSize,
    computedAt: row.computedAt ? String(row.computedAt) : null,
    userValue,
    percentileRank: rank,
    benchmarkOptOut: Boolean(ctx.activeOrg.benchmarkOptOut),
    improve,
  });
}
