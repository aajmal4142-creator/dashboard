import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

/**
 * PUT /api/app/billing/subscriptions/update
 * Update subscription plan or billing cycle
 */
export async function PUT(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can update subscriptions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { planId, billingCycle, seats } = body;

    const payload = await getPayload({ config });

    // Get current subscription
    const result = await payload.find({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: "subscriptions" as any,
      where: {
        organisation: { equals: ctx.activeOrg.id },
      },
      limit: 1,
    });

    const subscription = result.docs?.[0];
    if (!subscription) {
      return NextResponse.json({ error: "No subscription found" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {};

    if (planId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plan = await payload.findByID({
        collection: "plans" as any,
        id: planId,
      });

      if (!plan) {
        return NextResponse.json({ error: "Plan not found" }, { status: 404 });
      }

      updates.plan = planId;
    }

    if (billingCycle) {
      if (!["monthly", "annual"].includes(billingCycle)) {
        return NextResponse.json(
          { error: "Invalid billing cycle" },
          { status: 400 }
        );
      }
      updates.billingCycle = billingCycle;
    }

    if (seats !== undefined) {
      if (seats < 1) {
        return NextResponse.json(
          { error: "Seats must be at least 1" },
          { status: 400 }
        );
      }
      updates.seats = seats;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No updates provided" },
        { status: 400 }
      );
    }

    const updated = await payload.update({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: "subscriptions" as any,
      id: subscription.id,
      data: updates,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating subscription:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
