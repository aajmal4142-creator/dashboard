import type { Payload } from "payload";
import type { UsageMetric } from "./types";

export class UsageTracker {
  private payload: Payload;

  constructor(payload: Payload) {
    this.payload = payload;
  }

  /**
   * Track datapoint creation
   */
  async trackDatapointCreated(organisationId: string, count: number = 1): Promise<void> {
    try {
      await this.incrementDailyMetric(organisationId, "dataPointsCreated", count);
      await this.incrementCumulativeMetric(organisationId, "dataPointsCumulative", count);
    } catch (error) {
      console.error("Error tracking datapoint creation:", error);
    }
  }

  /**
   * Track report publication
   */
  async trackReportPublished(organisationId: string, count: number = 1): Promise<void> {
    try {
      await this.incrementDailyMetric(organisationId, "reportsPublished", count);
      await this.incrementCumulativeMetric(organisationId, "reportsCumulative", count);
    } catch (error) {
      console.error("Error tracking report publication:", error);
    }
  }

  /**
   * Track API call (incremented but not persisted on every call - aggregated)
   */
  async trackApiCall(organisationId: string, _endpoint?: string): Promise<void> {
    try {
      await this.incrementDailyMetric(organisationId, "apiCallsCount", 1);
    } catch (error) {
      console.error("Error tracking API call:", error);
    }
  }

  /**
   * Update storage usage (absolute value, not incremental)
   */
  async updateStorageUsage(organisationId: string, sizeGB: number): Promise<void> {
    try {
      const subscription = await this.getSubscriptionForOrg(organisationId);
      if (!subscription) return;

      const today = this.getStartOfDay();
      const existingMetric = await this.getDailyMetric(subscription.id, today);

      if (existingMetric) {
        await this.payload.update({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          collection: "usage-metrics" as any,
          id: existingMetric.id,
          data: {
            storageUsedGB: sizeGB,
          },
        });
      } else {
        // If metric doesn't exist, create it
        const dailyMetric = await this.createDailyMetricIfNotExists(
          subscription.id,
          organisationId,
        );
        await this.payload.update({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          collection: "usage-metrics" as any,
          id: dailyMetric.id,
          data: {
            storageUsedGB: sizeGB,
          },
        });
      }
    } catch (error) {
      console.error("Error updating storage usage:", error);
    }
  }

  /**
   * Track active user count (absolute value)
   */
  async updateActiveUserCount(organisationId: string, count: number): Promise<void> {
    try {
      const subscription = await this.getSubscriptionForOrg(organisationId);
      if (!subscription) return;

      const today = this.getStartOfDay();
      const existingMetric = await this.getDailyMetric(subscription.id, today);

      if (existingMetric) {
        await this.payload.update({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          collection: "usage-metrics" as any,
          id: existingMetric.id,
          data: {
            activeUsersCount: count,
          },
        });
      } else {
        const dailyMetric = await this.createDailyMetricIfNotExists(
          subscription.id,
          organisationId,
        );
        await this.payload.update({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          collection: "usage-metrics" as any,
          id: dailyMetric.id,
          data: {
            activeUsersCount: count,
          },
        });
      }
    } catch (error) {
      console.error("Error updating active user count:", error);
    }
  }

  /**
   * Get current month usage for organization
   */
  async getCurrentMonthUsage(organisationId: string): Promise<UsageMetric> {
    try {
      const subscription = await this.getSubscriptionForOrg(organisationId);
      if (!subscription) {
        throw new Error(`No subscription found for organisation ${organisationId}`);
      }

      const startOfMonth = this.getStartOfMonth();
      const now = new Date();

      // Query all metrics from this month
      const metrics = await this.payload.find({
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
            {
              date: {
                less_than: now,
              },
            },
          ],
        },
        limit: 1000,
      });

      if (!metrics.docs || metrics.docs.length === 0) {
        return this.createEmptyUsageMetric(subscription.id, organisationId);
      }

      // Aggregate the metrics
      return this.aggregateMetrics(
        metrics.docs as UsageMetric[],
        subscription.id,
        organisationId,
      );
    } catch (error) {
      console.error("Error getting current month usage:", error);
      throw error;
    }
  }

  /**
   * Get usage history for a date range
   */
  async getUsageHistory(
    organisationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<UsageMetric[]> {
    try {
      const subscription = await this.getSubscriptionForOrg(organisationId);
      if (!subscription) {
        throw new Error(`No subscription found for organisation ${organisationId}`);
      }

      const result = await this.payload.find({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collection: "usage-metrics" as any,
        where: {
          and: [
            { subscription: { equals: subscription.id } },
            {
              date: {
                greater_than_equal: startDate,
              },
            },
            {
              date: {
                less_than: endDate,
              },
            },
          ],
        },
        limit: 1000,
        sort: "-date",
      });

      return (result.docs as UsageMetric[]) || [];
    } catch (error) {
      console.error("Error getting usage history:", error);
      throw error;
    }
  }

  /**
   * Rollup daily usage to monthly (for archival/reporting)
   */
  async rollupMonthlyUsage(organisationId: string, month: Date): Promise<void> {
    try {
      const subscription = await this.getSubscriptionForOrg(organisationId);
      if (!subscription) return;

      const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
      const startOfNextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);

      const metrics = await this.payload.find({
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
            {
              date: {
                less_than: startOfNextMonth,
              },
            },
          ],
        },
        limit: 1000,
      });

      if (!metrics.docs || metrics.docs.length === 0) {
        return;
      }

      const aggregated = this.aggregateMetrics(
        metrics.docs as UsageMetric[],
        subscription.id,
        organisationId,
      );

      // Store aggregated monthly rollup (can be used for reporting/archival)
      console.log(`Monthly rollup for ${organisationId}:`, aggregated);
    } catch (error) {
      console.error("Error rolling up monthly usage:", error);
    }
  }

  /**
   * Private helper: Increment a daily metric
   */
  private async incrementDailyMetric(
    organisationId: string,
    field: "dataPointsCreated" | "reportsPublished" | "apiCallsCount",
    amount: number,
  ): Promise<void> {
    const subscription = await this.getSubscriptionForOrg(organisationId);
    if (!subscription) return;

    const today = this.getStartOfDay();
    const existingMetric = await this.getDailyMetric(subscription.id, today);

    if (existingMetric) {
      const currentValue = (existingMetric[field] as number) || 0;
      await this.payload.update({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collection: "usage-metrics" as any,
        id: existingMetric.id,
        data: {
          [field]: currentValue + amount,
        },
      });
    } else {
      const dailyMetric = await this.createDailyMetricIfNotExists(
        subscription.id,
        organisationId,
      );
      await this.payload.update({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collection: "usage-metrics" as any,
        id: dailyMetric.id,
        data: {
          [field]: amount,
        },
      });
    }
  }

  /**
   * Private helper: Increment a cumulative metric
   */
  private async incrementCumulativeMetric(
    organisationId: string,
    field: "dataPointsCumulative" | "reportsCumulative",
    amount: number,
  ): Promise<void> {
    const subscription = await this.getSubscriptionForOrg(organisationId);
    if (!subscription) return;

    const today = this.getStartOfDay();
    const existingMetric = await this.getDailyMetric(subscription.id, today);

    if (existingMetric) {
      const currentValue = (existingMetric[field] as number) || 0;
      await this.payload.update({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collection: "usage-metrics" as any,
        id: existingMetric.id,
        data: {
          [field]: currentValue + amount,
        },
      });
    } else {
      const dailyMetric = await this.createDailyMetricIfNotExists(
        subscription.id,
        organisationId,
      );
      await this.payload.update({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collection: "usage-metrics" as any,
        id: dailyMetric.id,
        data: {
          [field]: amount,
        },
      });
    }
  }

  /**
   * Private helper: Get or create daily metric
   */
  private async getDailyMetric(
    subscriptionId: string,
    date: Date,
  ): Promise<UsageMetric | null> {
    const result = await this.payload.find({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: "usage-metrics" as any,
      where: {
        and: [
          { subscription: { equals: subscriptionId } },
          {
            date: {
              equals: date.toISOString().split("T")[0],
            },
          },
        ],
      },
      limit: 1,
    });

    return (result.docs?.[0] as UsageMetric) || null;
  }

  /**
   * Private helper: Create daily metric if not exists
   */
  private async createDailyMetricIfNotExists(
    subscriptionId: string,
    organisationId: string,
  ): Promise<UsageMetric> {
    const today = this.getStartOfDay();
    const existing = await this.getDailyMetric(subscriptionId, today);

    if (existing) {
      return existing;
    }

    const created = await this.payload.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: "usage-metrics" as any,
      data: {
        subscription: subscriptionId,
        organisation: organisationId,
        date: today,
        dataPointsCreated: 0,
        dataPointsCumulative: 0,
        reportsPublished: 0,
        reportsCumulative: 0,
        apiCallsCount: 0,
        storageUsedGB: 0,
        activeUsersCount: 0,
      },
    });

    return created as UsageMetric;
  }

  /**
   * Private helper: Get subscription for organisation
   */
  private async getSubscriptionForOrg(organisationId: string) {
    const result = await this.payload.find({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: "subscriptions" as any,
      where: {
        organisation: { equals: organisationId },
      },
      limit: 1,
    });

    return result.docs?.[0];
  }

  /**
   * Private helper: Get start of day
   */
  private getStartOfDay(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  /**
   * Private helper: Get start of month
   */
  private getStartOfMonth(): Date {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }

  /**
   * Private helper: Create empty usage metric
   */
  private createEmptyUsageMetric(
    subscriptionId: string,
    organisationId: string,
  ): UsageMetric {
    return {
      id: "",
      subscription: subscriptionId,
      organisation: organisationId,
      date: new Date(),
      dataPointsCreated: 0,
      dataPointsCumulative: 0,
      reportsPublished: 0,
      reportsCumulative: 0,
      apiCallsCount: 0,
      storageUsedGB: 0,
      activeUsersCount: 0,
      createdAt: new Date(),
    };
  }

  /**
   * Private helper: Aggregate metrics from multiple days
   */
  private aggregateMetrics(
    metrics: UsageMetric[],
    subscriptionId: string,
    organisationId: string,
  ): UsageMetric {
    return metrics.reduce(
      (acc, metric) => ({
        ...acc,
        dataPointsCumulative: metric.dataPointsCumulative,
        reportsCumulative: metric.reportsCumulative,
        storageUsedGB: metric.storageUsedGB,
        activeUsersCount: metric.activeUsersCount,
      }),
      {
        id: "",
        subscription: subscriptionId,
        organisation: organisationId,
        date: new Date(),
        dataPointsCreated: 0,
        dataPointsCumulative: 0,
        reportsPublished: 0,
        reportsCumulative: 0,
        apiCallsCount: metrics.reduce((sum, m) => sum + m.apiCallsCount, 0),
        storageUsedGB: 0,
        activeUsersCount: 0,
        createdAt: new Date(),
      },
    );
  }
}

/**
 * Factory function to create a UsageTracker instance
 */
export function createUsageTracker(payload: Payload): UsageTracker {
  return new UsageTracker(payload);
}
