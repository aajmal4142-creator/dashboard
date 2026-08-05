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
export { loadAssurancePayload, type AssurancePayload } from "./loadAssurance";

export {
  EVIDENCE_PACK_KIND,
  buildEvidencePackManifest,
  evidencePackToCsv,
  evidencePackBasename,
  pathwayChecklistToCsv,
  type EvidencePackManifest,
  type BuildEvidencePackManifestInput,
  type EvidencePackEmissions,
  type EvidencePackFactor,
  type EvidencePackGap,
  type EvidencePackEvidenceLink,
  type EvidencePackLineagePointer,
  type EvidencePackLockSummary,
} from "./evidencePack";
export { buildStoreZip, crc32 } from "./zipStore";

// New assurance verification system (Days 26-35)
export { AssuranceScorer } from "./assuranceScorer";
export { DataGapDetector, type EmissionsData } from "./dataGapDetector";
export { FindingsSeverityScorer, type PartialFinding } from "./severityScorer";
export type {
  DataGap,
  VerificationFinding,
  AssuranceEngagement,
  PathwayCheckpointProgress,
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
export {
  ASSURANCE_EVIDENCE_TYPES,
  ASSURANCE_PATHWAYS,
  calculatePathwayCoverage,
  coverageForPathway,
  getPathway,
  isAssuranceEvidenceType,
  isAssuranceLevel,
  listPathways,
  type AssuranceEvidenceType,
  type AssurancePathwayDefinition,
  type PathwayCheckpoint,
  type PathwayCoverage,
  type PathwayCoverageInput,
} from "./pathways";
export { buildOpinionLetterDraft, type OpinionLetterInput } from "./opinionLetter";
