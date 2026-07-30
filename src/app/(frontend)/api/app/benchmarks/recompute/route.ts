import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  computeCohortStats,
  currentPeriodLabel,
  MIN_COHORT_SIZE,
  resolveGeography,
  resolveSector,
  resolveSizeBand,
} from "@/lib/benchmarks";
import {
  isProductionRuntime,
  mayPublishBenchmarkCohorts,
  maySeedBenchmarkDemo,
} from "@/lib/launch/gates";
import config from "@/payload.config";

type BucketKey = string;

function bucketKey(sector: string, sizeBand: string, geography: string): BucketKey {
  return `${sector}|${sizeBand}|${geography}`;
}

async function recompute() {
  if (!mayPublishBenchmarkCohorts() && !maySeedBenchmarkDemo()) {
    return {
      ok: true as const,
      written: 0,
      skippedBelowMin: 0,
      deletedStale: 0,
      minCohortSize: MIN_COHORT_SIZE,
      gated: true as const,
      reason:
        "Live cohorts gated until CLEARESG_BENCHMARKS_LIVE=1 (LAUNCH_DECISIONS #5). Demo seed requires CLEARESG_BENCHMARK_DEMO=1.",
    };
  }

  const payload = await getPayload({ config });
  const orgs = await payload.find({
    collection: "organisations",
    where: { benchmarkOptOut: { not_equals: true } },
    limit: 500,
    overrideAccess: true,
  });

  const metricKey = "electricity_kwh";
  /** Exact buckets + rolled-up (size=all / geo=all) so auto-match can widen. */
  const buckets = new Map<BucketKey, number[]>();

  const push = (sector: string, sizeBand: string, geography: string, value: number) => {
    const keys = [
      bucketKey(sector, sizeBand, geography),
      bucketKey(sector, sizeBand, "all"),
      bucketKey(sector, "all", geography),
      bucketKey(sector, "all", "all"),
    ];
    const unique = [...new Set(keys)];
    for (const k of unique) {
      const list = buckets.get(k) ?? [];
      list.push(value);
      buckets.set(k, list);
    }
  };

  for (const org of orgs.docs) {
    const sector = resolveSector(org.sector);
    const sizeBand = resolveSizeBand(org.revenueBand);
    const geography = resolveGeography(org.country);
    const periods = await payload.find({
      collection: "reporting-periods",
      where: { organisation: { equals: org.id } },
      limit: 1,
      sort: "-endDate",
      overrideAccess: true,
    });
    if (!periods.docs[0]) continue;
    const dp = await payload.find({
      collection: "datapoints",
      where: {
        and: [
          { organisation: { equals: org.id } },
          { period: { equals: periods.docs[0].id } },
          { metricKey: { equals: metricKey } },
          { value: { exists: true } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    });
    const v = dp.docs[0]?.value;
    if (typeof v !== "number") continue;
    push(sector, sizeBand, geography, v);
  }

  let written = 0;
  let skipped = 0;
  let deletedStale = 0;
  const periodLabel = currentPeriodLabel();
  const computedAt = new Date().toISOString();
  const liveKeys = new Set<string>();

  if (mayPublishBenchmarkCohorts()) {
    for (const [key, values] of buckets) {
      const stats = computeCohortStats(values);
      if (!stats) {
        skipped += 1;
        continue;
      }
      const [sector, sizeBand, geography] = key.split("|") as [string, string, string];
      liveKeys.add(`${sector}|${sizeBand}|${geography}|${metricKey}|${periodLabel}`);

      const existing = await payload.find({
        collection: "benchmark-stats",
        where: {
          and: [
            { sector: { equals: sector } },
            { sizeBand: { equals: sizeBand } },
            { geography: { equals: geography } },
            { metricKey: { equals: metricKey } },
            { period: { equals: periodLabel } },
          ],
        },
        limit: 1,
        overrideAccess: true,
      });

      const data = {
        sector,
        sizeBand,
        geography,
        metricKey,
        period: periodLabel,
        p10: stats.p10,
        p25: stats.p25,
        p50: stats.p50,
        p75: stats.p75,
        p90: stats.p90,
        mean: stats.mean,
        best: stats.best,
        cohortSize: stats.cohortSize,
        computedAt,
      };

      if (existing.docs[0]) {
        await payload.update({
          collection: "benchmark-stats",
          id: existing.docs[0].id,
          data,
          overrideAccess: true,
        });
      } else {
        await payload.create({
          collection: "benchmark-stats",
          data,
          overrideAccess: true,
        });
      }
      written += 1;
    }

    const existingRows = await payload.find({
      collection: "benchmark-stats",
      where: {
        and: [{ metricKey: { equals: metricKey } }, { period: { equals: periodLabel } }],
      },
      limit: 500,
      overrideAccess: true,
    });
    for (const row of existingRows.docs) {
      const geo = row.geography ?? "all";
      const k = `${row.sector}|${row.sizeBand}|${geo}|${row.metricKey}|${row.period}`;
      if (!liveKeys.has(k) || row.cohortSize < MIN_COHORT_SIZE) {
        await payload.delete({
          collection: "benchmark-stats",
          id: row.id,
          overrideAccess: true,
        });
        deletedStale += 1;
      }
    }
  }

  if (written === 0 && maySeedBenchmarkDemo()) {
    const demoValues = [
      80_000, 95_000, 110_000, 120_000, 130_000, 150_000, 180_000, 220_000,
    ];
    const stats = computeCohortStats(demoValues)!;
    await payload.create({
      collection: "benchmark-stats",
      data: {
        sector: "C",
        sizeBand: "all",
        geography: "all",
        metricKey,
        period: periodLabel,
        p10: stats.p10,
        p25: stats.p25,
        p50: stats.p50,
        p75: stats.p75,
        p90: stats.p90,
        mean: stats.mean,
        best: stats.best,
        cohortSize: Math.max(stats.cohortSize, MIN_COHORT_SIZE),
        computedAt,
      },
      overrideAccess: true,
    });
    written = 1;
  }

  return {
    ok: true as const,
    written,
    skippedBelowMin: skipped,
    deletedStale,
    minCohortSize: MIN_COHORT_SIZE,
    computedAt,
    gated: !mayPublishBenchmarkCohorts(),
  };
}

/**
 * Recompute benchmark-stats. Never writes n < 8. Deletes stale rows.
 * Live publication gated by CLEARESG_BENCHMARKS_LIVE.
 * Opted-out orgs excluded from contribution.
 */
export async function POST(req: Request) {
  const isCron = req.headers.get("x-clearesg-cron") === "1";
  if (!isCron) {
    const ctx = await getCurrentContext();
    if (!ctx.activeOrg || (ctx.role !== "owner" && ctx.role !== "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (isProductionRuntime() && !process.env.CRON_SECRET?.trim()) {
    return NextResponse.json(
      { error: "CRON_SECRET required in production" },
      { status: 503 },
    );
  }

  const result = await recompute();
  return NextResponse.json(result);
}
