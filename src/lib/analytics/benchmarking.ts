import type { Payload } from "payload";
import { MIN_COHORT_SIZE, percentileRank } from "@/lib/benchmarks";

export interface PeerBenchmark {
  metricKey: string;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
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
 * Calculate anonymized peer benchmarks for an organization
 */
export async function calculatePeerBenchmarks(
  payload: Payload,
  orgId: string,
  metricKey: string,
): Promise<PeerBenchmark | null> {
  const org = await payload.findByID({
    collection: "organisations",
    id: orgId,
    overrideAccess: true,
  });

  if (!org) return null;

  const sectorPrefix = org.sector?.trim().charAt(0).toUpperCase() || "C";

  // Get benchmark stats from database
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

  if (!stats.docs[0] || stats.docs[0].cohortSize < MIN_COHORT_SIZE) {
    return null;
  }

  const row = stats.docs[0];

  // Get org's current value
  const periods = await payload.find({
    collection: "reporting-periods",
    where: {
      and: [{ organisation: { equals: orgId } }, { status: { equals: "open" } }],
    },
    limit: 1,
    overrideAccess: true,
  });

  let userValue: number | undefined;
  if (periods.docs[0]) {
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
    userValue = typeof v === "number" ? v : undefined;
  }

  // Compute p90 and p10 from distribution
  const p10 = row.p25 * 0.7; // Approximate
  const p90 = row.p75 * 1.3; // Approximate

  const synthetic = [p10, row.p25, row.p50, row.p75, p90].sort((a, b) => a - b);
  const rank = userValue !== undefined ? percentileRank(synthetic, userValue) : undefined;

  return {
    metricKey,
    p10,
    p25: row.p25,
    p50: row.p50,
    p75: row.p75,
    p90,
    cohortSize: row.cohortSize,
    yourValue: userValue,
    percentileRank: rank,
  };
}

/**
 * Get anonymized peer list for an org
 */
export async function getAnonymizedPeers(
  payload: Payload,
  orgId: string,
  limit = 10,
): Promise<
  Array<{
    id: string;
    name: string;
    industry: string;
    size: string;
  }>
> {
  const org = await payload.findByID({
    collection: "organisations",
    id: orgId,
    overrideAccess: true,
  });

  if (!org) return [];

  // Get similar orgs by industry and size
  const peers = await payload.find({
    collection: "organisations",
    where: {
      and: [
        { sector: { equals: org.sector } },
        { id: { not_equals: orgId } },
        { benchmarkOptOut: { not_equals: true } },
      ],
    },
    limit: limit + 5, // Get extra in case some are opted out
    overrideAccess: true,
  });

  // Anonymize: return Company A, Company B, etc.
  const companies = [
    "Alpha",
    "Beta",
    "Gamma",
    "Delta",
    "Epsilon",
    "Zeta",
    "Eta",
    "Theta",
  ];

  return peers.docs.slice(0, limit).map((peer, idx) => ({
    id: peer.id as string,
    name: `Company ${companies[idx] || String.fromCharCode(65 + idx)}`,
    industry: peer.sector as string,
    size: peer.revenueBand || "Unknown",
  }));
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
