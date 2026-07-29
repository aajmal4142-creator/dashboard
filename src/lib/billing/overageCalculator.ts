import { getPayload } from "payload";
import config from "@/payload.config";

export type OverageCharges = {
  datapointOverage: number;
  reportOverage: number;
  apiCallOverage: number;
  totalOverageCost: number;
};

const DATAPOINT_OVERAGE_RATE = 0.05; // $0.05 per datapoint
const REPORT_OVERAGE_RATE = 1.0; // $1.00 per report
const API_CALL_OVERAGE_RATE = 0.001; // $0.001 per API call

export async function calculateOverageCharges(
  orgId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<OverageCharges> {
  const payload = await getPayload({ config });

  // Get subscription and plan
  const subs = await payload.find({
    collection: "subscriptions",
    where: { organisation: { equals: orgId } },
    limit: 1,
  });

  const subscription = subs.docs?.[0];
  if (!subscription) {
    return {
      datapointOverage: 0,
      reportOverage: 0,
      apiCallOverage: 0,
      totalOverageCost: 0,
    };
  }

  const planId =
    typeof subscription.plan === "object" ? subscription.plan.id : subscription.plan;
  const plan = await payload.findByID({
    collection: "plans",
    id: String(planId),
  });

  // Get usage metrics
  const usage = await payload.find({
    collection: "usage-metrics",
    where: {
      organisation: { equals: orgId },
      createdAt: {
        greater_than_equal: periodStart.toISOString(),
        less_than_equal: periodEnd.toISOString(),
      },
    },
  });

  const totalDataPoints = usage.docs.reduce(
    (sum, m) => sum + (m.dataPointsCreated || 0),
    0,
  );
  const totalReports = usage.docs.reduce((sum, m) => sum + (m.reportsPublished || 0), 0);
  const totalApiCalls = usage.docs.reduce((sum, m) => sum + (m.apiCallsCount || 0), 0);

  const planLimits = {
    dataPoints: plan.dataPointsPerMonth || 0,
    reports: plan.reportsPerMonth || 0,
    apiCalls: plan.apiCallsPerMonth || 0,
  };

  // Calculate overages (only if plan has limits and usage exceeds)
  let datapointOverage = 0;
  if (planLimits.dataPoints > 0 && totalDataPoints > planLimits.dataPoints) {
    datapointOverage = (totalDataPoints - planLimits.dataPoints) * DATAPOINT_OVERAGE_RATE;
  }

  let reportOverage = 0;
  if (planLimits.reports > 0 && totalReports > planLimits.reports) {
    reportOverage = (totalReports - planLimits.reports) * REPORT_OVERAGE_RATE;
  }

  let apiCallOverage = 0;
  if (planLimits.apiCalls > 0 && totalApiCalls > planLimits.apiCalls) {
    apiCallOverage = (totalApiCalls - planLimits.apiCalls) * API_CALL_OVERAGE_RATE;
  }

  const totalOverageCost =
    Math.round((datapointOverage + reportOverage + apiCallOverage) * 100) / 100;

  return {
    datapointOverage: Math.round(datapointOverage * 100) / 100,
    reportOverage: Math.round(reportOverage * 100) / 100,
    apiCallOverage: Math.round(apiCallOverage * 100) / 100,
    totalOverageCost,
  };
}

export async function getRealTimeOverageProjection(orgId: string): Promise<{
  projectedDatapointCost: number;
  projectedReportCost: number;
  projectedApiCost: number;
  projectedTotal: number;
}> {
  const payload = await getPayload({ config });

  // Get current month usage
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysPassed = Math.max(1, now.getDate());
  const dailyRate = daysPassed / daysInMonth;

  // Get subscription plan
  const subs = await payload.find({
    collection: "subscriptions",
    where: { organisation: { equals: orgId } },
    limit: 1,
  });

  const subscription = subs.docs?.[0];
  if (!subscription) {
    return {
      projectedDatapointCost: 0,
      projectedReportCost: 0,
      projectedApiCost: 0,
      projectedTotal: 0,
    };
  }

  const planId =
    typeof subscription.plan === "object" ? subscription.plan.id : subscription.plan;
  const plan = await payload.findByID({
    collection: "plans",
    id: String(planId),
  });

  // Get YTD usage
  const usage = await payload.find({
    collection: "usage-metrics",
    where: {
      organisation: { equals: orgId },
      createdAt: {
        greater_than_equal: monthStart.toISOString(),
      },
    },
  });

  const ytdDataPoints = usage.docs.reduce(
    (sum, m) => sum + (m.dataPointsCreated || 0),
    0,
  );
  const ytdReports = usage.docs.reduce((sum, m) => sum + (m.reportsPublished || 0), 0);
  const ytdApiCalls = usage.docs.reduce((sum, m) => sum + (m.apiCallsCount || 0), 0);

  // Project to end of month
  const projectedDatapoints = Math.round(ytdDataPoints / dailyRate);
  const projectedReports = Math.round(ytdReports / dailyRate);
  const projectedApiCalls = Math.round(ytdApiCalls / dailyRate);

  const planLimits = {
    dataPoints: plan.dataPointsPerMonth || 0,
    reports: plan.reportsPerMonth || 0,
    apiCalls: plan.apiCallsPerMonth || 0,
  };

  // Calculate projected overage
  let projectedDatapointCost = 0;
  if (planLimits.dataPoints > 0 && projectedDatapoints > planLimits.dataPoints) {
    projectedDatapointCost =
      (projectedDatapoints - planLimits.dataPoints) * DATAPOINT_OVERAGE_RATE;
  }

  let projectedReportCost = 0;
  if (planLimits.reports > 0 && projectedReports > planLimits.reports) {
    projectedReportCost = (projectedReports - planLimits.reports) * REPORT_OVERAGE_RATE;
  }

  let projectedApiCost = 0;
  if (planLimits.apiCalls > 0 && projectedApiCalls > planLimits.apiCalls) {
    projectedApiCost = (projectedApiCalls - planLimits.apiCalls) * API_CALL_OVERAGE_RATE;
  }

  const projectedTotal =
    Math.round((projectedDatapointCost + projectedReportCost + projectedApiCost) * 100) /
    100;

  return {
    projectedDatapointCost: Math.round(projectedDatapointCost * 100) / 100,
    projectedReportCost: Math.round(projectedReportCost * 100) / 100,
    projectedApiCost: Math.round(projectedApiCost * 100) / 100,
    projectedTotal,
  };
}
