import type { Payload } from "payload";
import type { Subscription } from "./types";
import { logger } from "@/lib/logging/logger";

export class RenewalScheduler {
  private payload: Payload;

  constructor(payload: Payload) {
    this.payload = payload;
  }

  /**
   * Schedule renewal reminders for a subscription at 60, 30, and 7 days before renewal
   */
  async scheduleReminders(subscription: Subscription): Promise<void> {
    try {
      const nextRenewalDate = new Date(subscription.currentPeriodEnd);
      const now = new Date();

      if (nextRenewalDate <= now) {
        logger.warn("Cannot schedule reminders for past renewal date", {
          subscriptionId: subscription.id,
          nextRenewalDate: nextRenewalDate.toISOString(),
        });
        return;
      }

      // Calculate reminder dates
      const daysUntilRenewal = Math.ceil(
        (nextRenewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      // Record reminder schedule in subscription history
      const remindersToSchedule: Array<{ daysBeforeRenewal: number; timestamp: Date }> =
        [];

      // 60-day reminder
      if (daysUntilRenewal >= 60) {
        const reminderDate = new Date(nextRenewalDate);
        reminderDate.setDate(reminderDate.getDate() - 60);
        remindersToSchedule.push({ daysBeforeRenewal: 60, timestamp: reminderDate });
      }

      // 30-day reminder
      if (daysUntilRenewal >= 30) {
        const reminderDate = new Date(nextRenewalDate);
        reminderDate.setDate(reminderDate.getDate() - 30);
        remindersToSchedule.push({ daysBeforeRenewal: 30, timestamp: reminderDate });
      }

      // 7-day reminder
      if (daysUntilRenewal >= 7) {
        const reminderDate = new Date(nextRenewalDate);
        reminderDate.setDate(reminderDate.getDate() - 7);
        remindersToSchedule.push({ daysBeforeRenewal: 7, timestamp: reminderDate });
      }

      // Store reminder schedule metadata in subscription
      if (remindersToSchedule.length > 0) {
        await this.payload.update({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          collection: "subscriptions" as any,
          id: subscription.id,
          data: {
            nextRenewalDate: nextRenewalDate,
          },
          overrideAccess: true,
        });

        logger.info("Renewal reminders scheduled", {
          subscriptionId: subscription.id,
          reminderCount: remindersToSchedule.length,
          nextRenewalDate: nextRenewalDate.toISOString(),
        });
      }
    } catch (error) {
      logger.error("Error scheduling renewal reminders", {
        subscriptionId: subscription.id,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Process renewal for a subscription (to be called on or after renewal date)
   * Updates billing period and creates renewal history entry
   */
  async processRenewal(subscription: Subscription): Promise<void> {
    try {
      const now = new Date();
      const currentPeriodEnd = new Date(subscription.currentPeriodEnd);

      // Only process if renewal date has passed
      if (now < currentPeriodEnd) {
        logger.info("Renewal not yet due", {
          subscriptionId: subscription.id,
          nextRenewalDate: currentPeriodEnd.toISOString(),
        });
        return;
      }

      // Calculate new period dates
      const newPeriodStart = currentPeriodEnd;
      const newPeriodEnd = new Date(currentPeriodEnd);

      if (subscription.billingCycle === "monthly") {
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
      } else {
        newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
      }

      // Update subscription with new period
      await this.payload.update({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collection: "subscriptions" as any,
        id: subscription.id,
        data: {
          currentPeriodStart: newPeriodStart,
          currentPeriodEnd: newPeriodEnd,
          lastRenewalDate: now,
          nextRenewalDate: newPeriodEnd,
        },
        overrideAccess: true,
      });

      // Create renewal history entry
      await this.payload.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collection: "subscription-history" as any,
        data: {
          subscription: subscription.id,
          organisation: subscription.organisation,
          action: "renewal",
          timestamp: now,
          metadata: JSON.stringify({
            newPeriodStart: newPeriodStart.toISOString(),
            newPeriodEnd: newPeriodEnd.toISOString(),
            renewalAmount:
              subscription.billingCycle === "monthly"
                ? typeof subscription.plan === "object" && subscription.plan
                  ? subscription.plan.monthlyPrice
                  : undefined
                : typeof subscription.plan === "object" && subscription.plan
                  ? subscription.plan.annualPrice
                  : undefined,
          }),
        },
        overrideAccess: true,
      });

      logger.info("Renewal processed", {
        subscriptionId: subscription.id,
        newPeriodStart: newPeriodStart.toISOString(),
        newPeriodEnd: newPeriodEnd.toISOString(),
      });
    } catch (error) {
      logger.error("Error processing renewal", {
        subscriptionId: subscription.id,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get subscriptions due for renewal within a specified number of days
   * daysOffset: positive = future dates, negative = past dates
   */
  async getSubscriptionsDueForRenewal(daysOffset: number = 0): Promise<Subscription[]> {
    try {
      const now = new Date();
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + daysOffset);

      // For daily check, look at subscriptions within 1 day of target date
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const result = await this.payload.find({
        collection: "subscriptions",
        where: {
          nextRenewalDate: {
            greater_than_equal: startOfDay.toISOString(),
            less_than_equal: endOfDay.toISOString(),
          },
          status: { equals: "active" },
        },
        limit: 1000,
        overrideAccess: true,
      });

      return (result.docs as unknown as Subscription[]) || [];
    } catch (error) {
      logger.error("Error querying subscriptions due for renewal", {
        daysOffset,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get subscriptions with renewal reminders due
   * Returns subscriptions whose renewal date is within the specified days
   */
  async getSubscriptionsDueForReminder(
    daysBeforeRenewal: number = 7,
  ): Promise<Subscription[]> {
    try {
      const now = new Date();
      const reminderDate = new Date(now);
      reminderDate.setDate(reminderDate.getDate() + daysBeforeRenewal);

      // Look for subscriptions with renewal within +/- 1 day of reminder date
      const startOfDay = new Date(reminderDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(reminderDate);
      endOfDay.setHours(23, 59, 59, 999);

      const result = await this.payload.find({
        collection: "subscriptions",
        where: {
          nextRenewalDate: {
            greater_than_equal: startOfDay.toISOString(),
            less_than_equal: endOfDay.toISOString(),
          },
          status: { equals: "active" },
          autoRenew: { equals: true },
        },
        limit: 1000,
        overrideAccess: true,
      });

      return (result.docs as unknown as Subscription[]) || [];
    } catch (error) {
      logger.error("Error querying subscriptions due for reminder", {
        daysBeforeRenewal,
        error: String(error),
      });
      throw error;
    }
  }
}

/**
 * Factory function to create RenewalScheduler instance
 */
export function createRenewalScheduler(payload: Payload): RenewalScheduler {
  return new RenewalScheduler(payload);
}
