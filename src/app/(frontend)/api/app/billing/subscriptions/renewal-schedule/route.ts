import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

/**
 * GET /api/app/billing/subscriptions/renewal-schedule
 * Get subscription renewal schedule information
 */
export async function GET() {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Get plan details
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

    // Calculate renewal info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nextRenewalDate = new Date(
      ((subscription as any).nextRenewalDate as Date | undefined) ||
        subscription.currentPeriodEnd,
    );
    const now = new Date();
    const daysUntilRenewal = Math.ceil(
      (nextRenewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Get renewal amount based on billing cycle
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const renewalAmount =
      subscription.billingCycle === "annual"
        ? (plan as any).annualPrice
        : (plan as any).monthlyPrice;

    return NextResponse.json({
      nextRenewalDate,
      daysUntilRenewal: Math.max(0, daysUntilRenewal),
      estimatedRenewalAmount: renewalAmount,
      billingCycle: subscription.billingCycle,
      planName: (plan as any).displayName,
      autoRenew: subscription.autoRenew,
      status: subscription.status,
    });
  } catch (error) {
    console.error("Error fetching renewal schedule:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
