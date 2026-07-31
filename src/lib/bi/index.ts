export {
  generateBiApiKey,
  hashBiApiKey,
  verifyBiApiKey,
  extractBiApiKey,
} from "./apiKey";

export {
  checkBiQuota,
  checkBiRateLimit,
  getBiRateLimitHeaders,
  HOUR_MS,
  DAY_MS,
} from "./rateLimit";
export type { BiQuotaCheckResult, CheckBiQuotaInput } from "./rateLimit";

export {
  BI_PLAN_QUOTAS,
  BI_QUOTA_WARNING_PERCENT,
  buildBiQuotaHeaders,
  isIpAllowed,
  isUnlimitedQuota,
  nextUtcDayResetMs,
  nextUtcHourResetMs,
  parseAllowedIps,
  quotaPercentageUsed,
  remainingFromUsed,
  resolveBiQuotaLimits,
  shouldAlertApproachingQuota,
} from "./quota";
export type { BiKeyQuotaOverrides, BiQuotaLimits } from "./quota";

export { requireBiAuth, biJson } from "./auth";
export type { BiAuthContext } from "./auth";

export {
  parseBiPagination,
  listBiEmissions,
  listBiDatapoints,
  listBiSuppliers,
  listBiScenarios,
  getBiBenchmarks,
} from "./queries";
