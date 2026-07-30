/**
 * Payload-backed peer benchmark lookup.
 * Auto-matches org → peer group; returns anonymised aggregates only.
 */
import type { Payload, Where } from "payload";

import {
  COHORT_GATE_NOTE,
  MIN_COHORT_SIZE,
  percentileRank,
  syntheticCohortSample,
} from "./stats";
import {
  currentPeriodLabel,
  peerGroupMatchOrder,
  previousPeriodLabel,
  resolveGeography,
  resolveSector,
  resolveSizeBand,
} from "./peerGroup";
import type { PeerGroupDimensions } from "./peerGroup";
import { buildGapCallout, trendVsPeers, youVsMedianVsBest } from "./gaps";
import type { GapCallout } from "./gaps";
import { mayPublishBenchmarkCohorts } from "@/lib/launch/gates";

export type BenchmarkStatRow = {
  id: string;
  sector: string;
  sizeBand: string;
  geography?: string | null;
  metricKey: string;
  period: string;
  p10?: number | null;
  p25: number;
  p50: number;
  p75: number;
  p90?: number | null;
  mean?: number | null;
  best?: number | null;
  cohortSize: number;
  computedAt?: string | null;
};

export type MatchedPeerGroup = {
  matched: PeerGroupDimensions;
  row: BenchmarkStatRow;
  matchTier: "exact" | "size" | "sector";
};

function matchTier(dims: PeerGroupDimensions): MatchedPeerGroup["matchTier"] {
  if (dims.sizeBand !== "all" && dims.geography !== "all") return "exact";
  if (dims.sizeBand !== "all" || dims.geography !== "all") return "size";
  return "sector";
}

function asRow(doc: {
  id: string | number;
  sector: string;
  sizeBand: string;
  geography?: string | null;
  metricKey: string;
  period: string;
  p10?: number | null;
  p25: number;
  p50: number;
  p75: number;
  p90?: number | null;
  mean?: number | null;
  best?: number | null;
  cohortSize: number;
  computedAt?: string | null | Date;
}): BenchmarkStatRow {
  return {
    id: String(doc.id),
    sector: doc.sector,
    sizeBand: doc.sizeBand,
    geography: doc.geography ?? "all",
    metricKey: doc.metricKey,
    period: doc.period,
    p10: doc.p10 ?? null,
    p25: doc.p25,
    p50: doc.p50,
    p75: doc.p75,
    p90: doc.p90 ?? null,
    mean: doc.mean ?? null,
    best: doc.best ?? doc.p10 ?? null,
    cohortSize: doc.cohortSize,
    computedAt: doc.computedAt ? String(doc.computedAt) : null,
  };
}

function resolvedStats(row: BenchmarkStatRow) {
  const p10 = row.p10 ?? Math.round(row.p25 * 0.7 * 100) / 100;
  const p90 = row.p90 ?? Math.round(row.p75 * 1.3 * 100) / 100;
  const mean = row.mean ?? row.p50;
  const best = row.best ?? p10;
  return { p10, p25: row.p25, p50: row.p50, p75: row.p75, p90, mean, best };
}

export async function findMatchingPeerGroup(
  payload: Payload,
  org: {
    sector?: string | null;
    revenueBand?: string | null;
    country?: string | null;
  },
  opts: { metricKey: string; period?: string },
): Promise<MatchedPeerGroup | null> {
  const period = opts.period ?? currentPeriodLabel();
  const order = peerGroupMatchOrder({
    sector: org.sector,
    sizeBand: org.revenueBand,
    geography: org.country,
    period,
    metricKey: opts.metricKey,
  });

  for (const dims of order) {
    const stats = await payload.find({
      collection: "benchmark-stats",
      where: {
        and: [
          { metricKey: { equals: dims.metricKey } },
          { sector: { equals: dims.sector } },
          { sizeBand: { equals: dims.sizeBand } },
          { geography: { equals: dims.geography } },
          { period: { equals: dims.period } },
          { cohortSize: { greater_than_equal: MIN_COHORT_SIZE } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    });
    const doc = stats.docs[0];
    if (doc && doc.cohortSize >= MIN_COHORT_SIZE) {
      return { matched: dims, row: asRow(doc), matchTier: matchTier(dims) };
    }
  }

  // Legacy rows without geography / with sizeBand "all" only — sector+metric fallback
  const sector = resolveSector(org.sector);
  const legacy = await payload.find({
    collection: "benchmark-stats",
    where: {
      and: [
        { metricKey: { equals: opts.metricKey } },
        { sector: { equals: sector } },
        { cohortSize: { greater_than_equal: MIN_COHORT_SIZE } },
      ],
    },
    limit: 1,
    sort: "-computedAt",
    overrideAccess: true,
  });
  const doc = legacy.docs[0];
  if (!doc || doc.cohortSize < MIN_COHORT_SIZE) return null;
  const row = asRow(doc);
  return {
    matched: {
      sector: row.sector,
      sizeBand: row.sizeBand,
      geography: row.geography ?? "all",
      period: row.period,
      metricKey: row.metricKey,
    },
    row,
    matchTier: "sector",
  };
}

export async function loadOrgMetricValue(
  payload: Payload,
  orgId: string,
  metricKey: string,
): Promise<number | null> {
  const periods = await payload.find({
    collection: "reporting-periods",
    where: {
      and: [{ organisation: { equals: orgId } }, { status: { equals: "open" } }],
    },
    limit: 1,
    overrideAccess: true,
  });
  if (!periods.docs[0]) return null;
  const dp = await payload.find({
    collection: "datapoints",
    where: {
      and: [
        { organisation: { equals: orgId } },
        { period: { equals: periods.docs[0].id } },
        { metricKey: { equals: metricKey } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });
  const v = dp.docs[0]?.value;
  return typeof v === "number" ? v : null;
}

export type ComparisonPayload = {
  available: true;
  cohortGate: string;
  minCohortSize: number;
  peerGroup: PeerGroupDimensions & { matchTier: string; cohortSize: number };
  stats: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    mean: number;
    best: number;
    median: number;
  };
  comparison: ReturnType<typeof youVsMedianVsBest>;
  percentileRank: number | null;
  gaps: GapCallout[];
  trend: ReturnType<typeof trendVsPeers>;
  computedAt: string | null;
  benchmarkOptOut: boolean;
};

export async function buildComparison(
  payload: Payload,
  org: {
    id: string;
    sector?: string | null;
    revenueBand?: string | null;
    country?: string | null;
    benchmarkOptOut?: boolean | null;
  },
  metricKey: string,
): Promise<
  | ComparisonPayload
  | {
      available: false;
      reason: string;
      message: string;
      minCohortSize: number;
      cohortGate: string;
      benchmarkOptOut: boolean;
    }
> {
  const optOut = Boolean(org.benchmarkOptOut);
  if (!mayPublishBenchmarkCohorts()) {
    return {
      available: false,
      reason: "cohorts_not_published",
      message:
        "Sector cohorts are not published yet (benchmark consent unsigned — LAUNCH_DECISIONS #5).",
      minCohortSize: MIN_COHORT_SIZE,
      cohortGate: COHORT_GATE_NOTE,
      benchmarkOptOut: optOut,
    };
  }

  const match = await findMatchingPeerGroup(payload, org, { metricKey });
  if (!match) {
    return {
      available: false,
      reason: "not_enough_peers",
      message: `Not enough peers yet. Need at least ${MIN_COHORT_SIZE} organisations in a matching cohort.`,
      minCohortSize: MIN_COHORT_SIZE,
      cohortGate: COHORT_GATE_NOTE,
      benchmarkOptOut: optOut,
    };
  }

  const resolved = resolvedStats(match.row);
  const yourValue = await loadOrgMetricValue(payload, org.id, metricKey);
  const sample = syntheticCohortSample(resolved);
  const rank = yourValue === null ? null : percentileRank(sample, yourValue);

  const prevPeriod = previousPeriodLabel();
  const prevMatch = await findMatchingPeerGroup(payload, org, {
    metricKey,
    period: prevPeriod,
  });
  let previousRank: number | null = null;
  if (prevMatch && yourValue !== null) {
    const prevResolved = resolvedStats(prevMatch.row);
    previousRank = percentileRank(syntheticCohortSample(prevResolved), yourValue);
  }

  const peers = {
    median: resolved.p50,
    mean: resolved.mean,
    best: resolved.best,
    p25: resolved.p25,
    p75: resolved.p75,
  };

  const gaps: GapCallout[] = [];
  if (yourValue !== null) {
    gaps.push(buildGapCallout(metricKey, yourValue, peers));
  }

  return {
    available: true,
    cohortGate: COHORT_GATE_NOTE,
    minCohortSize: MIN_COHORT_SIZE,
    peerGroup: {
      ...match.matched,
      matchTier: match.matchTier,
      cohortSize: match.row.cohortSize,
    },
    stats: {
      ...resolved,
      median: resolved.p50,
    },
    comparison: youVsMedianVsBest(yourValue, peers),
    percentileRank: rank,
    gaps,
    trend: trendVsPeers(rank, previousRank),
    computedAt: match.row.computedAt ?? null,
    benchmarkOptOut: optOut,
  };
}

export async function listIndustryAverages(
  payload: Payload,
  opts: { sector?: string; period?: string; limit?: number },
): Promise<
  Array<{
    sector: string;
    sizeBand: string;
    geography: string;
    metricKey: string;
    period: string;
    mean: number;
    median: number;
    best: number;
    cohortSize: number;
  }>
> {
  if (!mayPublishBenchmarkCohorts()) return [];
  const and: Where[] = [{ cohortSize: { greater_than_equal: MIN_COHORT_SIZE } }];
  if (opts.sector) and.push({ sector: { equals: resolveSector(opts.sector) } });
  if (opts.period) and.push({ period: { equals: opts.period } });

  const rows = await payload.find({
    collection: "benchmark-stats",
    where: { and },
    limit: opts.limit ?? 50,
    sort: "-computedAt",
    overrideAccess: true,
  });

  return rows.docs
    .filter((d) => d.cohortSize >= MIN_COHORT_SIZE)
    .map((d) => {
      const row = asRow(d);
      const r = resolvedStats(row);
      return {
        sector: row.sector,
        sizeBand: row.sizeBand,
        geography: row.geography ?? "all",
        metricKey: row.metricKey,
        period: row.period,
        mean: r.mean,
        median: r.p50,
        best: r.best,
        cohortSize: row.cohortSize,
      };
    });
}

export async function listLeaders(
  payload: Payload,
  opts: { metricKey?: string; sector?: string; period?: string; limit?: number },
): Promise<
  Array<{
    sector: string;
    sizeBand: string;
    geography: string;
    metricKey: string;
    period: string;
    best: number;
    median: number;
    cohortSize: number;
  }>
> {
  if (!mayPublishBenchmarkCohorts()) return [];
  const and: Where[] = [{ cohortSize: { greater_than_equal: MIN_COHORT_SIZE } }];
  if (opts.metricKey) and.push({ metricKey: { equals: opts.metricKey } });
  if (opts.sector) and.push({ sector: { equals: resolveSector(opts.sector) } });
  if (opts.period) and.push({ period: { equals: opts.period } });

  const rows = await payload.find({
    collection: "benchmark-stats",
    where: { and },
    limit: opts.limit ?? 20,
    sort: "best",
    overrideAccess: true,
  });

  return rows.docs
    .filter((d) => d.cohortSize >= MIN_COHORT_SIZE)
    .map((d) => {
      const row = asRow(d);
      const r = resolvedStats(row);
      return {
        sector: row.sector,
        sizeBand: row.sizeBand,
        geography: row.geography ?? "all",
        metricKey: row.metricKey,
        period: row.period,
        best: r.best,
        median: r.p50,
        cohortSize: row.cohortSize,
      };
    });
}

export function orgPeerDims(org: {
  sector?: string | null;
  revenueBand?: string | null;
  country?: string | null;
}): {
  sector: string;
  sizeBand: string;
  geography: string;
} {
  return {
    sector: resolveSector(org.sector),
    sizeBand: resolveSizeBand(org.revenueBand),
    geography: resolveGeography(org.country),
  };
}
