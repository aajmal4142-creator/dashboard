import type { Payload } from "payload";
import { MIN_COHORT_SIZE, percentileRank, syntheticCohortSample } from "@/lib/benchmarks";
import { findMatchingPeerGroup, loadOrgMetricValue } from "@/lib/benchmarks/lookup";
import { mayPublishBenchmarkCohorts } from "@/lib/launch/gates";

export interface PeerBenchmark {
  metricKey: string;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  mean?: number;
  best?: number;
  cohortSize: number;
  yourValue?: number;
  percentileRank?: number;
}

export interface BenchmarkComparison {
  metric: string;
  industry: string;
  sizeBand: string;
  yourValue: number;
  peers: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  percentile: number;
  status: "best_in_class" | "above_median" | "at_median" | "below_median";
}

/**
 * Calculate anonymized peer benchmarks for an organization.
 * Honours launch consent gate and cohort minimum.
 */
export async function calculatePeerBenchmarks(
  payload: Payload,
  orgId: string,
  metricKey: string,
): Promise<PeerBenchmark | null> {
  if (!mayPublishBenchmarkCohorts()) return null;

  const org = await payload.findByID({
    collection: "organisations",
    id: orgId,
    overrideAccess: true,
  });

  if (!org) return null;

  const match = await findMatchingPeerGroup(
    payload,
    {
      sector: org.sector,
      revenueBand: org.revenueBand,
      country: org.country,
    },
    { metricKey },
  );

  if (!match || match.row.cohortSize < MIN_COHORT_SIZE) return null;

  const row = match.row;
  const p10 = row.p10 ?? Math.round(row.p25 * 0.7 * 100) / 100;
  const p90 = row.p90 ?? Math.round(row.p75 * 1.3 * 100) / 100;
  const mean = row.mean ?? row.p50;
  const best = row.best ?? p10;

  const userValue = await loadOrgMetricValue(payload, orgId, metricKey);
  const sample = syntheticCohortSample({
    p10,
    p25: row.p25,
    p50: row.p50,
    p75: row.p75,
    p90,
  });
  const rank = userValue !== null ? percentileRank(sample, userValue) : undefined;

  return {
    metricKey,
    p10,
    p25: row.p25,
    p50: row.p50,
    p75: row.p75,
    p90,
    mean,
    best,
    cohortSize: row.cohortSize,
    yourValue: userValue ?? undefined,
    percentileRank: rank,
  };
}

/**
 * @deprecated Peer org lists are never returned — privacy. Use peer-group / comparison APIs.
 * Always returns []. Kept so callers do not accidentally show synthetic company labels.
 */
export async function getAnonymizedPeers(
  _payload: Payload,
  _orgId: string,
  _limit = 10,
): Promise<[]> {
  return [];
}

/**
 * Determine benchmark status based on percentile rank
 */
export function getBenchmarkStatus(
  percentile: number | undefined,
): BenchmarkComparison["status"] {
  if (percentile === undefined) return "at_median";
  if (percentile >= 90) return "best_in_class";
  if (percentile >= 65) return "above_median";
  if (percentile >= 35) return "at_median";
  return "below_median";
}

/**
 * Generate actionable insights based on benchmark position
 */
export function getBenchmarkInsights(status: BenchmarkComparison["status"]): string[] {
  const insights: Record<BenchmarkComparison["status"], string[]> = {
    best_in_class: [
      "Your organization is performing better than 90% of peers",
      "Consider publishing your best practices for industry recognition",
      "Focus on maintaining competitive advantage through continued innovation",
    ],
    above_median: [
      "Your organization is in the top quartile - well above median",
      "Share your decarbonization strategy with industry peers",
      "Target the top 10% by investing in high-impact levers",
    ],
    at_median: [
      "Your organization is performing at industry median",
      "Identify lagging metrics where improvement is possible",
      "Benchmark against best-in-class organizations in similar sectors",
    ],
    below_median: [
      "Opportunity to improve emissions intensity vs. peers",
      "Prioritize high-ROI decarbonization levers",
      "Request peer best practices from industry associations",
    ],
  };

  return insights[status];
}
