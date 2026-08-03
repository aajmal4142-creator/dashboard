export type {
  SocialCoverageResult,
  SocialDatapointInput,
  SocialDisclosureState,
  SocialGapKind,
  SocialIndicatorDef,
  SocialIndicatorStatus,
  SocialSection,
  SocialSectionId,
  SocialSectionSummary,
  SocialSourceKind,
  SocialSummary,
} from "./types";

export type { SocialMappedMetricKey } from "./catalog";

export {
  SOCIAL_INDICATORS,
  SOCIAL_MAPPED_METRIC_KEYS,
  SOCIAL_SECTIONS,
  socialCatalogMetricKeys,
  socialIndicatorByCode,
  socialSectionById,
} from "./catalog";

export { computeSocialCoverage } from "./coverage";
