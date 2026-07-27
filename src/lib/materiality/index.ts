export { ESRS_TOPICS, MATERIALITY_THRESHOLD, type EsrsTopic } from "./topics";
export {
  buildMatrixSnapshot,
  financialScoreOf,
  impactScoreOf,
  isMaterial,
  materialityNarrative,
  type FinancialInputs,
  type ImpactInputs,
  type MatrixPoint,
} from "./score";
export {
  naceLetter,
  SECTOR_DEFAULTS_DISCLAIMER,
  sectorDefaults,
  topicOriginAgainstDefault,
  type TopicOrigin,
  type TopicStartingScores,
} from "./sectorDefaults";
