/**
 * Email inbound CSV import — pure helpers + webhook/service layer.
 * Reuses parseCsvToImportRows / dryRunImport from lib/data.
 */

export {
  normalizeEmailAddress,
  extractEmailAddress,
  isSenderWhitelisted,
} from "./whitelist";

export { verifyResendWebhook, type VerifyWebhookResult } from "./verifyWebhook";

export {
  extractInboundToken,
  pickCsvAttachment,
  normalizeInboundMessage,
  type InboundAttachment,
  type NormalizedInboundMessage,
} from "./parseInbound";

export { validateInboundCsv, type ValidateInboundCsvResult } from "./processCsv";

export {
  buildImportReply,
  type ImportReplyKind,
  type ImportReplyContent,
} from "./replies";

export {
  processInboundEmailImport,
  generateInboundToken,
  type ProcessInboundResult,
  type ProcessInboundInput,
} from "./service";

export {
  getInboundEmailDomain,
  buildInboundAddress,
  buildSubjectTokenHint,
} from "./inboundAddress";
