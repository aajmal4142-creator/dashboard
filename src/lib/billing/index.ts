export { assertCan, BillingDeniedError, billingDeniedResponse, can, limits } from "./can";
export {
  isPlanFrozen,
  resolveEffectivePlan,
  type SubscriptionStatus,
} from "./effectivePlan";
export {
  isPlanId,
  normalizePlan,
  PLAN_LIMITS,
  planFromStripePriceId,
  stripePriceIdForPlan,
  type Entitlement,
  type PlanId,
  type PlanLimits,
} from "./plans";
export { getStripe, stripeConfigured, appOrigin } from "./stripe";
export { getUsageMeters, type UsageMeters } from "./usage";

// Days 36-45 Billing Expansion
export * from "./types";
export { createUsageTracker, UsageTracker } from "./usageTracker";
export { createQuotaEnforcer, QuotaEnforcer } from "./quotaEnforcer";
export { createInvoiceGenerator, InvoiceGenerator } from "./invoiceGenerator";
export { createStripeService, StripeService } from "./stripeService";
export { createProrataCalculator, ProrataCalculator } from "./prorataCalculator";
export { createRenewalScheduler, RenewalScheduler } from "./renewalScheduler";
export { createEmailService, EmailService } from "./emailService";

// Sprint 8 Billing Features
export {
  checkDatapointQuota,
  checkReportQuota,
  checkApiQuota,
  shouldSendLimitWarning,
  incrementDatapointUsage,
  incrementReportUsage,
  incrementApiUsage,
  type QuotaCheckResult,
} from "./freeTierGates";
export {
  calculateOverageCharges,
  getRealTimeOverageProjection,
  type OverageCharges,
} from "./overageCalculator";
export {
  getApplicableDiscount,
  calculateDiscountedPrice,
  applyVolumeDiscountToSubscription,
  formatDiscountTierDisplay,
  type VolumeTier,
} from "./volumeDiscountCalculator";
export {
  createDunningCampaign,
  scheduleRetryAttempt,
  executeRetryAttempt,
  processDueDunningRetries,
  suspendSubscriptionDueToDunning,
  cancelSubscriptionDueToDunning,
  generateManualPaymentLink,
} from "./dunningService";
