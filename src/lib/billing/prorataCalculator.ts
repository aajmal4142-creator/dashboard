import type { Subscription, Plan } from "./types";

export class ProrataCalculator {
  /**
   * Calculate pro-rata amount when switching plans or billing cycles mid-period
   * Positive = credit to account, Negative = additional charge
   */
  calculateProrataAmount(
    subscription: Subscription,
    oldPlan: Plan,
    newPlan: Plan,
    oldCycle: "monthly" | "annual",
    newCycle: "monthly" | "annual",
  ): number {
    // Get current period info
    const now = new Date();
    const periodStart = new Date(subscription.currentPeriodStart);
    const periodEnd = new Date(subscription.currentPeriodEnd);

    // If dates are invalid or period has ended, no pro-rata
    if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
      return 0;
    }

    if (now >= periodEnd) {
      return 0;
    }

    // Calculate days
    const totalDaysInPeriod = this.getDaysBetween(periodStart, periodEnd);
    const daysRemaining = this.getDaysBetween(now, periodEnd);

    if (totalDaysInPeriod <= 0 || daysRemaining <= 0) {
      return 0;
    }

    // Get prices
    const oldPrice = oldCycle === "monthly" ? oldPlan.monthlyPrice : oldPlan.annualPrice;
    const newPrice = newCycle === "monthly" ? newPlan.monthlyPrice : newPlan.annualPrice;

    // Calculate daily rates
    const oldDailyRate =
      oldCycle === "monthly"
        ? oldPrice / this.getDaysInMonth(now)
        : oldPrice / 365;
    const newDailyRate =
      newCycle === "monthly"
        ? newPrice / this.getDaysInMonth(now)
        : newPrice / 365;

    // Already paid amount (old plan, already consumed days)
    const daysConsumed = totalDaysInPeriod - daysRemaining;
    const alreadyPaid = oldDailyRate * daysConsumed;

    // New price for remaining days
    const newCostForRemaining = newDailyRate * daysRemaining;

    // Pro-rata adjustment (positive = credit, negative = charge)
    // If new is cheaper, customer gets credit. If new is more expensive, they get charged.
    const prorataAdjustment = alreadyPaid - newCostForRemaining;

    // Round to 2 decimal places
    return Math.round(prorataAdjustment * 100) / 100;
  }

  /**
   * Generate human-readable label for pro-rata adjustment
   */
  getProrataLabel(
    prorataAmount: number,
    oldCycle: string,
    newCycle: string,
    oldPlan: Plan,
    newPlan: Plan,
  ): string {
    if (prorataAmount === 0) {
      return "No pro-rata adjustment";
    }

    const absAmount = Math.abs(prorataAmount);
    const isCycleChange = oldCycle !== newCycle;
    const isPlanChange = oldPlan.name !== newPlan.name;

    let label = "";

    if (isPlanChange && isCycleChange) {
      label = `Changing from ${oldPlan.displayName} (${oldCycle}) to ${newPlan.displayName} (${newCycle})`;
    } else if (isPlanChange) {
      label = `Upgrading from ${oldPlan.displayName} to ${newPlan.displayName}`;
    } else if (isCycleChange) {
      label = `Switching from ${oldCycle} to ${newCycle} billing`;
    }

    if (prorataAmount > 0) {
      label += ` - ${prorataAmount > 0 ? "Credit" : "Charge"} of $${absAmount.toFixed(2)}`;
    } else {
      label += ` - Additional charge of $${absAmount.toFixed(2)}`;
    }

    return label;
  }

  /**
   * Calculate next renewal date based on subscription and billing cycle
   */
  getNextRenewalDate(subscription: Subscription): Date {
    const periodEnd = new Date(subscription.currentPeriodEnd);
    // Next renewal is at the end of current period
    return periodEnd;
  }

  /**
   * Calculate the daily rate for a given amount and billing cycle
   */
  getDailyRate(amount: number, cycle: "monthly" | "annual"): number {
    if (cycle === "monthly") {
      const now = new Date();
      const daysInMonth = this.getDaysInMonth(now);
      return amount / daysInMonth;
    } else {
      return amount / 365;
    }
  }

  /**
   * Calculate number of days between two dates (inclusive of start, exclusive of end)
   */
  private getDaysBetween(start: Date, end: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.ceil((end.getTime() - start.getTime()) / msPerDay);
  }

  /**
   * Get number of days in the month for a given date
   */
  private getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }
}

/**
 * Factory function to create ProrataCalculator instance
 */
export function createProrataCalculator(): ProrataCalculator {
  return new ProrataCalculator();
}
