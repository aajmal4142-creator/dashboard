export type {
  ApprovalAction,
  ApprovalEntityType,
  ApprovalHistoryEntry,
  ApprovalStep,
  ChainState,
  ChainStatus,
  LegacyApprovalState,
  TransitionErr,
  TransitionOk,
  TransitionResult,
} from "./types";

export { APPROVAL_ACTIONS, APPROVAL_STEPS, CHAIN_STATUSES } from "./types";

export {
  advanceTo,
  canTransition,
  hydrateFromLegacy,
  initialChainState,
  isApprovalAction,
  isApprovalStep,
  isChainStatus,
  legacyApprovalState,
  nextStep,
  previousStep,
  transition,
} from "./machine";

export {
  applyDatapointTransition,
  applyReportTransition,
  buildChainUpdateData,
  gateTransitionPermission,
  readChainState,
  serializeHistory,
  type ApprovalEntityKind,
  type ChainDocSlice,
  type TransitionInput,
} from "./apply";
