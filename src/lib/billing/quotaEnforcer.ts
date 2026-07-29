import type { Payload } from "payload";
import type {
  Plan,
  QuotaStatus,
  QuotaCheckResult,
  OverageInfo,
  Subscription,
} from "./types";

export class QuotaEnforcer {
  private payload: Payload;

  constructor(payload: Payload) {
    this.payload = payload;
  }

  /**
   * Check if an action is allowed within quota limits
   */
  async checkQuota(
    organisationId: string,
    action: "create_datapoint" | "publish_report" | "api_call" | "store_file",
    count: number = 1,
  ): Promise<QuotaCheckResult> {
    try {
      const subscription = await this.getSubscription(organisationId);
      if (!subscription) {
        throw new Error(`No subscription found for organisation ${organisationId}`);
      }

      const status = await this.getQuotaStatus(organisationId);
      const plan = status.plan;
      const resetDate = this.getNextBillingCycleStart(subscription);

      switch (action) {
        case "create_datapoint": {
          const nextUsage = status.usage.dataPoints + count;
          const allowed =
            plan.dataPointsPerMonth === 0 || nextUsage <= plan.dataPointsPerMonth;
          return {
            allowed,
            remaining: Math.max(0, plan.dataPointsPerMonth - nextUsage),
            resetDate,
            suggestion: allowed ? undefined : "upgrade",
          };
        }

        case "publish_report": {
          const nextUsage = status.usage.reports + count;
          const allowed = plan.reportsPerMonth === 0 || nextUsage <= plan.reportsPerMonth;
          return {
            allowed,
            remaining: Math.max(0, plan.reportsPerMonth - nextUsage),
            resetDate,
            suggestion: allowed ? undefined : "upgrade",
          };
        }

        case "store_file": {
          const nextUsage = status.usage.storage + count;
          const allowed = plan.storageGB === 0 || nextUsage <= plan.storageGB;
          return {
            allowed,
            remaining: Math.max(0, plan.storageGB - nextUsage),
            resetDate,
            suggestion: allowed ? undefined : "upgrade",
          };
        }

        case "api_call":
          return {
            allowed: true,
            remaining: Infinity,
            resetDate,
          };

        default:
          return {
            allowed: true,
            remaining: Infinity,
            resetDate,
          };
      }
    } catch (error) {
      console.error("Error checking quota:", error);
      throw error;
    }
  }

  /**
   * Enforce quota (throws if exceeded)
   */
  async enforceQuota(
    organisationId: string,
    action: "create_datapoint" | "publish_report" | "api_call" | "store_file",
    count: number = 1,
  ): Promise<void> {
    const result = await this.checkQuota(organisationId, action, count);

    if (!result.allowed) {
      throw new Error(
        `Quota exceeded for ${action}. Upgrade plan or wait for next billing cycle.`,
      );
    }
  }

  /**
   * Get current quota status and usage
   */
  async getQuotaStatus(organisationId: string): Promise<QuotaStatus> {
    try {
      // Get subscription
      const subscriptionResult = await this.payload.find({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collection: "subscriptions" as any,
        where: {
          organisation: { equals: organisationId },
        },
        limit: 1,
      });

      const subscription = subscriptionResult.docs?.[0] as Subscription;
      if (!subscription) {
        throw new Error(`No subscription found for organisation ${organisationId}`);
      }

      // Get plan
      const plan = await this.payload.findByID({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collection: "plans" as any,
        id: String(subscription.plan),
      });

      if (!plan) {
        throw new Error(`Plan not found for subscription ${subscription.id}`);
      }

      // Get current month usage
      const usage = await this.getCurrentMonthUsage(organisationId);

      // Calculate remaining and percentages
      const remaining = {
        dataPoints: Math.max(0, plan.dataPointsPerMonth - usage.dataPoints),
        reports: Math.max(0, plan.reportsPerMonth - usage.reports),
        storage: Math.max(0, plan.storageGB - usage.storage),
        activeUsers: Math.max(0, plan.activeUsersLimit - usage.activeUsers),
      };

      const percentageUsed = {
        dataPoints:
          plan.dataPointsPerMonth === 0
            ? 0
            : (usage.dataPoints / plan.dataPointsPerMonth) * 100,
        reports:
          plan.reportsPerMonth === 0 ? 0 : (usage.reports / plan.reportsPerMonth) * 100,
        storage: plan.storageGB === 0 ? 0 : (usage.storage / plan.storageGB) * 100,
        activeUsers:
          plan.activeUsersLimit === 0
            ? 0
            : (usage.activeUsers / plan.activeUsersLimit) * 100,
      };

      return {
        organisation: organisationId,
        subscription: subscription.id,
        plan: plan as Plan,
        limits: {
          dataPoints: plan.dataPointsPerMonth,
          reports: plan.reportsPerMonth,
          storage: plan.storageGB,
          activeUsers: plan.activeUsersLimit,
        },
        usage,
        remaining,
        percentageUsed,
      };
    } catch (error) {
      console.error("Error getting quota status:", error);
      throw error;
    }
  }

  /**
   * Detect overages beyond plan limits
   */
  detectOverages(
    usage: {
      dataPointsCumulative: number;
      reportsCumulative: number;
      storageUsedGB: number;
    },
    plan: Plan,
  ): OverageInfo[] {
    const overages: OverageInfo[] = [];

    // Datapoint overages
    if (
      plan.dataPointsPerMonth > 0 &&
      usage.dataPointsCumulative > plan.dataPointsPerMonth
    ) {
      const excess = usage.dataPointsCumulative - plan.dataPointsPerMonth;
      overages.push({
        metric: "datapoints",
        excess,
        charge: (excess / 100) * plan.overageRatePerUnit,
      });
    }

    // Report overages
    if (plan.reportsPerMonth > 0 && usage.reportsCumulative > plan.reportsPerMonth) {
      const excess = usage.reportsCumulative - plan.reportsPerMonth;
      overages.push({
        metric: "reports",
        excess,
        // Assuming $0.10 per report overage or derived from plan
        charge: excess * 0.1,
      });
    }

    // Storage overages
    if (plan.storageGB > 0 && usage.storageUsedGB > plan.storageGB) {
      const excess = usage.storageUsedGB - plan.storageGB;
      overages.push({
        metric: "storage",
        excess,
        // Assuming $1.00 per GB overage
        charge: excess * 1.0,
      });
    }

    return overages;
  }

  /**
   * Get warning status (approaching limits)
   */
  getWarnings(status: QuotaStatus): string[] {
    const warnings: string[] = [];

    // Warn at 80% usage
    if (status.percentageUsed.dataPoints >= 80) {
      warnings.push(
        `Datapoint usage at ${Math.round(status.percentageUsed.dataPoints)}% of limit`,
      );
    }

    if (status.percentageUsed.reports >= 80) {
      warnings.push(
        `Report usage at ${Math.round(status.percentageUsed.reports)}% of limit`,
      );
    }

    if (status.percentageUsed.storage >= 80) {
      warnings.push(
        `Storage usage at ${Math.round(status.percentageUsed.storage)}% of limit`,
      );
    }

    return warnings;
  }

  /**
   * Private helper: Get current month usage
   */
  private async getCurrentMonthUsage(organisationId: string): Promise<{
    dataPoints: number;
    reports: number;
    storage: number;
    activeUsers: number;
  }> {
    try {
      const subscription = await this.getSubscription(organisationId);
      if (!subscription) {
        return {
          dataPoints: 0,
          reports: 0,
          storage: 0,
          activeUsers: 0,
        };
      }

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const result = await this.payload.find({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collection: "usage-metrics" as any,
        where: {
          and: [
            { subscription: { equals: subscription.id } },
            {
              date: {
                greater_than_equal: startOfMonth,
              },
            },
          ],
        },
        limit: 1000,
      });

      if (!result.docs || result.docs.length === 0) {
        return {
          dataPoints: 0,
          reports: 0,
          storage: 0,
          activeUsers: 0,
        };
      }

      // Get the latest cumulative values (should be the most recent entry)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const latestMetric = result.docs[result.docs.length - 1] as any;

      return {
        dataPoints: latestMetric.dataPointsCumulative || 0,
        reports: latestMetric.reportsCumulative || 0,
        storage: latestMetric.storageUsedGB || 0,
        activeUsers: latestMetric.activeUsersCount || 0,
      };
    } catch (error) {
      console.error("Error getting current month usage:", error);
      return {
        dataPoints: 0,
        reports: 0,
        storage: 0,
        activeUsers: 0,
      };
    }
  }

  /**
   * Private helper: Get subscription for organisation
   */
  private async getSubscription(organisationId: string): Promise<Subscription | null> {
    const result = await this.payload.find({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: "subscriptions" as any,
      where: {
        organisation: { equals: organisationId },
      },
      limit: 1,
    });

    return (result.docs?.[0] as Subscription) || null;
  }

  /**
   * Private helper: Get next billing cycle start
   */
  private getNextBillingCycleStart(subscription: Subscription): Date {
    return new Date(subscription.currentPeriodEnd);
  }
}

/**
 * Factory function to create a QuotaEnforcer instance
 */
export function createQuotaEnforcer(payload: Payload): QuotaEnforcer {
  return new QuotaEnforcer(payload);
}
