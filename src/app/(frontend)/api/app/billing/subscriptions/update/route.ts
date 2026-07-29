import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";
import type { BillingCycle } from "@/lib/billing/types";

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
        { status: 403 },
      );
    }

    const body = (await request.json()) as {
      planId?: string;
      billingCycle?: BillingCycle;
      seats?: number;
    };
    const { planId, billingCycle, seats } = body;

    const payload = await getPayload({ config });

    const result = await payload.find({
      collection: "subscriptions",
      where: {
        organisation: { equals: ctx.activeOrg.id },
      },
      limit: 1,
    });

    const subscription = result.docs?.[0];
    if (!subscription) {
      return NextResponse.json({ error: "No subscription found" }, { status: 404 });
    }

    const updates: {
      plan?: string;
      billingCycle?: BillingCycle;
      seats?: number;
    } = {};

    if (planId) {
      const plan = await payload.findByID({
        collection: "plans",
        id: planId,
      });

      if (!plan) {
        return NextResponse.json({ error: "Plan not found" }, { status: 404 });
      }

      updates.plan = planId;
    }

    if (billingCycle) {
      if (!["monthly", "annual"].includes(billingCycle)) {
        return NextResponse.json({ error: "Invalid billing cycle" }, { status: 400 });
      }
      updates.billingCycle = billingCycle;
    }

    if (seats !== undefined) {
      if (seats < 1) {
        return NextResponse.json({ error: "Seats must be at least 1" }, { status: 400 });
      }
      updates.seats = seats;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const updated = await payload.update({
      collection: "subscriptions",
      id: subscription.id,
      data: updates,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating subscription:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
