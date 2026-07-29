import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

/**
 * POST /api/app/billing/subscriptions/cancel
 * Cancel organization's subscription
 */
export async function POST(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (ctx.role !== "owner") {
      return NextResponse.json(
        { error: "Only owners can cancel subscriptions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { reason } = body;

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

    if (subscription.status === "canceled") {
      return NextResponse.json(
        { error: "Subscription already canceled" },
        { status: 409 }
      );
    }

    // Update subscription status
    const updated = await payload.update({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: "subscriptions" as any,
      id: subscription.id,
      data: {
        status: "canceled",
        cancelledAt: new Date(),
      },
    });

    return NextResponse.json({
      ...updated,
      message: "Subscription canceled successfully",
    });
  } catch (error) {
    console.error("Error canceling subscription:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
