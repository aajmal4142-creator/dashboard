export type { ReportSnapshot, ScopeBreakdownRow } from "./types";
export { REPORT_DISCLAIMER, diffSnapshots, snapshotToCsv } from "./types";
export {
  CONFIRMED_APPROVAL_STATE,
  ESG_XML_NS,
  MACHINE_EXPORT_FIELDS,
  MACHINE_EXPORT_SCHEMA,
  buildMachineExportDocument,
  mapConfirmedDatapoints,
  parseMachineExportFormat,
  snapshotToJsonExport,
  snapshotToXmlExport,
  type MachineExportContext,
  type MachineExportDatapointInput,
  type MachineExportDatapointRow,
  type MachineExportDocument,
  type MachineExportFormat,
} from "./machineExport";
export type { ReportDataGap } from "./dataGaps";
export { detectReportDataGaps } from "./dataGaps";
export {
  buildComplianceDeclaration,
  buildEsrsDisclosures,
  type EsrsDisclosures,
  type EsrsTopicDisclosure,
} from "./esrsNarrative";
export { buildReportSnapshot, asUserId } from "./buildSnapshot";
export {
  buildReportForecastSection,
  type ReportForecastSection,
  type ReportForecastScenarioRow,
} from "./forecastSection";
export {
  computeNextRunAt,
  computeRetryAt,
  computeRetryDelayMs,
  createReportSchedule,
  deleteReportSchedule,
  executeDueScheduledReports,
  generateReportAttachment,
  listReportSchedules,
  MAX_SCHEDULE_RETRIES,
  updateReportSchedule,
  type CreateScheduleInput,
  type ReportDeliveryFormat,
  type ScheduleDeliveryStatus,
  type ScheduleFrequency,
  type ScheduledReportRow,
} from "./reportScheduler";
export {
  buildScheduledReportEmailBody,
  buildScheduledReportSubject,
  sendScheduledReportEmail,
} from "./scheduledReportEmail";
export {
  SHARE_TOKEN_TTL_DAYS,
  SHARE_TOKEN_TTL_MIN_DAYS,
  SHARE_TOKEN_TTL_MAX_DAYS,
  applyLegendVisibility,
  buildDetailTableRows,
  buildEmbedCode,
  buildEmissionsChartRows,
  buildExecutiveHighlights,
  buildHtmlReportMeta,
  buildShareUrls,
  clampShareTtlDays,
  classifyEmbedTokenStatus,
  computeShareExpiry,
  filterDetailRows,
  filterEmissionsByScope,
  isShareTokenExpired,
  nextSortDirection,
  sortDetailRows,
  type DetailTableRow,
  type EmissionsChartRow,
  type HtmlReportMeta,
  type ScopeFilter,
  type SortDirection,
} from "./htmlReport";
export {
  listReportEmbedTokens,
  mintReportShareLink,
  resolveReportShareToken,
  revokeReportEmbedToken,
  type EmbedTokenListItem,
  type MintShareLinkResult,
  type ResolveShareTokenResult,
} from "./htmlReportShare";
export {
  assembleMultiFrameworkReport,
  buildMultiFrameworkReport,
  FRAMEWORK_LABELS,
  FRAMEWORK_SECTION_COLORS,
  MULTI_FRAMEWORK_DISCLAIMER,
  MultiFrameworkPdfDocument,
  resolveMultiFrameworkPeriod,
  selectCompleteFrameworks,
  type MultiFrameworkId,
  type MultiFrameworkReport,
} from "./multiFramework";
