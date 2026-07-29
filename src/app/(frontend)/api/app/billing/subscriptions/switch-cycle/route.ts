import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";
import { createProrataCalculator } from "@/lib/billing/prorataCalculator";
import { createStripeService } from "@/lib/billing/stripeService";
import type { BillingCycle, Plan, Subscription } from "@/lib/billing/types";

/**
 * POST /api/app/billing/subscriptions/switch-cycle
 * Switch subscription billing cycle (monthly <-> annual)
 */
export async function POST(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can switch billing cycles" },
        { status: 403 },
      );
    }

    const body = (await request.json()) as {
      newBillingCycle: BillingCycle;
      confirmProrata?: boolean;
    };

    const { newBillingCycle, confirmProrata = false } = body;

    if (!["monthly", "annual"].includes(newBillingCycle)) {
      return NextResponse.json({ error: "Invalid billing cycle" }, { status: 400 });
    }

    const payload = await getPayload({ config });

    const result = await payload.find({
      collection: "subscriptions",
      where: {
        organisation: { equals: ctx.activeOrg.id },
      },
      limit: 1,
    });

    const subscriptionDoc = result.docs?.[0];
    if (!subscriptionDoc) {
      return NextResponse.json({ error: "No subscription found" }, { status: 404 });
    }

    if (subscriptionDoc.status !== "active") {
      return NextResponse.json(
        { error: "Can only switch billing cycle for active subscriptions" },
        { status: 400 },
      );
    }

    if (subscriptionDoc.billingCycle === newBillingCycle) {
      return NextResponse.json(
        { error: "Subscription already on this billing cycle" },
        { status: 400 },
      );
    }

    const planDoc = await payload.findByID({
      collection: "plans",
      id:
        typeof subscriptionDoc.plan === "string"
          ? subscriptionDoc.plan
          : subscriptionDoc.plan.id,
    });

    if (!planDoc) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const plan: Plan = {
      id: planDoc.id,
      name: planDoc.name,
      displayName: planDoc.displayName,
      monthlyPrice: planDoc.monthlyPrice,
      annualPrice: planDoc.annualPrice,
      dataPointsPerMonth: planDoc.dataPointsPerMonth,
      reportsPerMonth: planDoc.reportsPerMonth,
      storageGB: planDoc.storageGB,
      activeUsersLimit: planDoc.activeUsersLimit,
      features: (planDoc.features || []).map((f) => ({ name: f.name })),
      overageRatePerUnit: planDoc.overageRatePerUnit,
      trialDays: planDoc.trialDays ?? undefined,
      isActive: Boolean(planDoc.isActive),
    };

    const subscription: Subscription = {
      id: subscriptionDoc.id,
      organisation:
        typeof subscriptionDoc.organisation === "string"
          ? subscriptionDoc.organisation
          : subscriptionDoc.organisation.id,
      plan: plan.id,
      status: subscriptionDoc.status,
      billingCycle: subscriptionDoc.billingCycle,
      currentPeriodStart: new Date(subscriptionDoc.currentPeriodStart),
      currentPeriodEnd: new Date(subscriptionDoc.currentPeriodEnd),
      nextRenewalDate: new Date(subscriptionDoc.nextRenewalDate),
      lastRenewalDate: subscriptionDoc.lastRenewalDate
        ? new Date(subscriptionDoc.lastRenewalDate)
        : undefined,
      trialEndsAt: subscriptionDoc.trialEndsAt
        ? new Date(subscriptionDoc.trialEndsAt)
        : undefined,
      cancelledAt: subscriptionDoc.cancelledAt
        ? new Date(subscriptionDoc.cancelledAt)
        : undefined,
      stripeSubscriptionId: subscriptionDoc.stripeSubscriptionId ?? undefined,
      stripeCustomerId: subscriptionDoc.stripeCustomerId ?? undefined,
      seats: subscriptionDoc.seats,
      autoRenew: subscriptionDoc.autoRenew,
      annualDiscountPercentage: subscriptionDoc.annualDiscountPercentage,
      sendInvoices: subscriptionDoc.sendInvoices,
      contactEmail: subscriptionDoc.contactEmail ?? undefined,
      sendUsageAlerts: subscriptionDoc.sendUsageAlerts,
      createdAt: new Date(subscriptionDoc.createdAt),
      updatedAt: new Date(subscriptionDoc.updatedAt),
    };

    const prorataCalculator = createProrataCalculator();
    const prorataAmount = prorataCalculator.calculateProrataAmount(
      subscription,
      plan,
      plan,
      subscription.billingCycle,
      newBillingCycle,
    );

    if (prorataAmount > 0 && !confirmProrata) {
      return NextResponse.json({
        success: false,
        prorataAmount,
        newNextRenewalDate: new Date(subscriptionDoc.currentPeriodEnd),
        confirmationRequired: true,
        message: `Switching to ${newBillingCycle} will credit $${prorataAmount.toFixed(2)} to your account. Confirm to proceed.`,
      });
    }

    const newRenewalDate = new Date(subscriptionDoc.currentPeriodEnd);

    if (subscriptionDoc.stripeSubscriptionId) {
      const stripeService = createStripeService(payload);
      try {
        await stripeService.switchBillingCycle(
          subscriptionDoc.stripeSubscriptionId,
          newBillingCycle,
          plan.name,
          prorataAmount,
        );
      } catch (error) {
        console.error("Error updating Stripe subscription:", error);
        return NextResponse.json(
          { error: "Failed to update subscription in Stripe" },
          { status: 500 },
        );
      }
    }

    await payload.update({
      collection: "subscriptions",
      id: subscriptionDoc.id,
      data: {
        billingCycle: newBillingCycle,
        nextRenewalDate: newRenewalDate.toISOString(),
      },
    });

    await payload.create({
      collection: "subscription-history",
      data: {
        subscription: subscriptionDoc.id,
        organisation: ctx.activeOrg.id,
        action: "billing_cycle_change",
        previousCycle: subscriptionDoc.billingCycle,
        newCycle: newBillingCycle,
        prorataAdjustment: prorataAmount,
        timestamp: new Date().toISOString(),
        initiatedBy: ctx.user.id,
        metadata: JSON.stringify({
          planId: plan.id,
          planName: plan.name,
          stripeSubscriptionId: subscriptionDoc.stripeSubscriptionId,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      prorataAmount,
      newNextRenewalDate: newRenewalDate,
      newBillingCycle,
    });
  } catch (error) {
    console.error("Error switching billing cycle:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
