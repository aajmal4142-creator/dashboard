// Existing assurance system exports (Phase 4)
export {
  buildFigureLineage,
  resolvePinnedFactor,
  evidenceLinkState,
  type EvidenceLinkState,
  type LineageEvidence,
  type PinnedFactor,
  type FigureLineage,
} from "./lineage";
export {
  evidenceFreshness,
  type FreshnessState,
  type FreshnessResult,
} from "./freshness";
export {
  loadAssurancePayload,
  type AssurancePayload,
} from "./loadAssurance";

// New assurance verification system (Days 26-35)
export { AssuranceScorer } from "./assuranceScorer";
export { DataGapDetector, type EmissionsData } from "./dataGapDetector";
export {
  FindingsSeverityScorer,
  type PartialFinding,
} from "./severityScorer";
export type {
  DataGap,
  VerificationFinding,
  AssuranceEngagement,
  FindingsSummary,
  AssuranceReport,
  SeverityLevel,
  ConfidenceReport,
  ScoringContext,
  FindingSeverity,
  FindingCategory,
  FindingStatus,
  AssuranceLevel,
  EngagementStatus,
} from "./types";
