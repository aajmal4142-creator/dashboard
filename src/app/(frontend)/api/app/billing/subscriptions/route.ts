import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

/**
 * GET /api/app/billing/subscriptions/current
 * Get current organization's subscription
 */
export async function GET(_request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check ABAC permission
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "view",
      "billing",
      ctx.activeOrg.id,
      "organisation"
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const payload = await getPayload({ config });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await payload.find({
      collection: "subscriptions" as any,
      where: {
        organisation: { equals: ctx.activeOrg.id },
      },
      limit: 1,
    });

    const subscription = result.docs?.[0];
    if (!subscription) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 404 }
      );
    }

    // Populate plan details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plan = await payload.findByID({
      collection: "plans" as any,
      id: String(subscription.plan),
    });

    return NextResponse.json({
      ...subscription,
      plan,
    });
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/app/billing/subscriptions
 * Create a new subscription for organization
 */
export async function POST(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can create subscriptions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { planId, billingCycle = "monthly", seats = 1 } = body;

    if (!planId) {
      return NextResponse.json(
        { error: "planId is required" },
        { status: 400 }
      );
    }

    const payload = await getPayload({ config });

    // Verify plan exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plan = await payload.findByID({
      collection: "plans" as any,
      id: planId,
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Check if subscription already exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await payload.find({
      collection: "subscriptions" as any,
      where: {
        organisation: { equals: ctx.activeOrg.id },
      },
      limit: 1,
    });

    if (existing.docs?.length) {
      return NextResponse.json(
        { error: "Organization already has an active subscription" },
        { status: 409 }
      );
    }

    // Create subscription
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscription = await payload.create({
      collection: "subscriptions" as any,
      data: {
        organisation: ctx.activeOrg.id,
        plan: planId,
        status: "trialing",
        billingCycle,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        seats,
        autoRenew: true,
      },
    });

    return NextResponse.json(subscription, { status: 201 });
  } catch (error) {
    console.error("Error creating subscription:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
