export {
  computeCohortStats,
  MIN_COHORT_SIZE,
  COHORT_GATE_NOTE,
  percentile,
  percentileRank,
  syntheticCohortSample,
  assertNoPeerIdentities,
} from "./stats";
export type { CohortStats } from "./stats";

export {
  resolveSector,
  resolveSizeBand,
  resolveGeography,
  currentPeriodLabel,
  previousPeriodLabel,
  peerGroupMatchOrder,
  peerGroupKey,
} from "./peerGroup";
export type { PeerGroupDimensions } from "./peerGroup";

export { buildGapCallout, youVsMedianVsBest, trendVsPeers, metricLabel } from "./gaps";
export type { GapCallout, PeerReferenceStats } from "./gaps";

export {
  findMatchingPeerGroup,
  loadOrgMetricValue,
  buildComparison,
  listIndustryAverages,
  listLeaders,
  orgPeerDims,
} from "./lookup";
export type { BenchmarkStatRow, MatchedPeerGroup, ComparisonPayload } from "./lookup";
