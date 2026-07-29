import { getPayload } from "payload";
import config from "@/payload.config";

export type QuotaCheckResult = {
  withinQuota: boolean;
  percentageUsed: number;
  remaining: number;
  limit: number;
};

async function findFreeTierAccount(orgId: string) {
  const payload = await getPayload({ config });
  const freeTier = await payload.find({
    collection: "free-tier-accounts",
    where: { organisation: { equals: orgId } },
    limit: 1,
  });
  return { payload, account: freeTier.docs?.[0] ?? null };
}

export async function checkDatapointQuota(orgId: string): Promise<QuotaCheckResult> {
  const { account } = await findFreeTierAccount(orgId);

  if (!account) {
    return { withinQuota: true, percentageUsed: 0, remaining: 0, limit: 0 };
  }

  const DATAPOINT_LIMIT = 100;
  const used = account.dataPointsUsed || 0;
  const remaining = Math.max(0, DATAPOINT_LIMIT - used);
  const percentageUsed = Math.round((used / DATAPOINT_LIMIT) * 100);

  return {
    withinQuota: remaining > 0,
    percentageUsed,
    remaining,
    limit: DATAPOINT_LIMIT,
  };
}

export async function checkReportQuota(orgId: string): Promise<QuotaCheckResult> {
  const { account } = await findFreeTierAccount(orgId);

  if (!account) {
    return { withinQuota: true, percentageUsed: 0, remaining: 0, limit: 0 };
  }

  const REPORT_LIMIT = 10;
  const used = account.reportsGenerated || 0;
  const remaining = Math.max(0, REPORT_LIMIT - used);
  const percentageUsed = Math.round((used / REPORT_LIMIT) * 100);

  return {
    withinQuota: remaining > 0,
    percentageUsed,
    remaining,
    limit: REPORT_LIMIT,
  };
}

export async function checkApiQuota(orgId: string): Promise<QuotaCheckResult> {
  const { account } = await findFreeTierAccount(orgId);

  if (!account) {
    return { withinQuota: true, percentageUsed: 0, remaining: 0, limit: 0 };
  }

  const API_CALL_LIMIT = 1000;
  const used = account.apiCallsUsed || 0;
  const remaining = Math.max(0, API_CALL_LIMIT - used);
  const percentageUsed = Math.round((used / API_CALL_LIMIT) * 100);

  return {
    withinQuota: remaining > 0,
    percentageUsed,
    remaining,
    limit: API_CALL_LIMIT,
  };
}

export async function shouldSendLimitWarning(orgId: string): Promise<boolean> {
  const { payload, account } = await findFreeTierAccount(orgId);
  if (!account) return false;

  const datapointUsage = await checkDatapointQuota(orgId);
  const reportUsage = await checkReportQuota(orgId);
  const apiUsage = await checkApiQuota(orgId);

  // Send warning if any quota > 80%
  const shouldWarn =
    datapointUsage.percentageUsed >= 80 ||
    reportUsage.percentageUsed >= 80 ||
    apiUsage.percentageUsed >= 80;

  if (shouldWarn && !account.limitReachedNotificationSent) {
    // Update to mark notification as sent
    await payload.update({
      collection: "free-tier-accounts",
      id: account.id,
      data: {
        limitReachedNotificationSent: true,
      },
    });
  }

  return shouldWarn;
}

export async function incrementDatapointUsage(
  orgId: string,
  count: number = 1,
): Promise<void> {
  const { payload, account } = await findFreeTierAccount(orgId);
  if (!account) return;

  await payload.update({
    collection: "free-tier-accounts",
    id: account.id,
    data: {
      dataPointsUsed: (account.dataPointsUsed || 0) + count,
    },
    overrideAccess: true,
  });
}

export async function incrementReportUsage(
  orgId: string,
  count: number = 1,
): Promise<void> {
  const { payload, account } = await findFreeTierAccount(orgId);
  if (!account) return;

  await payload.update({
    collection: "free-tier-accounts",
    id: account.id,
    data: {
      reportsGenerated: (account.reportsGenerated || 0) + count,
    },
    overrideAccess: true,
  });
}

export async function incrementApiUsage(orgId: string, count: number = 1): Promise<void> {
  const { payload, account } = await findFreeTierAccount(orgId);
  if (!account) return;

  await payload.update({
    collection: "free-tier-accounts",
    id: account.id,
    data: {
      apiCallsUsed: (account.apiCallsUsed || 0) + count,
    },
    overrideAccess: true,
  });
}
