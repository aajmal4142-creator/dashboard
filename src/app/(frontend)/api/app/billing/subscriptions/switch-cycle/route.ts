import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";
import { createProrataCalculator } from "@/lib/billing/prorataCalculator";
import { createStripeService } from "@/lib/billing/stripeService";
import type { BillingCycle } from "@/lib/billing/types";

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

    // Validate billing cycle
    if (!["monthly", "annual"].includes(newBillingCycle)) {
      return NextResponse.json(
        { error: "Invalid billing cycle" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });

    // Get current subscription
    const result = await payload.find({
      collection: "subscriptions",
      where: {
        organisation: { equals: ctx.activeOrg.id },
      },
      limit: 1,
    });

    const subscription = result.docs?.[0];
    if (!subscription) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 404 },
      );
    }

    // Validate subscription status
    if (subscription.status !== "active") {
      return NextResponse.json(
        { error: "Can only switch billing cycle for active subscriptions" },
        { status: 400 },
      );
    }

    // Check if already on requested cycle
    if (subscription.billingCycle === newBillingCycle) {
      return NextResponse.json(
        { error: "Subscription already on this billing cycle" },
        { status: 400 },
      );
    }

    // Get current plan
    const plan = await payload.findByID({
      collection: "plans",
      id: typeof subscription.plan === "string" ? subscription.plan : subscription.plan.id,
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 },
      );
    }

    // Calculate pro-rata adjustment
    const prorataCalculator = createProrataCalculator();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prorataAmount = prorataCalculator.calculateProrataAmount(
      subscription as any,
      plan as any,
      plan as any,
      subscription.billingCycle,
      newBillingCycle,
    );

    // If pro-rata amount is positive (credit) and not confirmed, ask for confirmation
    if (prorataAmount > 0 && !confirmProrata) {
      return NextResponse.json({
        success: false,
        prorataAmount,
        newNextRenewalDate: new Date(subscription.currentPeriodEnd),
        confirmationRequired: true,
        message: `Switching to ${newBillingCycle} will credit $${prorataAmount.toFixed(2)} to your account. Confirm to proceed.`,
      });
    }

    // Calculate new renewal date
    const newRenewalDate = new Date(subscription.currentPeriodEnd);

    // Update Stripe subscription
    if (subscription.stripeSubscriptionId) {
      const stripeService = createStripeService(payload);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await stripeService.switchBillingCycle(
          subscription.stripeSubscriptionId,
          newBillingCycle,
          (plan as any).name,
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

    // Update Payload subscription
    await payload.update({
      collection: "subscriptions",
      id: subscription.id,
      data: {
        billingCycle: newBillingCycle,
        nextRenewalDate: newRenewalDate,
      },
    });

    // Create subscription history entry
    await payload.create({
      collection: "subscription-history",
      data: {
        subscription: subscription.id,
        organisation: ctx.activeOrg.id,
        action: "billing_cycle_change",
        previousCycle: subscription.billingCycle,
        newCycle: newBillingCycle,
        prorataAdjustment: prorataAmount,
        initiatedBy: ctx.user.id,
        metadata: JSON.stringify({
          planId: (plan as any).id,
          planName: (plan as any).name,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
